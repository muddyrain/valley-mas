package handler

import (
	"github.com/gin-gonic/gin"
)

// ListDownloadRecords 下载记录列表
// @Summary      获取下载记录
// @Description  管理员查看所有下载记录
// @Tags         管理后台 - 记录管理
// @Accept       json
// @Produce      json
// @Security     Bearer
// @Param        page      query  int  false  "页码"  default(1)
// @Param        pageSize  query  int  false  "每页数量"  default(20)
// @Success      200  {object}  map[string]interface{}  "下载记录列表"
// @Failure      401  {object}  map[string]interface{}  "未登录"
// @Failure      403  {object}  map[string]interface{}  "无权限"
// @Router       /admin/records/downloads [get]
func ListDownloadRecords(c *gin.Context) {
	// TODO: 实现下载记录查询
	Success(c, gin.H{
		"list":  []gin.H{},
		"total": 0,
	})
}

// ListUploadRecords 上传记录列表
// @Summary      获取上传记录
// @Description  管理员查看所有上传记录
// @Tags         管理后台 - 记录管理
// @Accept       json
// @Produce      json
// @Security     Bearer
// @Param        page      query  int  false  "页码"  default(1)
// @Param        pageSize  query  int  false  "每页数量"  default(20)
// @Success      200  {object}  map[string]interface{}  "上传记录列表"
// @Failure      401  {object}  map[string]interface{}  "未登录"
// @Failure      403  {object}  map[string]interface{}  "无权限"
// @Router       /admin/records/uploads [get]
func ListUploadRecords(c *gin.Context) {
	// TODO: 实现上传记录查询
	Success(c, gin.H{
		"list":  []gin.H{},
		"total": 0,
	})
}
