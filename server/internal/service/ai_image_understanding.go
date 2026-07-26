package service

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"
	"unicode/utf8"
	"valley-server/internal/aiclient"
	"valley-server/internal/aimodel"
	"valley-server/internal/aiusage"
	"valley-server/internal/model"

	"gorm.io/gorm"
)

const (
	AIImageUnderstandingTimeout = 90 * time.Second
	maxAIImageQuestionRunes     = 4000
	maxAIImageAnswerRunes       = 12000
)

type AIImageUnderstandingInputError struct {
	Message string
}

func (e *AIImageUnderstandingInputError) Error() string {
	if e == nil {
		return ""
	}
	return e.Message
}

type AIImageUnderstandingInput struct {
	UserID      model.Int64String
	ModelID     string
	ImageSource string
	Prompt      string
	Feature     string
}

type AIImageUnderstandingResult struct {
	Text       string
	Model      string
	TokenUsage int
}

type AIImageUnderstandingService struct {
	db          *gorm.DB
	resolve     func(*gorm.DB, string, string, time.Duration) (aimodel.Invocation, error)
	fetch       func(context.Context, string) ([]byte, string, error)
	chat        func(context.Context, aimodel.Invocation, aiclient.CompatibleChatRequest) (aiclient.CompatibleChatResponse, error)
	recordUsage func(aiusage.Entry)
	now         func() time.Time
}

func NewAIImageUnderstandingService(db *gorm.DB) *AIImageUnderstandingService {
	return &AIImageUnderstandingService{
		db:      db,
		resolve: aimodel.ResolveInvocation,
		fetch:   FetchAIImageSource,
		chat: func(ctx context.Context, invocation aimodel.Invocation, request aiclient.CompatibleChatRequest) (aiclient.CompatibleChatResponse, error) {
			return invocation.Client.Chat(ctx, request)
		},
		recordUsage: aiusage.Record,
		now:         time.Now,
	}
}

func (s *AIImageUnderstandingService) Understand(ctx context.Context, input AIImageUnderstandingInput) (AIImageUnderstandingResult, error) {
	if s == nil || s.db == nil {
		return AIImageUnderstandingResult{}, errors.New("图片理解服务未配置")
	}
	if input.UserID <= 0 {
		return AIImageUnderstandingResult{}, &AIImageUnderstandingInputError{Message: "用户 ID 无效"}
	}
	prompt := strings.TrimSpace(input.Prompt)
	if prompt == "" {
		return AIImageUnderstandingResult{}, &AIImageUnderstandingInputError{Message: "请输入图片理解任务"}
	}
	if utf8.RuneCountInString(prompt) > maxAIImageQuestionRunes {
		return AIImageUnderstandingResult{}, &AIImageUnderstandingInputError{
			Message: fmt.Sprintf("图片理解任务不能超过 %d 个字符", maxAIImageQuestionRunes),
		}
	}
	content, mimeType, err := s.fetch(ctx, strings.TrimSpace(input.ImageSource))
	if err != nil {
		return AIImageUnderstandingResult{}, &AIImageUnderstandingInputError{Message: "图片读取失败: " + err.Error()}
	}
	if len(content) > MaxAIImageReferenceBytes {
		return AIImageUnderstandingResult{}, &AIImageUnderstandingInputError{Message: "待理解图片不能超过 5MB"}
	}
	invocation, err := s.resolve(s.db, strings.TrimSpace(input.ModelID), "vision", AIImageUnderstandingTimeout)
	if err != nil {
		return AIImageUnderstandingResult{}, err
	}
	started := s.now()
	feature := fallbackString(strings.TrimSpace(input.Feature), "workflow-image-understanding")
	response, err := s.chat(ctx, invocation, aiclient.CompatibleChatRequest{
		Model: invocation.Model.ModelID,
		Messages: []aiclient.CompatibleMessage{{
			Role: "user",
			Content: []map[string]any{
				{"type": "image_url", "image_url": map[string]string{"url": AIImageDataURL(content, mimeType)}},
				{"type": "text", "text": prompt},
			},
		}},
	})
	if err != nil {
		s.recordUsage(aiusage.Entry{
			Feature: feature, Provider: invocation.Provider.Provider, Model: invocation.Model.ModelID,
			UserID: input.UserID.String(), Status: aiusage.StatusFailed,
			PromptChars: aiusage.CharCount(prompt), LatencyMs: s.now().Sub(started).Milliseconds(),
			ErrorMessage: SummarizeAIImageError(err),
		})
		return AIImageUnderstandingResult{}, fmt.Errorf("图片理解失败: %w", err)
	}
	if len(response.Choices) == 0 {
		return AIImageUnderstandingResult{}, errors.New("图片理解模型未返回结果")
	}
	text := aiclient.TrimRunes(aiclient.CompatibleMessageText(response.Choices[0].Message.Content), maxAIImageAnswerRunes)
	if text == "" {
		return AIImageUnderstandingResult{}, errors.New("图片理解模型未返回有效文本")
	}
	modelName := fallbackString(strings.TrimSpace(response.Model), invocation.Model.ModelID)
	s.recordUsage(aiusage.Entry{
		Feature: feature, Provider: invocation.Provider.Provider, Model: modelName,
		UserID: input.UserID.String(), Status: aiusage.StatusSuccess,
		PromptChars: aiusage.CharCount(prompt), ResponseChars: aiusage.CharCount(text),
		PromptTokens: response.Usage.PromptTokens, CompletionTokens: response.Usage.CompletionTokens,
		TotalTokens: response.Usage.TotalTokens, LatencyMs: s.now().Sub(started).Milliseconds(),
	})
	return AIImageUnderstandingResult{Text: text, Model: modelName, TokenUsage: response.Usage.TotalTokens}, nil
}
