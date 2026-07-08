package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// VerifyCodeRequest 验证口令请求
type VerifyCodeRequest struct {
	Code string `json:"code" binding:"required" example:"y2722"`
}

// VerifyCodeResponse 验证口令响应
type VerifyCodeResponse struct {
	Valid bool                   `json:"valid" example:"true"`
	User  map[string]interface{} `json:"user"`
}

// VerifyCode 验证口令（公开接口）
// @Summary      验证创作者口令
// @Description  输入口令验证并获取用户空间信息
// @Tags         公开接口
// @Accept       json
// @Produce      json
// @Param        request  body      VerifyCodeRequest  true  "口令"
// @Success      200  {object}  VerifyCodeResponse  "验证成功"
// @Failure      400  {object}  map[string]interface{}  "口令格式错误"
// @Failure      404  {object}  map[string]interface{}  "口令不存在或已关闭"
// @Router       /code/verify [post]
func VerifyCode(c *gin.Context) {
	// 口令功能已随 Creator 模型移除，返回不可用
	Error(c, http.StatusNotFound, "口令功能已下线")
}

// GetUserResources 获取用户资源列表（口令路由兼容）
func GetUserResources(c *gin.Context) {
	// 旧口令路由已废弃，返回不可用
	Error(c, http.StatusNotFound, "该接口已废弃，请使用 /api/v1/public/users/:id/resources")
}
