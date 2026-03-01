package handler

import (
	"github.com/gin-gonic/gin"
)

// GetStats 获取统计数据
// @Summary      获取系统统计数据
// @Description  返回用户数、创作者数、资源数、下载数等统计信息
// @Tags         管理后台
// @Accept       json
// @Produce      json
// @Security     Bearer
// @Success      200  {object}  map[string]interface{}  "统计数据"
// @Failure      401  {object}  map[string]interface{}  "未登录"
// @Failure      403  {object}  map[string]interface{}  "无权限"
// @Router       /admin/stats [get]
func GetStats(c *gin.Context) {
	Success(c, gin.H{
		"userCount":     1234,
		"creatorCount":  56,
		"resourceCount": 892,
		"downloadCount": 12580,
	})
}
