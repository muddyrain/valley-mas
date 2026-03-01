package handler

import (
	"github.com/gin-gonic/gin"
)

// VerifyCode 验证口令
func VerifyCode(c *gin.Context) {
	var req struct {
		Code string `json:"code" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		Error(c, 400, "参数错误")
		return
	}

	// TODO: 查询数据库验证口令
	// creator, err := service.VerifyCode(req.Code)

	Success(c, gin.H{
		"valid": true,
		"creator": gin.H{
			"id":          "1",
			"name":        "设计师小王",
			"description": "分享精美头像和壁纸",
		},
	})
}

// GetCreatorResources 获取创作者资源列表
func GetCreatorResources(c *gin.Context) {
	code := c.Param("code")
	resourceType := c.Query("type") // avatar, wallpaper, 空则全部
	page := c.DefaultQuery("page", "1")
	pageSize := c.DefaultQuery("pageSize", "20")

	_ = code
	_ = resourceType
	_ = page
	_ = pageSize

	// TODO: 查询数据库

	Success(c, gin.H{
		"list": []gin.H{
			{
				"id":            "1",
				"title":         "可爱卡通头像",
				"type":          "avatar",
				"url":           "https://placeholder.co/400x400",
				"size":          102400,
				"downloadCount": 128,
			},
		},
		"total":      1,
		"page":       1,
		"pageSize":   20,
		"totalPages": 1,
	})
}
