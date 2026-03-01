package handler

import (
	"github.com/gin-gonic/gin"
)

// GetStats 获取统计数据
func GetStats(c *gin.Context) {
	Success(c, gin.H{
		"userCount":     1234,
		"creatorCount":  56,
		"resourceCount": 892,
		"downloadCount": 12580,
	})
}
