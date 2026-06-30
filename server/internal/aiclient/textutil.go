package aiclient

import (
	"errors"
	"strings"

	arkmodel "github.com/volcengine/volcengine-go-sdk/service/arkruntime/model"
)

// TrimRunes 按 rune 长度裁剪字符串，max <= 0 时只做 TrimSpace。
func TrimRunes(text string, max int) string {
	t := strings.TrimSpace(text)
	if max <= 0 {
		return t
	}
	runes := []rune(t)
	if len(runes) <= max {
		return t
	}
	return string(runes[:max])
}

// NormalizeOutput 清理 AI 生成的短文本输出：去除常见前缀、合并空白、剥离引号。
// 用于摘要/标题/封面 prompt 等单行输出场景。
func NormalizeOutput(raw string) string {
	text := strings.TrimSpace(raw)
	for _, prefix := range []string{"Summary:", "summary:", "Cover prompt:", "cover prompt:"} {
		text = strings.TrimPrefix(text, prefix)
	}
	text = strings.ReplaceAll(text, "\n", " ")
	text = strings.Join(strings.Fields(text), " ")
	text = strings.Trim(text, "\"' ")
	return text
}

// NormalizeImageInput 归一化图像输入：
//   - http(s) URL / data URL：原样返回；
//   - 其他认为是裸 base64：补 data:image/jpeg;base64, 前缀。
func NormalizeImageInput(raw string) string {
	imageURL := strings.TrimSpace(raw)
	lower := strings.ToLower(imageURL)
	if strings.HasPrefix(lower, "http://") ||
		strings.HasPrefix(lower, "https://") ||
		strings.HasPrefix(lower, "data:") {
		return imageURL
	}
	return "data:image/jpeg;base64," + imageURL
}

// ExtractARKMessageText 从 ARK ChatCompletionMessage 提取纯文本：
// StringValue 直接返回；ListValue 拼接非空 text part；都没有则返回空串。
func ExtractARKMessageText(message *arkmodel.ChatCompletionMessage) string {
	if message == nil || message.Content == nil {
		return ""
	}
	if message.Content.StringValue != nil {
		return strings.TrimSpace(*message.Content.StringValue)
	}
	if len(message.Content.ListValue) == 0 {
		return ""
	}
	parts := make([]string, 0, len(message.Content.ListValue))
	for _, item := range message.Content.ListValue {
		if item == nil || strings.TrimSpace(item.Text) == "" {
			continue
		}
		parts = append(parts, strings.TrimSpace(item.Text))
	}
	return strings.TrimSpace(strings.Join(parts, "\n"))
}

// ExtractARKContent 从 ARK ChatCompletionResponse 提取 Choices[0] 的文本内容；
// 空响应或全空白返回 error。
func ExtractARKContent(resp arkmodel.ChatCompletionResponse) (string, error) {
	if len(resp.Choices) == 0 || resp.Choices[0].Message.Content == nil {
		return "", errors.New("empty AI response")
	}
	contentValue := resp.Choices[0].Message.Content
	if contentValue.StringValue != nil {
		raw := strings.TrimSpace(*contentValue.StringValue)
		if raw == "" {
			return "", errors.New("empty AI content")
		}
		return raw, nil
	}
	parts := make([]string, 0, len(contentValue.ListValue))
	for _, part := range contentValue.ListValue {
		if part != nil && strings.TrimSpace(part.Text) != "" {
			parts = append(parts, strings.TrimSpace(part.Text))
		}
	}
	raw := strings.TrimSpace(strings.Join(parts, "\n"))
	if raw == "" {
		return "", errors.New("empty AI content")
	}
	return raw, nil
}
