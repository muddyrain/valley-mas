package handler

import (
	"bufio"
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

type aiChatMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type aiChatRequest struct {
	Message string          `json:"message" binding:"required"`
	History []aiChatMessage `json:"history"`
	Stream  bool            `json:"stream"`
}

type ollamaChatRequest struct {
	Model    string          `json:"model"`
	Messages []aiChatMessage `json:"messages"`
	Stream   bool            `json:"stream"`
	Options  struct {
		Temperature float64 `json:"temperature,omitempty"`
	} `json:"options,omitempty"`
}

type ollamaChatResponse struct {
	Model   string        `json:"model,omitempty"`
	Message aiChatMessage `json:"message"`
	Done    bool          `json:"done,omitempty"`
	Error   string        `json:"error,omitempty"`
}

// ChatWithAI AI 对话（仅 Ollama）
func ChatWithAI(c *gin.Context) {
	var req aiChatRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		Error(c, 400, "invalid request body")
		return
	}

	userMsg := strings.TrimSpace(req.Message)
	if userMsg == "" {
		Error(c, 400, "message cannot be empty")
		return
	}

	systemPrompt := strings.TrimSpace(os.Getenv("AI_CHAT_SYSTEM_PROMPT"))
	if systemPrompt == "" {
		systemPrompt = "你是 Valley 的 AI 助手。请始终使用简体中文回答，并给出简洁、准确、可执行的建议。"
	} else if !strings.Contains(systemPrompt, "中文") {
		systemPrompt += " 请始终使用简体中文回答。"
	}

	messages := []aiChatMessage{{Role: "system", Content: systemPrompt}}
	for _, m := range req.History {
		role := strings.TrimSpace(m.Role)
		content := strings.TrimSpace(m.Content)
		if content == "" {
			continue
		}
		if role != "user" && role != "assistant" {
			continue
		}
		messages = append(messages, aiChatMessage{Role: role, Content: content})
	}
	messages = append(messages, aiChatMessage{Role: "user", Content: userMsg})

	if req.Stream {
		streamChatWithOllama(c, messages)
		return
	}

	reply, modelName, err := chatWithOllama(messages)
	if err != nil {
		Error(c, 502, err.Error())
		return
	}
	if strings.TrimSpace(reply) == "" {
		Error(c, 502, "AI upstream returned empty content")
		return
	}

	Success(c, gin.H{
		"reply":    strings.TrimSpace(reply),
		"model":    modelName,
		"provider": "ollama",
	})
}

func ollamaConfig() (baseURL, modelName string) {
	baseURL = strings.TrimSpace(os.Getenv("OLLAMA_BASE_URL"))
	if baseURL == "" {
		baseURL = "http://127.0.0.1:11434"
	}
	modelName = strings.TrimSpace(os.Getenv("OLLAMA_MODEL"))
	if modelName == "" {
		modelName = "llama3"
	}
	return baseURL, modelName
}

func chatWithOllama(messages []aiChatMessage) (string, string, error) {
	baseURL, modelName := ollamaConfig()

	reqBody := ollamaChatRequest{Model: modelName, Messages: messages, Stream: false}
	reqBody.Options.Temperature = 0.7

	body, err := json.Marshal(reqBody)
	if err != nil {
		return "", "", fmt.Errorf("failed to build AI request")
	}

	httpReq, err := http.NewRequest(http.MethodPost, strings.TrimRight(baseURL, "/")+"/api/chat", bytes.NewReader(body))
	if err != nil {
		return "", "", fmt.Errorf("failed to create upstream request")
	}
	httpReq.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 120 * time.Second}
	resp, err := client.Do(httpReq)
	if err != nil {
		return "", "", fmt.Errorf("AI upstream request failed: %v", err)
	}
	defer resp.Body.Close()

	var parsed ollamaChatResponse
	if err := json.NewDecoder(resp.Body).Decode(&parsed); err != nil {
		return "", "", fmt.Errorf("invalid AI upstream response")
	}

	if resp.StatusCode >= 400 {
		if parsed.Error != "" {
			return "", "", fmt.Errorf("AI upstream error: %s", parsed.Error)
		}
		return "", "", fmt.Errorf("AI upstream error")
	}
	if parsed.Error != "" {
		return "", "", fmt.Errorf("AI upstream error: %s", parsed.Error)
	}

	return strings.TrimSpace(parsed.Message.Content), modelName, nil
}

func streamChatWithOllama(c *gin.Context, messages []aiChatMessage) {
	baseURL, modelName := ollamaConfig()

	reqBody := ollamaChatRequest{Model: modelName, Messages: messages, Stream: true}
	reqBody.Options.Temperature = 0.7

	body, err := json.Marshal(reqBody)
	if err != nil {
		Error(c, 500, "failed to build AI request")
		return
	}

	httpReq, err := http.NewRequest(http.MethodPost, strings.TrimRight(baseURL, "/")+"/api/chat", bytes.NewReader(body))
	if err != nil {
		Error(c, 500, "failed to create upstream request")
		return
	}
	httpReq.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 0}
	resp, err := client.Do(httpReq)
	if err != nil {
		Error(c, 502, fmt.Sprintf("AI upstream request failed: %v", err))
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		var parsed ollamaChatResponse
		_ = json.NewDecoder(resp.Body).Decode(&parsed)
		if parsed.Error != "" {
			Error(c, 502, "AI upstream error: "+parsed.Error)
			return
		}
		Error(c, 502, "AI upstream error")
		return
	}

	c.Writer.Header().Set("Content-Type", "text/event-stream")
	c.Writer.Header().Set("Cache-Control", "no-cache")
	c.Writer.Header().Set("Connection", "keep-alive")
	c.Writer.Header().Set("X-Accel-Buffering", "no")

	flusher, ok := c.Writer.(http.Flusher)
	if !ok {
		Error(c, 500, "streaming not supported")
		return
	}

	send := func(payload gin.H) {
		b, _ := json.Marshal(payload)
		_, _ = c.Writer.Write([]byte("data: "))
		_, _ = c.Writer.Write(b)
		_, _ = c.Writer.Write([]byte("\n\n"))
		flusher.Flush()
	}

	send(gin.H{"model": modelName, "chunk": "", "done": false})

	scanner := bufio.NewScanner(resp.Body)
	buf := make([]byte, 0, 64*1024)
	scanner.Buffer(buf, 1024*1024)

	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" {
			continue
		}

		var item ollamaChatResponse
		if err := json.Unmarshal([]byte(line), &item); err != nil {
			continue
		}

		if item.Error != "" {
			send(gin.H{"error": item.Error, "done": true})
			return
		}

		chunk := item.Message.Content
		send(gin.H{
			"model": modelName,
			"chunk": chunk,
			"done":  item.Done,
		})

		if item.Done {
			return
		}
	}

	if err := scanner.Err(); err != nil {
		send(gin.H{"error": fmt.Sprintf("stream read error: %v", err), "done": true})
		return
	}

	send(gin.H{"done": true})
}
