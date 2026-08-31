package handler

import (
	"context"
	"log"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"valley-server/internal/database"
	"valley-server/internal/model"
	"valley-server/internal/service/articlepackage"
	"valley-server/internal/utils"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

var articlePackageServiceFactory = func() *articlepackage.Service {
	return articlepackage.NewService(
		database.DB,
		articlepackage.NewTOSStore(utils.GetTOSUploader()),
	)
}

func currentArticlePackageService() *articlepackage.Service {
	return articlePackageServiceFactory()
}

func AdminCreateArticlePackageUpload(c *gin.Context) {
	userID, _, ok := currentUser(c)
	if !ok {
		Error(c, http.StatusUnauthorized, "请先登录")
		return
	}
	var request struct {
		OriginalName string `json:"originalName" binding:"required"`
		Size         int64  `json:"size" binding:"required"`
	}
	if err := c.ShouldBindJSON(&request); err != nil {
		Error(c, http.StatusBadRequest, "请选择有效的 ZIP 文件")
		return
	}
	result, err := currentArticlePackageService().CreateUpload(
		c.Request.Context(), model.Int64String(userID), request.OriginalName, request.Size,
	)
	if err != nil {
		Error(c, http.StatusBadRequest, err.Error())
		return
	}
	Success(c, result)
}

func AdminConfirmArticlePackage(c *gin.Context) {
	userID, _, ok := currentUser(c)
	if !ok {
		Error(c, http.StatusUnauthorized, "请先登录")
		return
	}
	packageID, valid := articlePackageIDParam(c)
	if !valid {
		return
	}
	result, err := currentArticlePackageService().Confirm(c.Request.Context(), model.Int64String(userID), packageID)
	if err != nil {
		Error(c, http.StatusBadRequest, err.Error())
		return
	}
	Success(c, result)
}

func AdminGetArticlePackage(c *gin.Context) {
	userID, _, ok := currentUser(c)
	if !ok {
		Error(c, http.StatusUnauthorized, "请先登录")
		return
	}
	packageID, valid := articlePackageIDParam(c)
	if !valid {
		return
	}
	result, err := currentArticlePackageService().GetOwnedSummary(c.Request.Context(), model.Int64String(userID), packageID)
	if err != nil {
		Error(c, http.StatusNotFound, "文章配套包不存在")
		return
	}
	Success(c, result)
}

// AdminUpdatePostArticlePackage stores an explicit keep/replace/remove intent.
// Published articles keep serving their current pointer until the article is
// published again; draft articles can update the pointer immediately.
func AdminUpdatePostArticlePackage(c *gin.Context) {
	postIDValue, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil || postIDValue <= 0 {
		Error(c, http.StatusBadRequest, "文章编号无效")
		return
	}
	var post model.Post
	if err := database.DB.First(&post, postIDValue).Error; err != nil {
		Error(c, http.StatusNotFound, "文章不存在")
		return
	}
	if !canManagePost(c, post.AuthorID) {
		Error(c, http.StatusForbidden, "没有权限修改这篇文章")
		return
	}
	var request struct {
		Action    string             `json:"action" binding:"required"`
		PackageID *model.Int64String `json:"packageId"`
	}
	if err := c.ShouldBindJSON(&request); err != nil {
		Error(c, http.StatusBadRequest, "请选择保留、替换或移除")
		return
	}
	action := strings.ToLower(strings.TrimSpace(request.Action))
	if action != "keep" && action != "replace" && action != "remove" {
		Error(c, http.StatusBadRequest, "文章配套包操作无效")
		return
	}

	var promotedID *model.Int64String
	existingDraft := parsePostDraftPayload(post.DraftData)
	if action == "replace" {
		if request.PackageID == nil || *request.PackageID == 0 {
			Error(c, http.StatusBadRequest, "请选择已经确认的文章配套包")
			return
		}
		promoted, promoteErr := currentArticlePackageService().Promote(
			c.Request.Context(), post.AuthorID, *request.PackageID, post.ID,
		)
		if promoteErr != nil {
			Error(c, http.StatusBadRequest, promoteErr.Error())
			return
		}
		promotedID = &promoted.ID
	}

	if post.Status == "published" {
		draft := newPostDraftPayloadFromPost(&post)
		if existing := parsePostDraftPayload(post.DraftData); existing != nil {
			draft = *existing
		}
		draft.ArticlePackageAction = action
		draft.ArticlePackageID = promotedID
		now := time.Now()
		if err := database.DB.Model(&post).Updates(map[string]any{
			"draft_data": encodePostDraftPayload(draft), "draft_updated_at": &now,
		}).Error; err != nil {
			Error(c, http.StatusInternalServerError, "保存文章配套包修改失败")
			return
		}
	} else {
		updates := map[string]any{}
		var previousPackageID *model.Int64String
		if post.ArticlePackageID != nil {
			value := *post.ArticlePackageID
			previousPackageID = &value
		}
		switch action {
		case "replace":
			updates["article_package_id"] = *promotedID
		case "remove":
			updates["article_package_id"] = nil
		}
		if len(updates) > 0 {
			if err := database.DB.Model(&post).Updates(updates).Error; err != nil {
				Error(c, http.StatusInternalServerError, "保存文章配套包修改失败")
				return
			}
			if previousPackageID != nil && *previousPackageID != 0 &&
				(action == "remove" || promotedID == nil || *previousPackageID != *promotedID) {
				_ = currentArticlePackageService().ScheduleDelete(
					c.Request.Context(), *previousPackageID, time.Now().Add(10*time.Minute),
				)
			}
		}
	}
	if existingDraft != nil && existingDraft.ArticlePackageAction == "replace" && existingDraft.ArticlePackageID != nil &&
		(action != "replace" || promotedID == nil || *existingDraft.ArticlePackageID != *promotedID) {
		_ = currentArticlePackageService().ScheduleDelete(
			c.Request.Context(), *existingDraft.ArticlePackageID, time.Now().Add(10*time.Minute),
		)
	}
	Success(c, gin.H{"action": action, "packageId": promotedID})
}

func GetPublicArticlePackage(c *gin.Context) {
	post, ok := loadPostForArticlePackage(c)
	if !ok {
		return
	}
	if post.ArticlePackageID == nil || *post.ArticlePackageID == 0 {
		Error(c, http.StatusNotFound, "这篇文章没有配套包")
		return
	}
	summary, err := currentArticlePackageService().GetSummary(c.Request.Context(), *post.ArticlePackageID)
	if err != nil || summary.Status != articlepackage.StatusBound {
		Error(c, http.StatusNotFound, "文章配套包不存在")
		return
	}
	Success(c, summary)
}

func PreviewPublicArticlePackageFile(c *gin.Context) {
	post, ok := loadPostForArticlePackage(c)
	if !ok {
		return
	}
	if post.ArticlePackageID == nil || *post.ArticlePackageID == 0 {
		Error(c, http.StatusNotFound, "这篇文章没有配套包")
		return
	}
	writeArticlePackagePreview(c, *post.ArticlePackageID)
}

func PreviewAdminArticlePackageFile(c *gin.Context) {
	userID, _, ok := currentUser(c)
	if !ok {
		Error(c, http.StatusUnauthorized, "请先登录")
		return
	}
	packageID, valid := articlePackageIDParam(c)
	if !valid {
		return
	}
	if _, err := currentArticlePackageService().GetOwnedSummary(c.Request.Context(), model.Int64String(userID), packageID); err != nil {
		Error(c, http.StatusNotFound, "文章配套包不存在")
		return
	}
	writeArticlePackagePreview(c, packageID)
}

func DownloadPublicArticlePackage(c *gin.Context) {
	post, ok := loadPostForArticlePackage(c)
	if !ok {
		return
	}
	if post.ArticlePackageID == nil || *post.ArticlePackageID == 0 {
		Error(c, http.StatusNotFound, "这篇文章没有配套包")
		return
	}
	url, err := currentArticlePackageService().SignDownload(c.Request.Context(), *post.ArticlePackageID)
	if err != nil {
		Error(c, http.StatusNotFound, "文章配套包暂时无法下载")
		return
	}
	if err := database.DB.Model(&model.Post{}).Where("id = ?", post.ID).
		UpdateColumn("package_download_count", gorm.Expr("package_download_count + 1")).Error; err != nil {
		Error(c, http.StatusInternalServerError, "生成下载链接失败")
		return
	}
	Success(c, gin.H{"url": url, "expiresAt": time.Now().Add(articlepackage.DownloadTicketTTL)})
}

func loadPostForArticlePackage(c *gin.Context) (model.Post, bool) {
	postID, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil || postID <= 0 {
		Error(c, http.StatusBadRequest, "文章编号无效")
		return model.Post{}, false
	}
	var post model.Post
	if err := database.DB.Where("id = ? AND status = ? AND deleted_at IS NULL", postID, "published").First(&post).Error; err != nil {
		Error(c, http.StatusNotFound, "文章不存在")
		return model.Post{}, false
	}
	if post.Visibility != visibilityPublic && !canManagePost(c, post.AuthorID) {
		Error(c, http.StatusNotFound, "文章不存在")
		return model.Post{}, false
	}
	return post, true
}

func writeArticlePackagePreview(c *gin.Context, packageID model.Int64String) {
	filePath := strings.TrimSpace(c.Query("path"))
	if filePath == "" {
		Error(c, http.StatusBadRequest, "请选择要预览的文件")
		return
	}
	preview, err := currentArticlePackageService().Preview(c.Request.Context(), packageID, filePath)
	if err != nil {
		Error(c, http.StatusBadRequest, err.Error())
		return
	}
	c.Header("X-Robots-Tag", "noindex, nofollow, nosnippet")
	c.Header("Content-Security-Policy", "default-src 'none'; sandbox")
	c.Header("Cache-Control", "private, max-age=60")
	c.Data(http.StatusOK, preview.MediaType, preview.Content)
}

func articlePackageIDParam(c *gin.Context) (model.Int64String, bool) {
	value, err := strconv.ParseInt(c.Param("packageId"), 10, 64)
	if err != nil || value <= 0 {
		Error(c, http.StatusBadRequest, "文章配套包编号无效")
		return 0, false
	}
	return model.Int64String(value), true
}

// RunArticlePackageCleanup is intentionally small so bootstrap can invoke it
// from a ticker without coupling cleanup policy to HTTP handlers.
func RunArticlePackageCleanup(ctx context.Context) (int, error) {
	return currentArticlePackageService().CleanupExpired(ctx, 100)
}

var articlePackageCleanupOnce sync.Once

func StartArticlePackageCleanupWorker(ctx context.Context) {
	if database.DB == nil || utils.GetTOSUploader() == nil {
		return
	}
	articlePackageCleanupOnce.Do(func() {
		go func() {
			run := func() {
				if deleted, err := RunArticlePackageCleanup(ctx); err != nil {
					log.Printf("文章配套包清理失败: %v", err)
				} else if deleted > 0 {
					log.Printf("已清理 %d 个过期文章配套包", deleted)
				}
			}
			run()
			ticker := time.NewTicker(time.Hour)
			defer ticker.Stop()
			for {
				select {
				case <-ctx.Done():
					return
				case <-ticker.C:
					run()
				}
			}
		}()
	})
}
