package aiclient

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
)

type VideoTaskStatus string

const (
	VideoTaskQueued    VideoTaskStatus = "queued"
	VideoTaskRunning   VideoTaskStatus = "running"
	VideoTaskSucceeded VideoTaskStatus = "succeeded"
	VideoTaskFailed    VideoTaskStatus = "failed"
)

type VideoGenerationRequest struct {
	Protocol          string
	ModelID           string
	Prompt            string
	ReferenceImageURL string
	Ratio             string
	DurationSeconds   int
	Resolution        string
}

type VideoTask struct {
	ID               string
	Status           VideoTaskStatus
	VideoURL         string
	Format           string
	DurationSeconds  float64
	FPS              int
	Width            int
	Height           int
	CompletionTokens int
	TotalTokens      int
	ErrorCode        string
	ErrorMessage     string
}

type compatibleVideoTaskResponse struct {
	ID      string `json:"id"`
	TaskID  string `json:"task_id"`
	Status  string `json:"status"`
	URL     string `json:"url"`
	Format  string `json:"format"`
	Content struct {
		VideoURL string `json:"video_url"`
	} `json:"content"`
	Metadata struct {
		Duration float64 `json:"duration"`
		FPS      int     `json:"fps"`
		Width    int     `json:"width"`
		Height   int     `json:"height"`
	} `json:"metadata"`
	Usage struct {
		CompletionTokens int `json:"completion_tokens"`
		TotalTokens      int `json:"total_tokens"`
	} `json:"usage"`
	Error struct {
		Code    any    `json:"code"`
		Message string `json:"message"`
	} `json:"error"`
}

func (c *CompatibleClient) CreateVideo(ctx context.Context, request VideoGenerationRequest) (VideoTask, error) {
	protocol, err := c.resolveVideoProtocol(request.Protocol)
	if err != nil {
		return VideoTask{}, err
	}
	if protocol != "amux_video" {
		return VideoTask{}, fmt.Errorf("当前模型未配置可用的视频协议适配器：%s", protocol)
	}
	modelID := strings.TrimSpace(request.ModelID)
	prompt := strings.TrimSpace(request.Prompt)
	referenceURL := strings.TrimSpace(request.ReferenceImageURL)
	if modelID == "" || prompt == "" || referenceURL == "" {
		return VideoTask{}, errors.New("视频生成需要模型、提示词和参考图")
	}
	ratio := strings.TrimSpace(request.Ratio)
	if ratio == "" {
		ratio = "1:1"
	}
	duration := request.DurationSeconds
	if duration <= 0 {
		duration = 5
	}
	resolution := strings.TrimSpace(request.Resolution)
	if resolution == "" {
		resolution = "720p"
	}
	payload := map[string]any{
		"model":  modelID,
		"prompt": prompt,
		"metadata": map[string]any{
			"ratio": ratio, "duration": duration, "resolution": resolution,
			"generate_audio": false, "watermark": false,
			"content": []map[string]any{
				{"type": "image_url", "image_url": map[string]string{"url": referenceURL}, "role": "first_frame"},
				{"type": "image_url", "image_url": map[string]string{"url": referenceURL}, "role": "last_frame"},
			},
		},
	}
	var response compatibleVideoTaskResponse
	if err := c.doJSON(ctx, http.MethodPost, "/video/generations", payload, &response); err != nil {
		return VideoTask{}, err
	}
	return normalizeCompatibleVideoTask(response)
}

func (c *CompatibleClient) GetVideoTask(ctx context.Context, taskID string) (VideoTask, error) {
	protocol, err := c.resolveVideoProtocol("")
	if err != nil {
		return VideoTask{}, err
	}
	if protocol != "amux_video" {
		return VideoTask{}, fmt.Errorf("当前模型未配置可用的视频协议适配器：%s", protocol)
	}
	taskID = strings.TrimSpace(taskID)
	if taskID == "" {
		return VideoTask{}, errors.New("视频任务 ID 不能为空")
	}
	var response compatibleVideoTaskResponse
	if err := c.doJSON(ctx, http.MethodGet, "/video/generations/"+taskID, nil, &response); err != nil {
		return VideoTask{}, err
	}
	return normalizeCompatibleVideoTask(response)
}

func (c *CompatibleClient) DownloadVideo(ctx context.Context, taskID string, maxBytes int64) ([]byte, string, error) {
	protocol, err := c.resolveVideoProtocol("")
	if err != nil {
		return nil, "", err
	}
	if protocol != "amux_video" {
		return nil, "", fmt.Errorf("当前模型未配置可用的视频协议适配器：%s", protocol)
	}
	if maxBytes <= 0 {
		return nil, "", errors.New("视频下载上限必须大于 0")
	}
	taskID = strings.TrimSpace(taskID)
	if taskID == "" {
		return nil, "", errors.New("视频任务 ID 不能为空")
	}
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, c.BaseURL+"/videos/"+taskID+"/content", nil)
	if err != nil {
		return nil, "", err
	}
	request.Header.Set("Authorization", "Bearer "+c.APIKey)
	response, err := c.Client.Do(request)
	if err != nil {
		return nil, "", fmt.Errorf("AI 上游视频下载失败: %w", err)
	}
	defer response.Body.Close()
	if response.StatusCode < http.StatusOK || response.StatusCode >= http.StatusMultipleChoices {
		body, _ := io.ReadAll(io.LimitReader(response.Body, 1<<20))
		return nil, "", fmt.Errorf("AI 上游返回 %d: %s", response.StatusCode, strings.TrimSpace(string(body)))
	}
	content, err := io.ReadAll(io.LimitReader(response.Body, maxBytes+1))
	if err != nil {
		return nil, "", err
	}
	if int64(len(content)) > maxBytes {
		return nil, "", errors.New("AI 上游视频超过允许大小")
	}
	mimeType := strings.TrimSpace(strings.Split(response.Header.Get("Content-Type"), ";")[0])
	if mimeType == "" || mimeType == "application/octet-stream" {
		mimeType = http.DetectContentType(content)
	}
	if mimeType != "video/mp4" && mimeType != "application/octet-stream" {
		return nil, "", fmt.Errorf("AI 上游返回了不支持的视频格式：%s", mimeType)
	}
	return content, "video/mp4", nil
}

func (c *CompatibleClient) resolveVideoProtocol(explicit string) (string, error) {
	if c == nil || strings.TrimSpace(c.BaseURL) == "" || strings.TrimSpace(c.APIKey) == "" || c.Client == nil {
		return "", errors.New("AI compatible client 未配置")
	}
	protocol := strings.TrimSpace(explicit)
	if protocol == "" {
		protocol = strings.TrimSpace(c.VideoProtocol)
	}
	if protocol == "" || protocol == "auto" {
		if strings.TrimSpace(c.Provider) == "amux" {
			return "amux_video", nil
		}
	}
	if protocol == "" || protocol == "auto" {
		return "", fmt.Errorf("当前 Provider 未配置默认视频协议：%s", c.Provider)
	}
	return protocol, nil
}

func normalizeCompatibleVideoTask(response compatibleVideoTaskResponse) (VideoTask, error) {
	id := strings.TrimSpace(response.TaskID)
	if id == "" {
		id = strings.TrimSpace(response.ID)
	}
	if id == "" {
		return VideoTask{}, errors.New("AI 视频任务返回空任务 ID")
	}
	status := VideoTaskStatus(strings.ToLower(strings.TrimSpace(response.Status)))
	switch status {
	case "queued":
		status = VideoTaskQueued
	case "in_progress", "running":
		status = VideoTaskRunning
	case "completed", "succeeded":
		status = VideoTaskSucceeded
	case "failed":
		status = VideoTaskFailed
	default:
		return VideoTask{}, fmt.Errorf("AI 视频任务返回未知状态：%s", response.Status)
	}
	videoURL := strings.TrimSpace(response.URL)
	if videoURL == "" {
		videoURL = strings.TrimSpace(response.Content.VideoURL)
	}
	errorCode := ""
	if response.Error.Code != nil {
		errorCode = strings.TrimSpace(fmt.Sprint(response.Error.Code))
	}
	return VideoTask{
		ID: id, Status: status, VideoURL: videoURL, Format: strings.TrimSpace(response.Format),
		DurationSeconds: response.Metadata.Duration, FPS: response.Metadata.FPS,
		Width: response.Metadata.Width, Height: response.Metadata.Height,
		CompletionTokens: response.Usage.CompletionTokens, TotalTokens: response.Usage.TotalTokens,
		ErrorCode: errorCode, ErrorMessage: strings.TrimSpace(response.Error.Message),
	}, nil
}
