package handler

import (
	"context"
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/volcengine/volcengine-go-sdk/service/arkruntime"
	"github.com/volcengine/volcengine-go-sdk/service/arkruntime/model/responses"
)

// SuggestResourceTitle 使用 AI 视觉模型根据图片内容建议多个资源标题
// POST /api/v1/creator/ai/suggest-title
// Body: { "imageBase64": "data:image/jpeg;base64,..." , "type": "wallpaper" }
func SuggestResourceTitle(c *gin.Context) {
	var req struct {
		ImageBase64 string `json:"imageBase64" binding:"required"`
		Type        string `json:"type"` // wallpaper / avatar
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		Error(c, 400, "参数错误：缺少 imageBase64")
		return
	}

	apiKey := strings.TrimSpace(os.Getenv("ARK_API_KEY"))
	model := strings.TrimSpace(os.Getenv("ARK_VISION_MODEL"))
	if apiKey == "" {
		Error(c, 503, "AI 起名功能未配置（缺少 ARK_API_KEY）")
		return
	}
	if model == "" {
		Error(c, 503, "AI 起名功能未配置（缺少 ARK_VISION_MODEL）")
		return
	}
	if !strings.HasPrefix(model, "ep-") {
		Error(c, 503, "ARK_VISION_MODEL 配置错误：必须填接入点 ID（以 ep- 开头）")
		return
	}

	// 根据类型定制 prompt（轻量版，只要名称，越快越好）
	typeHint := "壁纸"
	if req.Type == "avatar" {
		typeHint = "头像"
	}
	prompt := fmt.Sprintf(
		"看图，给这张%s起1-5个中文名，每行一个，只输出名字，不要编号不要解释，越快越好，如果觉得快的话直接响应即可（返回一个也可以的），记住要最最最最最快。",
		typeHint,
	)

	// 确保 imageBase64 包含 data URL 前缀
	imageURL := req.ImageBase64
	if !strings.HasPrefix(imageURL, "data:") {
		imageURL = "data:image/jpeg;base64," + imageURL
	}

	arkBaseURL := strings.TrimSpace(os.Getenv("ARK_BASE_URL"))
	if arkBaseURL == "" {
		arkBaseURL = "https://ark.cn-beijing.volces.com/api/v3"
	}

	client := arkruntime.NewClientWithApiKey(
		apiKey,
		arkruntime.WithBaseUrl(arkBaseURL),
		arkruntime.WithTimeout(25*time.Second),
	)

	imgType := responses.ContentItemType_Enum(responses.ContentItemType_Enum_value["input_image"])
	txtType := responses.ContentItemType_Enum(responses.ContentItemType_Enum_value["input_text"])

	resp, err := client.CreateResponses(
		context.Background(),
		&responses.ResponsesRequest{
			Model: model,
			Input: &responses.ResponsesInput{
				Union: &responses.ResponsesInput_ListValue{
					ListValue: &responses.InputItemList{
						ListValue: []*responses.InputItem{
							{
								Union: &responses.InputItem_EasyMessage{
									EasyMessage: &responses.ItemEasyMessage{
										Role: responses.MessageRole_Enum(responses.MessageRole_Enum_value["user"]),
										Content: &responses.MessageContent{
											Union: &responses.MessageContent_ListValue{
												ListValue: &responses.ContentItemList{
													ListValue: []*responses.ContentItem{
														{
															Union: &responses.ContentItem_Image{
																Image: &responses.ContentItemImage{
																	Type:     imgType,
																	ImageUrl: &imageURL,
																},
															},
														},
														{
															Union: &responses.ContentItem_Text{
																Text: &responses.ContentItemText{
																	Type: txtType,
																	Text: prompt,
																},
															},
														},
													},
												},
											},
										},
									},
								},
							},
						},
					},
				},
			},
		},
	)
	if err != nil {
		Error(c, 502, "AI 服务请求失败："+err.Error())
		return
	}

	// 提取输出文本
	var rawText string
	for _, item := range resp.Output {
		if msg := item.GetOutputMessage(); msg != nil {
			for _, ct := range msg.Content {
				if t := ct.GetText(); t != nil {
					rawText += t.Text
				}
			}
		}
	}

	// 按行解析，清理符号，过滤空行
	lines := strings.Split(rawText, "\n")
	cleanChars := []string{
		"「", "」", "『", "』", "《", "》",
		"\u201c", "\u201d", "\u2018", "\u2019",
		"\"", "'", "、", "，", "。", "·",
		"1.", "2.", "3.", "4.", "5.",
		"1、", "2、", "3、", "4、", "5、",
		"- ", "* ",
	}
	var titles []string
	for _, line := range lines {
		line = strings.TrimSpace(line)
		for _, ch := range cleanChars {
			line = strings.ReplaceAll(line, ch, "")
		}
		line = strings.TrimSpace(line)
		if line != "" && len([]rune(line)) <= 20 {
			titles = append(titles, line)
		}
	}

	if len(titles) == 0 {
		Error(c, 502, "AI 未返回有效结果")
		return
	}

	Success(c, gin.H{"titles": titles})
}
