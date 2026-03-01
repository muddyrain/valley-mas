package handler

import (
	"github.com/gin-gonic/gin"
)

// ListResources 资源列表
func ListResources(c *gin.Context) {
	// TODO: 实现资源列表查询
	Success(c, gin.H{
		"list":  []gin.H{},
		"total": 0,
	})
}

// UploadResource 上传资源
func UploadResource(c *gin.Context) {
	// TODO: 实现资源上传
	Success(c, gin.H{"id": "1", "url": ""})
}

// DeleteResource 删除资源
func DeleteResource(c *gin.Context) {
	// TODO: 实现删除资源
	Success(c, nil)
}
