package handler

import (
	"github.com/gin-gonic/gin"
)

// ListDownloadRecords 下载记录列表
func ListDownloadRecords(c *gin.Context) {
	// TODO: 实现下载记录查询
	Success(c, gin.H{
		"list":  []gin.H{},
		"total": 0,
	})
}

// ListUploadRecords 上传记录列表
func ListUploadRecords(c *gin.Context) {
	// TODO: 实现上传记录查询
	Success(c, gin.H{
		"list":  []gin.H{},
		"total": 0,
	})
}
