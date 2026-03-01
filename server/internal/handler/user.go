package handler

import (
	"github.com/gin-gonic/gin"
)

// GetUserInfo 获取用户信息
func GetUserInfo(c *gin.Context) {
	// userId := c.GetString("userId")
	Success(c, gin.H{
		"id":       "1",
		"nickname": "用户A",
	})
}

// GetUserDownloads 获取用户下载记录
func GetUserDownloads(c *gin.Context) {
	Success(c, gin.H{
		"list":  []gin.H{},
		"total": 0,
	})
}

// RecordDownload 记录下载
func RecordDownload(c *gin.Context) {
	var req struct {
		ResourceID string `json:"resourceId" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		Error(c, 400, "参数错误")
		return
	}

	// TODO: 记录下载

	Success(c, nil)
}
