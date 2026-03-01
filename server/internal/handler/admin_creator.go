package handler

import (
	"github.com/gin-gonic/gin"
)

// ListCreators 创作者列表
// @Summary      获取创作者列表
// @Description  管理员查看所有创作者列表
// @Tags         管理后台 - 创作者管理
// @Accept       json
// @Produce      json
// @Security     Bearer
// @Param        page      query  int  false  "页码"  default(1)
// @Param        pageSize  query  int  false  "每页数量"  default(20)
// @Success      200  {object}  map[string]interface{}  "创作者列表"
// @Failure      401  {object}  map[string]interface{}  "未登录"
// @Failure      403  {object}  map[string]interface{}  "无权限"
// @Router       /admin/creators [get]
func ListCreators(c *gin.Context) {
	// TODO: 实现创作者列表查询
	Success(c, gin.H{
		"list":  []gin.H{},
		"total": 0,
	})
}

// CreateCreator 创建创作者
// @Summary      创建创作者（管理员）
// @Description  管理员为用户创建创作者身份
// @Tags         管理后台 - 创作者管理
// @Accept       json
// @Produce      json
// @Security     Bearer
// @Param        creator  body  object  true  "创作者信息"
// @Success      200  {object}  map[string]interface{}  "创建成功"
// @Failure      401  {object}  map[string]interface{}  "未登录"
// @Failure      403  {object}  map[string]interface{}  "无权限"
// @Router       /admin/creators [post]
func CreateCreator(c *gin.Context) {
	// TODO: 实现创建创作者
	Success(c, gin.H{"id": "1"})
}

// UpdateCreator 更新创作者
// @Summary      更新创作者信息
// @Description  管理员更新创作者信息
// @Tags         管理后台 - 创作者管理
// @Accept       json
// @Produce      json
// @Security     Bearer
// @Param        id       path  string  true  "创作者ID"
// @Param        creator  body  object  true  "创作者信息"
// @Success      200  {object}  map[string]interface{}  "更新成功"
// @Failure      401  {object}  map[string]interface{}  "未登录"
// @Failure      403  {object}  map[string]interface{}  "无权限"
// @Router       /admin/creators/{id} [put]
func UpdateCreator(c *gin.Context) {
	// TODO: 实现更新创作者
	Success(c, nil)
}

// DeleteCreator 删除创作者
// @Summary      删除创作者
// @Description  管理员删除创作者
// @Tags         管理后台 - 创作者管理
// @Accept       json
// @Produce      json
// @Security     Bearer
// @Param        id  path  string  true  "创作者ID"
// @Success      200  {object}  map[string]interface{}  "删除成功"
// @Failure      401  {object}  map[string]interface{}  "未登录"
// @Failure      403  {object}  map[string]interface{}  "无权限"
// @Router       /admin/creators/{id} [delete]
func DeleteCreator(c *gin.Context) {
	// TODO: 实现删除创作者
	Success(c, nil)
}
