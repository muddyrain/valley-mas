package handler

import (
	"github.com/gin-gonic/gin"
)

// ListCreators 创作者列表
func ListCreators(c *gin.Context) {
	// TODO: 实现创作者列表查询
	Success(c, gin.H{
		"list":  []gin.H{},
		"total": 0,
	})
}

// CreateCreator 创建创作者
func CreateCreator(c *gin.Context) {
	// TODO: 实现创建创作者
	Success(c, gin.H{"id": "1"})
}

// UpdateCreator 更新创作者
func UpdateCreator(c *gin.Context) {
	// TODO: 实现更新创作者
	Success(c, nil)
}

// DeleteCreator 删除创作者
func DeleteCreator(c *gin.Context) {
	// TODO: 实现删除创作者
	Success(c, nil)
}
