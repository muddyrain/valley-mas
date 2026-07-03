package handler

import (
	"context"
	"errors"
	"io"
	"strings"

	"github.com/volcengine/volcengine-go-sdk/service/arkruntime"
	arkmodel "github.com/volcengine/volcengine-go-sdk/service/arkruntime/model"
)

// callChatStream 使用 Chat Completions Stream API 调用 ARK 模型，阻塞直到流结束并返回完整文本。
// useVision=true 时把 imageURL（http/https 或 data:）作为图片消息一并发送。
func callChatStream(client *arkruntime.Client, modelID, imageURL, prompt string, useVision bool) (string, error) {
	maxTokens := 200

	var content *arkmodel.ChatCompletionMessageContent
	if useVision {
		if !strings.HasPrefix(imageURL, "http") && !strings.HasPrefix(imageURL, "data:") {
			imageURL = "data:image/jpeg;base64," + imageURL
		}
		content = &arkmodel.ChatCompletionMessageContent{
			ListValue: []*arkmodel.ChatCompletionMessageContentPart{
				{
					Type: arkmodel.ChatCompletionMessageContentPartTypeImageURL,
					ImageURL: &arkmodel.ChatMessageImageURL{
						URL:    imageURL,
						Detail: arkmodel.ImageURLDetailLow,
					},
				},
				{
					Type: arkmodel.ChatCompletionMessageContentPartTypeText,
					Text: prompt,
				},
			},
		}
	} else {
		strVal := prompt
		content = &arkmodel.ChatCompletionMessageContent{StringValue: &strVal}
	}

	stream, err := client.CreateChatCompletionStream(
		context.Background(),
		arkmodel.CreateChatCompletionRequest{
			Model: modelID,
			Messages: []*arkmodel.ChatCompletionMessage{
				{Role: "user", Content: content},
			},
			MaxTokens: &maxTokens,
		},
	)
	if err != nil {
		return "", err
	}
	defer stream.Close()

	var sb strings.Builder
	for {
		resp, err := stream.Recv()
		if errors.Is(err, io.EOF) {
			break
		}
		if err != nil {
			return "", err
		}
		for _, choice := range resp.Choices {
			sb.WriteString(choice.Delta.Content)
		}
	}
	return sb.String(), nil
}
