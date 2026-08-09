package handler

import (
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"valley-server/internal/database"
	"valley-server/internal/model"

	"github.com/gin-gonic/gin"
)

// ListAIAppOutputs returns owner-private files and generated images produced by
// one agent across all of its conversations.
func ListAIAppOutputs(c *gin.Context) {
	userID, ok := currentAIAppUser(c)
	if !ok {
		return
	}
	app, found := findAIApp(c, userID)
	if !found {
		return
	}

	var artifacts []model.AIAppArtifact
	if err := database.GetDB().Where("user_id = ? AND app_id = ?", userID, app.ID).Order("created_at DESC").Limit(100).Find(&artifacts).Error; err != nil {
		Error(c, http.StatusInternalServerError, "加载智能体文件失败")
		return
	}

	var messages []model.AIAppConversationMessage
	if err := database.GetDB().Select("image_generation_ids").Where("user_id = ? AND app_id = ? AND image_generation_ids <> ?", userID, app.ID, "[]").Order("created_at DESC").Limit(300).Find(&messages).Error; err != nil {
		Error(c, http.StatusInternalServerError, "加载智能体图片失败")
		return
	}
	seen := map[model.Int64String]struct{}{}
	ids := make([]model.Int64String, 0)
	for _, message := range messages {
		var values []model.Int64String
		if json.Unmarshal([]byte(message.ImageGenerationIDs), &values) != nil {
			continue
		}
		for _, id := range values {
			if id == 0 {
				continue
			}
			if _, exists := seen[id]; exists {
				continue
			}
			seen[id] = struct{}{}
			ids = append(ids, id)
		}
	}
	images := make([]model.AIImageGeneration, 0)
	if len(ids) > 0 {
		if err := database.GetDB().Where("user_id = ? AND id IN ? AND status = ?", userID, ids, "succeeded").Order("created_at DESC").Find(&images).Error; err != nil {
			Error(c, http.StatusInternalServerError, "加载智能体图片失败")
			return
		}
	}
	Success(c, gin.H{"artifacts": artifacts, "images": images})
}

// GetAIAppArtifactDownloadURL releases the backing object URL only after an
// owner and expiry check. Artifact list responses never expose this URL.
func GetAIAppArtifactDownloadURL(c *gin.Context) {
	userID, ok := currentAIAppUser(c)
	if !ok {
		return
	}
	app, found := findAIApp(c, userID)
	if !found {
		return
	}
	artifactID, err := parsePathInt64(c, "artifactId")
	if err != nil {
		Error(c, http.StatusBadRequest, "无效的成果文件 ID")
		return
	}
	var artifact model.AIAppArtifact
	if err := database.GetDB().Where("id = ? AND user_id = ? AND app_id = ?", artifactID, userID, app.ID).First(&artifact).Error; err != nil {
		Error(c, http.StatusNotFound, "成果文件不存在")
		return
	}
	if artifact.IsExpired(time.Now()) {
		Error(c, http.StatusGone, "成果文件已过期")
		return
	}
	if strings.TrimSpace(artifact.URL) == "" {
		Error(c, http.StatusNotFound, "成果文件不存在")
		return
	}
	Success(c, gin.H{"url": artifact.URL, "expiresAt": artifact.ExpiresAt})
}
