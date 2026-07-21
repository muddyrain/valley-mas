package handler

import (
	"context"
	"errors"
	"testing"
	"valley-server/internal/aiclient"
)

type fakeBlogExcerptChatClient struct {
	response aiclient.CompatibleChatResponse
	err      error
	request  aiclient.CompatibleChatRequest
}

func (client *fakeBlogExcerptChatClient) Chat(_ context.Context, request aiclient.CompatibleChatRequest) (aiclient.CompatibleChatResponse, error) {
	client.request = request
	if client.err != nil {
		return aiclient.CompatibleChatResponse{}, client.err
	}
	return client.response, nil
}

func TestGenerateBlogExcerptWithCatalogModelRecordsProviderResponse(t *testing.T) {
	client := &fakeBlogExcerptChatClient{}
	client.response.Model = "Qwen/Qwen3-32B"
	client.response.Usage = aiclient.CompatibleUsage{PromptTokens: 12, CompletionTokens: 34, TotalTokens: 46}
	client.response.Choices = append(client.response.Choices, struct {
		Message aiclient.CompatibleMessage `json:"message"`
	}{Message: aiclient.CompatibleMessage{Role: "assistant", Content: "Summary: 这是一段可用的博客摘要。"}})

	excerpt, actualModel, usage, err := generateBlogExcerptWithCatalogModel(
		context.Background(), client, "Qwen/Qwen3-32B", "prompt",
	)
	if err != nil {
		t.Fatalf("generate excerpt: %v", err)
	}
	if client.request.Model != "Qwen/Qwen3-32B" {
		t.Fatalf("request model = %q", client.request.Model)
	}
	if excerpt != "这是一段可用的博客摘要。" || actualModel != "Qwen/Qwen3-32B" {
		t.Fatalf("unexpected result: excerpt=%q model=%q", excerpt, actualModel)
	}
	if usage.TotalTokens != 46 {
		t.Fatalf("total tokens = %d", usage.TotalTokens)
	}
}

func TestGenerateBlogExcerptWithCatalogModelReturnsUpstreamError(t *testing.T) {
	upstreamErr := errors.New("upstream unavailable")
	client := &fakeBlogExcerptChatClient{err: upstreamErr}
	_, _, _, err := generateBlogExcerptWithCatalogModel(context.Background(), client, "text-model", "prompt")
	if !errors.Is(err, upstreamErr) {
		t.Fatalf("error = %v, want %v", err, upstreamErr)
	}
}
