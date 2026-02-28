package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// Response 统一响应结构
type Response struct {
	Code    int         `json:"code"`
	Message string      `json:"message"`
	Data    interface{} `json:"data,omitempty"`
}

func Success(c *gin.Context, data interface{}) {
	c.JSON(http.StatusOK, Response{
		Code:    0,
		Message: "success",
		Data:    data,
	})
}

func Error(c *gin.Context, code int, message string) {
	c.JSON(http.StatusOK, Response{
		Code:    code,
		Message: message,
	})
}

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

// GetStats 获取统计数据
func GetStats(c *gin.Context) {
	Success(c, gin.H{
		"userCount":     1234,
		"creatorCount":  56,
		"resourceCount": 892,
		"downloadCount": 12580,
	})
}

// ListUsers 用户列表
func ListUsers(c *gin.Context) {
	Success(c, gin.H{
		"list":  []gin.H{},
		"total": 0,
	})
}

// UpdateUserStatus 更新用户状态
func UpdateUserStatus(c *gin.Context) {
	Success(c, nil)
}

// ListCreators 创作者列表
func ListCreators(c *gin.Context) {
	Success(c, gin.H{
		"list":  []gin.H{},
		"total": 0,
	})
}

// CreateCreator 创建创作者
func CreateCreator(c *gin.Context) {
	Success(c, gin.H{"id": "1"})
}

// UpdateCreator 更新创作者
func UpdateCreator(c *gin.Context) {
	Success(c, nil)
}

// DeleteCreator 删除创作者
func DeleteCreator(c *gin.Context) {
	Success(c, nil)
}

// ListResources 资源列表
func ListResources(c *gin.Context) {
	Success(c, gin.H{
		"list":  []gin.H{},
		"total": 0,
	})
}

// UploadResource 上传资源
func UploadResource(c *gin.Context) {
	Success(c, gin.H{"id": "1", "url": ""})
}

// DeleteResource 删除资源
func DeleteResource(c *gin.Context) {
	Success(c, nil)
}

// ListDownloadRecords 下载记录列表
func ListDownloadRecords(c *gin.Context) {
	Success(c, gin.H{
		"list":  []gin.H{},
		"total": 0,
	})
}

// ListUploadRecords 上传记录列表
func ListUploadRecords(c *gin.Context) {
	Success(c, gin.H{
		"list":  []gin.H{},
		"total": 0,
	})
}
