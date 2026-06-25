package lifetrace

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"time"
	"valley-server/internal/utils"

	"github.com/gin-gonic/gin"
)

const recipeVideoRenderTimeoutSeconds = 120

type recipeVideoRenderRequest struct {
	RecipeID string `json:"recipeId" binding:"required"`
}

type recipeVideoRenderResponse struct {
	URL       string `json:"url"`
	ExpiresAt string `json:"expiresAt"`
}

var uploadRecipeVideoToTOS = func(
	ctx context.Context,
	userID string,
	recipeID string,
	videoBytes []byte,
) (string, error) {
	uploader := utils.GetTOSUploader()
	if uploader == nil {
		return "", fmt.Errorf("视频上传服务未配置")
	}

	storagePath := fmt.Sprintf("life-trace/%s/recipe-videos/%s_%s.mp4",
		userID, recipeID, time.Now().Format("20060102_150405"))

	url, err := uploader.UploadBytesWithPathContext(ctx, storagePath, videoBytes)
	if err != nil {
		return "", err
	}

	return url, nil
}

func (h *Handler) RenderRecipeVideo(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, apiResponse{Code: http.StatusUnauthorized, Message: "未登录"})
		return
	}

	var req recipeVideoRenderRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, apiResponse{Code: http.StatusBadRequest, Message: "请求内容不正确"})
		return
	}

	// TODO: 后续集成 HyperFrames 时，这里需要：
	// 1. 从数据库/缓存获取菜谱详情
	// 2. 调用 AI 生成 HyperFrames HTML
	// 3. 渲染 MP4 并上传 TOS
	// 当前暂时返回占位响应，供前端验证流程

	uploadedURL, uploadErr := uploadRecipeVideoToTOS(
		c.Request.Context(),
		userID.String(),
		req.RecipeID,
		[]byte("placeholder-video-content"),
	)
	if uploadErr != nil {
		status := http.StatusBadGateway
		if strings.Contains(uploadErr.Error(), "未配置") || strings.Contains(uploadErr.Error(), "not initialized") {
			status = http.StatusServiceUnavailable
		}
		c.JSON(status, apiResponse{Code: status, Message: "视频上传失败：" + uploadErr.Error()})
		return
	}

	expiresAt := time.Now().Add(7 * 24 * time.Hour)
	success(c, recipeVideoRenderResponse{
		URL:       uploadedURL,
		ExpiresAt: expiresAt.Format(time.RFC3339),
	})
}

func buildRecipeVideoHTMLPrompt(req recipeVideoRenderRequest) string {
	return fmt.Sprintf(`你是 Life Trace 菜谱视频生成器。把菜谱转换为 HyperFrames 风格的 HTML 视频。

要求：
1. 输出完整的 HTML 文档，包含 <!DOCTYPE html>
2. 视频时长 30 秒以内，9:16 竖屏比例（720x1280）
3. 每道菜展示菜名、推荐理由、所需食材
4. 步骤用大字体逐条展示，每条停留 5-8 秒
5. 使用 GSAP 做淡入/滑入动画，palette: #0a0a0a (bg), #fafafa (text), #10b981 (accent)`)
}

var renderRecipeVideoMP4 = func(ctx context.Context, html string) ([]byte, error) {
	// TODO: 集成 HyperFrames CLI 渲染
	// npx hyperframes render --input <html> --output video.mp4
	return nil, fmt.Errorf("HyperFrames 渲染未实现")
}
