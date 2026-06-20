package handler

import (
	"net/http"
	"strings"
	"valley-server/internal/database"
	"valley-server/internal/model"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

const maxPreferenceValueBytes = 64 * 1024

type userPreferenceRequest struct {
	Value string `json:"value"`
}

func GetUserPreference(c *gin.Context) {
	db := database.GetDB()
	userID := model.Int64String(GetCurrentUserID(c))
	namespace := normalizePreferenceNamespace(c.Param("namespace"))
	if userID == 0 {
		Error(c, http.StatusUnauthorized, "未登录")
		return
	}
	if namespace == "" {
		Error(c, http.StatusBadRequest, "偏好命名空间不能为空")
		return
	}

	var preference model.UserPreference
	if err := db.Where("user_id = ? AND namespace = ?", userID, namespace).First(&preference).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			Error(c, http.StatusNotFound, "偏好不存在")
			return
		}
		Error(c, http.StatusInternalServerError, "查询偏好失败")
		return
	}

	Success(c, preference)
}

func UpsertUserPreference(c *gin.Context) {
	db := database.GetDB()
	userID := model.Int64String(GetCurrentUserID(c))
	namespace := normalizePreferenceNamespace(c.Param("namespace"))
	if userID == 0 {
		Error(c, http.StatusUnauthorized, "未登录")
		return
	}
	if namespace == "" {
		Error(c, http.StatusBadRequest, "偏好命名空间不能为空")
		return
	}

	var req userPreferenceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		Error(c, http.StatusBadRequest, "参数错误")
		return
	}
	if strings.TrimSpace(req.Value) == "" {
		Error(c, http.StatusBadRequest, "偏好内容不能为空")
		return
	}
	if len(req.Value) > maxPreferenceValueBytes {
		Error(c, http.StatusBadRequest, "偏好内容过大")
		return
	}

	var preference model.UserPreference
	err := db.Where("user_id = ? AND namespace = ?", userID, namespace).First(&preference).Error
	if err != nil && err != gorm.ErrRecordNotFound {
		Error(c, http.StatusInternalServerError, "保存偏好失败")
		return
	}

	if err == gorm.ErrRecordNotFound {
		preference = model.UserPreference{
			UserID:    userID,
			Namespace: namespace,
			Value:     req.Value,
		}
		if err := db.Create(&preference).Error; err != nil {
			Error(c, http.StatusInternalServerError, "保存偏好失败")
			return
		}
		Success(c, preference)
		return
	}

	if err := db.Model(&preference).Update("value", req.Value).Error; err != nil {
		Error(c, http.StatusInternalServerError, "保存偏好失败")
		return
	}
	if err := db.Where("id = ?", preference.ID).First(&preference).Error; err != nil {
		Error(c, http.StatusInternalServerError, "读取偏好失败")
		return
	}
	Success(c, preference)
}

func normalizePreferenceNamespace(value string) string {
	return strings.TrimSpace(value)
}
