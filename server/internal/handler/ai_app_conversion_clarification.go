package handler

import (
	"fmt"
	"path/filepath"
	"strings"

	clarificationprotocol "valley-server/internal/ai/clarification"
	documenttool "valley-server/internal/ai/tools/document"
	imagetool "valley-server/internal/ai/tools/image"
	"valley-server/internal/model"
)

func buildAIAppConversionClarification(
	taskID model.Int64String,
	message string,
	attachments []model.AIAppConversationAttachment,
	answers []aiAppClarificationAnswer,
	toolNames []string,
	round int,
) (clarificationprotocol.Request, bool) {
	if !containsString(toolNames, clarificationprotocol.ToolName) ||
		(!containsString(toolNames, imagetool.ConvertToolName) && !containsString(toolNames, documenttool.ToolName)) {
		return clarificationprotocol.Request{}, false
	}

	combined := strings.TrimSpace(message)
	for _, answer := range answers {
		combined += "\n" + strings.TrimSpace(answer.Answer)
	}
	if !looksLikeFileConversionRequest(combined) {
		return clarificationprotocol.Request{}, false
	}

	input := clarificationprotocol.Input{
		ID:         fmt.Sprintf("task-%s-conversion-%d", taskID.String(), round),
		Blocking:   true,
		Complexity: clarificationprotocol.ComplexityNormal,
		Round:      round,
	}
	if len(attachments) == 0 {
		input.Question = "请上传要转换的图片或 PDF，并告诉我希望转换成什么格式。"
		input.Reason = "文件转换需要源文件和目标格式。"
		input.AnswerType = clarificationprotocol.AnswerFile
		input.AllowCustomAnswer = true
		request, err := clarificationprotocol.NewRequest(input)
		return request, err == nil
	}

	if len(attachments) > 1 && !conversionAnswerSelectsAttachment(combined, attachments) {
		input.Question = "请选择这次要转换的文件。"
		input.Reason = "本轮附加了多个文件，必须先确定转换对象。"
		input.AnswerType = clarificationprotocol.AnswerSingleSelect
		input.AllowCustomAnswer = true
		input.Suggestions = make([]clarificationprotocol.Suggestion, 0, len(attachments))
		for _, attachment := range attachments {
			input.Suggestions = append(input.Suggestions, clarificationprotocol.Suggestion{
				Label: attachment.Name,
				Value: attachment.ID.String(),
			})
		}
		request, err := clarificationprotocol.NewRequest(input)
		return request, err == nil
	}

	attachment := attachments[0]
	if selected := selectedConversionAttachment(combined, attachments); selected != nil {
		attachment = *selected
	}
	extension := strings.TrimPrefix(strings.ToLower(filepath.Ext(attachment.Name)), ".")
	if extension == "jpeg" {
		extension = "jpg"
	}
	if extension == "pdf" && containsString(toolNames, documenttool.ToolName) {
		return clarificationprotocol.Request{}, false
	}
	if !containsString(toolNames, imagetool.ConvertToolName) || !isSupportedImageConversionFormat(extension) || conversionTargetFormat(combined) != "" {
		return clarificationprotocol.Request{}, false
	}

	input.Question = "请选择图片要转换成的格式。"
	input.Reason = "图片转换必须指定目标格式。"
	input.AnswerType = clarificationprotocol.AnswerSingleSelect
	input.AllowCustomAnswer = true
	for _, format := range []string{"png", "jpg", "webp"} {
		if format != extension {
			input.Suggestions = append(input.Suggestions, clarificationprotocol.Suggestion{
				Label: strings.ToUpper(format),
				Value: format,
			})
		}
	}
	request, err := clarificationprotocol.NewRequest(input)
	return request, err == nil
}

func looksLikeFileConversionRequest(value string) bool {
	lower := strings.ToLower(strings.TrimSpace(value))
	if lower == "" {
		return false
	}
	for _, marker := range []string{"文件转换", "格式转换", "转换一下", "转换这个", "转换这", "转成", "转为", "convert", "conversion"} {
		if strings.Contains(lower, marker) {
			return true
		}
	}
	return strings.Contains(lower, "转换") &&
		(strings.Contains(lower, "文件") || strings.Contains(lower, "图片") || strings.Contains(lower, "pdf") || lower == "转换" || lower == "帮我转换一下")
}

func conversionTargetFormat(value string) string {
	lower := strings.ToLower(value)
	for _, format := range []string{"png", "jpeg", "jpg", "webp", "docx", "word"} {
		if strings.Contains(lower, format) {
			if format == "jpeg" {
				return "jpg"
			}
			if format == "word" {
				return "docx"
			}
			return format
		}
	}
	return ""
}

func conversionAnswerSelectsAttachment(value string, attachments []model.AIAppConversationAttachment) bool {
	return selectedConversionAttachment(value, attachments) != nil
}

func selectedConversionAttachment(value string, attachments []model.AIAppConversationAttachment) *model.AIAppConversationAttachment {
	lower := strings.ToLower(value)
	for index := range attachments {
		if strings.Contains(lower, strings.ToLower(attachments[index].Name)) || strings.Contains(lower, attachments[index].ID.String()) {
			return &attachments[index]
		}
	}
	return nil
}

func isSupportedImageConversionFormat(value string) bool {
	return value == "png" || value == "jpg" || value == "webp"
}
