package handler

import (
	"net/http"
	"strconv"
	"strings"

	"valley-server/internal/database"
	"valley-server/internal/lifetrace/ai/prompts"
	"valley-server/internal/model"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type blogAIPickCoverRequest struct {
	Title       string   `json:"title"`
	Excerpt     string   `json:"excerpt"`
	Content     string   `json:"content" binding:"required"`
	ExcludedIDs []string `json:"excludedIds"`
}

// AdminAIPickBlogCoverFromResources 从公用壁纸池里根据博客内容挑一张封面。
// POST /admin/blog/ai/cover/pick
func AdminAIPickBlogCoverFromResources(c *gin.Context) {
	_, role, ok := currentUser(c)
	if !ok {
		Error(c, http.StatusUnauthorized, "unauthorized")
		return
	}
	if role != "admin" && role != "creator" {
		Error(c, http.StatusForbidden, "creator required")
		return
	}

	var req blogAIPickCoverRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		Error(c, http.StatusBadRequest, "invalid request: "+err.Error())
		return
	}

	content := strings.TrimSpace(req.Content)
	if content == "" {
		Error(c, http.StatusBadRequest, "content cannot be empty")
		return
	}

	db := database.GetDB()
	if db == nil {
		Error(c, http.StatusServiceUnavailable, "database is not initialized")
		return
	}

	title := strings.TrimSpace(req.Title)
	excerpt := strings.TrimSpace(req.Excerpt)

	// Step 1: 通过 LLM 抽视觉主体关键词；任何环节失败都不阻塞主流程。
	usedModel := ""
	keywords, modelName := extractBlogCoverKeywords(req)
	if len(keywords) > 0 {
		usedModel = modelName
	}

	// Step 2: 关键词匹配查询（title / tag name 双维度）。
	resource, err := pickBlogCoverResource(db, keywords, req.ExcludedIDs, blogCoverPickModeKeywords)
	if err != nil {
		Error(c, http.StatusInternalServerError, "pick cover failed: "+err.Error())
		return
	}

	// Step 3 兜底 A：命中 0 → 仅用 title 关键字重查（若有 title）。
	if resource == nil && title != "" {
		titleKeywords := splitTitleFallbackKeywords(title)
		if len(titleKeywords) > 0 {
			resource, err = pickBlogCoverResource(db, titleKeywords, req.ExcludedIDs, blogCoverPickModeKeywords)
			if err != nil {
				Error(c, http.StatusInternalServerError, "pick cover failed: "+err.Error())
				return
			}
			if resource != nil && len(keywords) == 0 {
				keywords = titleKeywords
			}
		}
	}

	// Step 3 兜底 B：仍然 0 → 完全随机取一张 wallpaper。
	if resource == nil {
		resource, err = pickBlogCoverResource(db, nil, req.ExcludedIDs, blogCoverPickModeRandom)
		if err != nil {
			Error(c, http.StatusInternalServerError, "pick cover failed: "+err.Error())
			return
		}
	}

	if resource == nil {
		Error(c, http.StatusNotFound, "no wallpaper available")
		return
	}

	item := buildHotResourceResponseList(
		[]model.Resource{*resource},
		map[string]bool{},
	)
	if len(item) == 0 {
		Error(c, http.StatusInternalServerError, "failed to serialize resource")
		return
	}

	_ = title
	_ = excerpt

	Success(c, gin.H{
		"resource":        item[0],
		"matchedKeywords": keywords,
		"model":           usedModel,
	})
}

type blogCoverPickMode int

const (
	blogCoverPickModeKeywords blogCoverPickMode = iota
	blogCoverPickModeRandom
)

// pickBlogCoverResource 依据模式在公共壁纸池里挑一条记录；未命中返回 (nil, nil)。
func pickBlogCoverResource(
	db *gorm.DB,
	keywords []string,
	excludedIDs []string,
	mode blogCoverPickMode,
) (*model.Resource, error) {
	q := db.Model(&model.Resource{}).
		Where("resources.deleted_at IS NULL").
		Where(publicVisibilityWhere).
		Where("resources.type = ?", "wallpaper")

	if mode == blogCoverPickModeKeywords {
		cleaned := make([]string, 0, len(keywords))
		for _, k := range keywords {
			k = strings.TrimSpace(k)
			if k != "" {
				cleaned = append(cleaned, k)
			}
		}
		if len(cleaned) == 0 {
			return nil, nil
		}
		likeQ := db.Session(&gorm.Session{NewDB: true})
		for i, k := range cleaned {
			like := "%" + k + "%"
			tagLike := "%\"" + strings.ReplaceAll(k, "\"", "\\\"") + "\"%"
			expr := "resources.title ILIKE ? OR resources.tags LIKE ?"
			if i == 0 {
				likeQ = likeQ.Where(expr, like, tagLike)
			} else {
				likeQ = likeQ.Or(expr, like, tagLike)
			}
		}
		q = q.Where(likeQ)
	}

	if trimmed := trimExcludedIDs(excludedIDs); len(trimmed) > 0 {
		q = q.Where("resources.id NOT IN ?", trimmed)
	}

	orderExpr := randomOrderExpr(db)
	q = applyResourceListQueryShape(q).Order(orderExpr).Limit(1)

	var resources []model.Resource
	if err := q.Find(&resources).Error; err != nil {
		return nil, err
	}
	if len(resources) == 0 {
		return nil, nil
	}
	return &resources[0], nil
}

func randomOrderExpr(db *gorm.DB) string {
	if db == nil || db.Dialector == nil {
		return "RANDOM()"
	}
	switch db.Dialector.Name() {
	case "mysql":
		return "RAND()"
	default:
		return "RANDOM()"
	}
}

func trimExcludedIDs(ids []string) []string {
	out := make([]string, 0, len(ids))
	for _, raw := range ids {
		s := strings.TrimSpace(raw)
		if s == "" {
			continue
		}
		if _, err := strconv.ParseInt(s, 10, 64); err != nil {
			continue
		}
		out = append(out, s)
	}
	return out
}

// splitTitleFallbackKeywords 用简单启发式从 title 里抽 1-3 个候选关键字。
func splitTitleFallbackKeywords(title string) []string {
	title = strings.TrimSpace(title)
	if title == "" {
		return nil
	}
	seen := make(map[string]struct{})
	result := make([]string, 0, 3)
	push := func(s string) {
		s = strings.TrimSpace(s)
		if s == "" {
			return
		}
		if _, dup := seen[s]; dup {
			return
		}
		seen[s] = struct{}{}
		result = append(result, s)
	}
	push(title)
	for _, sep := range []string{" ", "-", "_", "|", "·", ",", "，", "、", ":", "："} {
		if strings.Contains(title, sep) {
			for _, part := range strings.Split(title, sep) {
				push(part)
				if len(result) >= 3 {
					return result
				}
			}
		}
	}
	return result
}

// extractBlogCoverKeywords 调 LLM 抽 3-5 个视觉主体关键词；失败返回空数组不阻塞主流程。
func extractBlogCoverKeywords(req blogAIPickCoverRequest) ([]string, string) {
	apiKey, arkBaseURL, textModel, errMsg := readArkTextModelConfig()
	if errMsg != "" {
		return nil, ""
	}
	client := ensureSharedArkClient(apiKey, arkBaseURL)

	title := truncateAIText(req.Title, 80)
	excerpt := truncateAIText(req.Excerpt, 200)
	content := truncateAIText(req.Content, 2000)

	prompt := prompts.BuildBlogCoverKeywordsPrompt(prompts.BlogCoverKeywordsInput{
		Title:   title,
		Excerpt: excerpt,
		Content: content,
	})

	raw, err := callChatStream(client, textModel, "", prompt, false)
	if err != nil {
		return nil, ""
	}
	out, err := prompts.ParseBlogCoverKeywordsOutput(raw)
	if err != nil {
		return nil, ""
	}
	return out.Keywords, textModel
}
