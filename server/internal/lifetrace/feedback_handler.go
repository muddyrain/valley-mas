package lifetrace

import (
	"net/http"
	"strings"
	"valley-server/internal/database"
	"valley-server/internal/model"

	"github.com/gin-gonic/gin"
)

const (
	defaultFeedbackApp       = "life-trace"
	maxFeedbackContentLength = 2000
	maxFeedbackImageCount    = 9
	maxFeedbackImageURLBytes = 800
)

type createFeedbackRequest struct {
	App       string   `json:"app"`
	Content   string   `json:"content"`
	ImageURLs []string `json:"imageUrls"`
}

func (h *Handler) CreateFeedback(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		fail(c, http.StatusUnauthorized, "未登录")
		return
	}

	var req createFeedbackRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		fail(c, http.StatusBadRequest, "参数错误")
		return
	}

	content := strings.TrimSpace(req.Content)
	if content == "" {
		fail(c, http.StatusBadRequest, "请填写反馈内容")
		return
	}
	if len([]rune(content)) > maxFeedbackContentLength {
		fail(c, http.StatusBadRequest, "反馈内容不能超过 2000 个字")
		return
	}

	imageURLs, validImages := normalizeFeedbackImageURLs(req.ImageURLs)
	if !validImages {
		fail(c, http.StatusBadRequest, "反馈图片最多 9 张，且必须是有效图片地址")
		return
	}

	feedback := model.LifeTraceFeedback{
		UserID:    userID,
		App:       normalizeFeedbackApp(req.App),
		Content:   content,
		ImageURLs: model.StringList(imageURLs),
	}

	if err := database.DB.Create(&feedback).Error; err != nil {
		fail(c, http.StatusInternalServerError, "反馈提交失败，请稍后再试")
		return
	}

	success(c, feedback)
}

func normalizeFeedbackApp(app string) string {
	app = strings.TrimSpace(app)
	if app == "" {
		return defaultFeedbackApp
	}
	if len(app) > 60 {
		return app[:60]
	}
	return app
}

func normalizeFeedbackImageURLs(rawURLs []string) ([]string, bool) {
	if len(rawURLs) > maxFeedbackImageCount {
		return nil, false
	}

	urls := make([]string, 0, len(rawURLs))
	seen := make(map[string]bool, len(rawURLs))
	for _, rawURL := range rawURLs {
		url := strings.TrimSpace(rawURL)
		if url == "" || seen[url] {
			continue
		}
		if len(url) > maxFeedbackImageURLBytes {
			return nil, false
		}
		if !strings.HasPrefix(url, "http://") &&
			!strings.HasPrefix(url, "https://") &&
			!strings.HasPrefix(url, "/") {
			return nil, false
		}
		seen[url] = true
		urls = append(urls, url)
	}
	return urls, true
}
