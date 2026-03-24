package handler

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"mime"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"
	"valley-server/internal/config"
	"valley-server/internal/utils"

	"github.com/gin-gonic/gin"
)

type ttsRuntimeConfig struct {
	BaseURL      string
	APIKey       string
	UpstreamPath string
	OutputDir    string
	TimeoutSec   int
}

var ttsConfig = ttsRuntimeConfig{
	UpstreamPath: "/synthesize",
	OutputDir:    "./data/tts",
	TimeoutSec:   600,
}

var ttsUpstreamAudioIndex = struct {
	sync.RWMutex
	byTaskID map[string]string
}{
	byTaskID: map[string]string{},
}

func InitTTSConfig(cfg *config.Config) {
	if cfg == nil {
		return
	}
	ttsConfig.BaseURL = cfg.TTS.BaseURL
	ttsConfig.APIKey = cfg.TTS.APIKey
	if cfg.TTS.UpstreamPath != "" {
		ttsConfig.UpstreamPath = cfg.TTS.UpstreamPath
	}
	if cfg.TTS.OutputDir != "" {
		ttsConfig.OutputDir = cfg.TTS.OutputDir
	}
	if cfg.TTS.TimeoutSec > 0 {
		ttsConfig.TimeoutSec = cfg.TTS.TimeoutSec
	}
}

type ttsSynthesizeRequest struct {
	Text    string  `json:"text" binding:"required"`
	VoiceID string  `json:"voiceId" binding:"required"`
	Speed   float64 `json:"speed"`
	Emotion string  `json:"emotion"`
}

type ttsSynthesizeResponse struct {
	TaskID      string `json:"taskId"`
	Status      string `json:"status,omitempty"`
	Progress    int    `json:"progress,omitempty"`
	Message     string `json:"message,omitempty"`
	AudioURL    string `json:"audioUrl"`
	DurationSec int    `json:"durationSec"`
	SampleRate  int    `json:"sampleRate"`
	Format      string `json:"format"`
}

type ttsTaskProgressResponse struct {
	TaskID      string `json:"taskId"`
	Status      string `json:"status"`
	Progress    int    `json:"progress"`
	Message     string `json:"message"`
	AudioURL    string `json:"audioUrl,omitempty"`
	DurationSec int    `json:"durationSec,omitempty"`
	SampleRate  int    `json:"sampleRate,omitempty"`
	Format      string `json:"format,omitempty"`
}

type upstreamTTSResult struct {
	TaskID           string
	AudioBytes       []byte
	UpstreamAudioURL string
	DurationSec      int
	SampleRate       int
	Format           string
}

func SynthesizeTTS(c *gin.Context) {
	if !ensureTTSConfigured(c) {
		return
	}

	req, ok := parseAndValidateTTSRequest(c)
	if !ok {
		return
	}

	result, err := requestUpstreamTTS(c.Request.Context(), buildTTSPayload(req))
	if err != nil {
		Error(c, http.StatusBadGateway, "tts synthesize failed: "+err.Error())
		return
	}

	resp, err := persistUpstreamResultToLocal(result)
	if err != nil {
		Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	Success(c, resp)
}

func SynthesizeTTSAsync(c *gin.Context) {
	if !ensureTTSConfigured(c) {
		return
	}

	req, ok := parseAndValidateTTSRequest(c)
	if !ok {
		return
	}

	raw, err := requestUpstreamJSON(c.Request.Context(), http.MethodPost, "/synthesize/async", buildTTSPayload(req))
	if err != nil {
		Error(c, http.StatusBadGateway, "tts async submit failed: "+err.Error())
		return
	}

	payload := unwrapPayload(raw)
	taskID := stringFromMap(payload, "taskId")
	if taskID == "" {
		Error(c, http.StatusBadGateway, "tts async submit failed: missing taskId")
		return
	}

	Success(c, ttsTaskProgressResponse{
		TaskID:   taskID,
		Status:   defaultString(stringFromMap(payload, "status"), "queued"),
		Progress: clampProgress(int(numberFromMap(payload, "progress"))),
		Message:  defaultString(stringFromMap(payload, "message"), "queued"),
	})
}

func GetTTSTaskProgress(c *gin.Context) {
	if strings.TrimSpace(ttsConfig.BaseURL) == "" {
		Error(c, http.StatusBadRequest, "TTS service is not configured")
		return
	}

	taskID := strings.TrimSpace(c.Param("taskId"))
	if taskID == "" {
		Error(c, http.StatusBadRequest, "taskId is required")
		return
	}

	response, err := fetchTTSTaskProgress(c.Request.Context(), taskID)
	if err != nil {
		Error(c, http.StatusBadGateway, "tts progress failed: "+err.Error())
		return
	}
	Success(c, response)
}

func StreamTTSTaskProgressSSE(c *gin.Context) {
	if strings.TrimSpace(ttsConfig.BaseURL) == "" {
		Error(c, http.StatusBadRequest, "TTS service is not configured")
		return
	}

	taskID := strings.TrimSpace(c.Param("taskId"))
	if taskID == "" {
		Error(c, http.StatusBadRequest, "taskId is required")
		return
	}

	c.Header("Content-Type", "text/event-stream")
	c.Header("Cache-Control", "no-cache")
	c.Header("Connection", "keep-alive")
	c.Header("X-Accel-Buffering", "no")
	c.Status(http.StatusOK)

	flush := func() {
		if f, ok := c.Writer.(http.Flusher); ok {
			f.Flush()
		}
	}

	writeEvent := func(event string, payload ttsTaskProgressResponse) bool {
		raw, err := json.Marshal(payload)
		if err != nil {
			return false
		}
		if _, err := c.Writer.Write([]byte("event: " + event + "\n")); err != nil {
			return false
		}
		if _, err := c.Writer.Write([]byte("data: " + string(raw) + "\n\n")); err != nil {
			return false
		}
		flush()
		return true
	}

	ticker := time.NewTicker(700 * time.Millisecond)
	defer ticker.Stop()

	initial := ttsTaskProgressResponse{TaskID: taskID, Status: "running", Progress: 0, Message: "connecting"}
	if !writeEvent("progress", initial) {
		return
	}

	for {
		select {
		case <-c.Request.Context().Done():
			return
		case <-ticker.C:
			progress, err := fetchTTSTaskProgress(c.Request.Context(), taskID)
			if err != nil {
				errPayload := ttsTaskProgressResponse{
					TaskID:   taskID,
					Status:   "failed",
					Progress: 100,
					Message:  "progress stream error: " + err.Error(),
				}
				_ = writeEvent("error", errPayload)
				return
			}
			if !writeEvent("progress", progress) {
				return
			}
			if progress.Status == "completed" || progress.Status == "failed" {
				_ = writeEvent("done", progress)
				return
			}
		}
	}
}

func GetTTSAudio(c *gin.Context) {
	filename := sanitizeFilename(c.Param("filename"))
	if filename == "" {
		Error(c, http.StatusBadRequest, "invalid file")
		return
	}

	fullPath := filepath.Join(ttsConfig.OutputDir, filename)
	if _, err := os.Stat(fullPath); err == nil {
		ext := strings.ToLower(filepath.Ext(filename))
		if contentType := mime.TypeByExtension(ext); contentType != "" {
			c.Header("Content-Type", contentType)
		}
		c.File(fullPath)
		return
	}

	taskID := strings.TrimSpace(strings.TrimSuffix(filename, filepath.Ext(filename)))
	upstreamAudioURL := getUpstreamAudioURL(taskID)
	if upstreamAudioURL == "" {
		Error(c, http.StatusNotFound, "audio file not found")
		return
	}
	if err := streamUpstreamAudio(c, upstreamAudioURL); err != nil {
		Error(c, http.StatusBadGateway, "audio proxy failed: "+err.Error())
		return
	}
}

func ensureTTSConfigured(c *gin.Context) bool {
	if c.GetHeader("X-Valley-TTS-Proxy") == "1" {
		Error(c, http.StatusBadGateway, "TTS upstream is misconfigured (recursive proxy loop)")
		return false
	}
	if strings.TrimSpace(ttsConfig.BaseURL) == "" {
		Error(c, http.StatusBadRequest, "TTS service is not configured")
		return false
	}
	if strings.Contains(strings.TrimRight(ttsConfig.BaseURL, "/"), "/api/v1/public/tts") {
		Error(c, http.StatusBadRequest, "TTS_BASE_URL must point to local F5 service (e.g. http://127.0.0.1:7860), not this server API")
		return false
	}
	return true
}

func parseAndValidateTTSRequest(c *gin.Context) (ttsSynthesizeRequest, bool) {
	var req ttsSynthesizeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		Error(c, http.StatusBadRequest, "invalid request")
		return req, false
	}

	req.Text = strings.TrimSpace(req.Text)
	if req.Text == "" {
		Error(c, http.StatusBadRequest, "text is required")
		return req, false
	}
	if len([]rune(req.Text)) > 240 {
		Error(c, http.StatusBadRequest, "text is too long for local CPU mode, max 240 chars")
		return req, false
	}
	if req.Speed <= 0 {
		req.Speed = 1
	}
	req.Emotion = strings.ToLower(strings.TrimSpace(req.Emotion))
	switch req.Emotion {
	case "", "neutral", "calm", "happy", "sad", "excited":
		// ok
	default:
		Error(c, http.StatusBadRequest, "emotion must be one of: neutral, calm, happy, sad, excited")
		return req, false
	}
	return req, true
}

func buildTTSPayload(req ttsSynthesizeRequest) map[string]interface{} {
	payload := map[string]interface{}{
		"text":    req.Text,
		"voiceId": req.VoiceID,
		"speed":   req.Speed,
	}
	if req.Emotion != "" {
		payload["emotion"] = req.Emotion
	}
	return payload
}

func persistUpstreamResultToLocal(result *upstreamTTSResult) (*ttsSynthesizeResponse, error) {
	taskID := result.TaskID
	if taskID == "" {
		taskID = fmt.Sprintf("tts-%d", utils.GenerateID())
	}
	format := normalizeAudioFormat(result.Format)
	if format == "" {
		format = "wav"
	}

	if strings.TrimSpace(result.UpstreamAudioURL) != "" {
		setUpstreamAudioURL(taskID, result.UpstreamAudioURL)
		return &ttsSynthesizeResponse{
			TaskID:      taskID,
			Status:      "completed",
			Progress:    100,
			Message:     "completed",
			AudioURL:    "/api/v1/public/tts/audio/" + sanitizeFilename(fmt.Sprintf("%s.%s", taskID, format)),
			DurationSec: result.DurationSec,
			SampleRate:  result.SampleRate,
			Format:      format,
		}, nil
	}

	if err := os.MkdirAll(ttsConfig.OutputDir, 0o755); err != nil {
		return nil, fmt.Errorf("failed to prepare output dir")
	}

	filename := sanitizeFilename(fmt.Sprintf("%s.%s", taskID, format))
	fullPath := filepath.Join(ttsConfig.OutputDir, filename)
	if err := os.WriteFile(fullPath, result.AudioBytes, 0o644); err != nil {
		return nil, fmt.Errorf("failed to save audio")
	}

	return &ttsSynthesizeResponse{
		TaskID:      taskID,
		Status:      "completed",
		Progress:    100,
		Message:     "completed",
		AudioURL:    "/api/v1/public/tts/audio/" + filename,
		DurationSec: result.DurationSec,
		SampleRate:  result.SampleRate,
		Format:      format,
	}, nil
}

func requestUpstreamTTS(ctx context.Context, payload map[string]interface{}) (*upstreamTTSResult, error) {
	raw, err := requestUpstreamJSON(ctx, http.MethodPost, ttsConfig.UpstreamPath, payload)
	if err != nil {
		return nil, err
	}
	return parseUpstreamTTSResponseMap(raw)
}

func requestUpstreamJSON(ctx context.Context, method string, upstreamPath string, payload map[string]interface{}) (map[string]interface{}, error) {
	if err := checkUpstreamHealth(); err != nil {
		return nil, err
	}

	path := strings.TrimSpace(upstreamPath)
	if !strings.HasPrefix(path, "/") {
		path = "/" + path
	}
	targetURL := strings.TrimRight(ttsConfig.BaseURL, "/") + path

	var bodyReader io.Reader
	if payload != nil {
		body, err := json.Marshal(payload)
		if err != nil {
			return nil, err
		}
		bodyReader = bytes.NewReader(body)
	}

	req, err := http.NewRequestWithContext(ctx, method, targetURL, bodyReader)
	if err != nil {
		return nil, err
	}
	if payload != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	req.Header.Set("X-Valley-TTS-Proxy", "1")
	if ttsConfig.APIKey != "" {
		req.Header.Set("Authorization", "Bearer "+ttsConfig.APIKey)
		req.Header.Set("X-API-Key", ttsConfig.APIKey)
	}

	client := &http.Client{Timeout: time.Duration(ttsConfig.TimeoutSec) * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	respBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode >= 300 {
		msg := strings.TrimSpace(string(respBytes))
		if msg == "" {
			msg = resp.Status
		}
		return nil, fmt.Errorf("upstream error: %s", msg)
	}

	var raw map[string]interface{}
	if err := json.Unmarshal(respBytes, &raw); err != nil {
		return nil, fmt.Errorf("invalid upstream json")
	}
	return raw, nil
}

func checkUpstreamHealth() error {
	targetURL := strings.TrimRight(ttsConfig.BaseURL, "/") + "/health"
	req, err := http.NewRequest(http.MethodGet, targetURL, nil)
	if err != nil {
		return fmt.Errorf("invalid upstream health url")
	}
	client := &http.Client{Timeout: 2 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("upstream is busy or unavailable: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		return fmt.Errorf("upstream health check failed: %s", resp.Status)
	}
	return nil
}

func parseUpstreamTTSResponse(respBytes []byte) (*upstreamTTSResult, error) {
	var raw map[string]interface{}
	if err := json.Unmarshal(respBytes, &raw); err != nil {
		return nil, fmt.Errorf("invalid upstream json")
	}
	return parseUpstreamTTSResponseMap(raw)
}

func parseUpstreamTTSResponseMap(raw map[string]interface{}) (*upstreamTTSResult, error) {
	payload := unwrapPayload(raw)
	return parseUpstreamTTSResultFromPayload(payload)
}

func fetchTTSTaskProgress(ctx context.Context, taskID string) (ttsTaskProgressResponse, error) {
	raw, err := requestUpstreamJSON(ctx, http.MethodGet, "/task/"+url.PathEscape(taskID), nil)
	if err != nil {
		return ttsTaskProgressResponse{}, err
	}
	payload := unwrapPayload(raw)
	status := strings.ToLower(defaultString(stringFromMap(payload, "status"), "running"))
	response := ttsTaskProgressResponse{
		TaskID:   defaultString(stringFromMap(payload, "taskId"), taskID),
		Status:   status,
		Progress: clampProgress(int(numberFromMap(payload, "progress"))),
		Message:  defaultString(stringFromMap(payload, "message"), status),
	}

	if status == "completed" {
		result, parseErr := parseUpstreamTTSResultFromPayload(payload)
		if parseErr != nil {
			return ttsTaskProgressResponse{}, fmt.Errorf("tts progress parse failed: %w", parseErr)
		}
		persisted, persistErr := persistUpstreamResultToLocal(result)
		if persistErr != nil {
			return ttsTaskProgressResponse{}, fmt.Errorf("persist audio failed: %w", persistErr)
		}
		response.AudioURL = persisted.AudioURL
		response.DurationSec = persisted.DurationSec
		response.SampleRate = persisted.SampleRate
		response.Format = persisted.Format
		response.Progress = 100
	}
	return response, nil
}

func parseUpstreamTTSResultFromPayload(payload map[string]interface{}) (*upstreamTTSResult, error) {
	if payload == nil {
		return nil, fmt.Errorf("empty payload")
	}

	taskID := stringFromMap(payload, "taskId")
	format := stringFromMap(payload, "format")
	if format == "" {
		format = stringFromMap(payload, "audioFormat")
	}
	duration := int(numberFromMap(payload, "durationSec"))
	sampleRate := int(numberFromMap(payload, "sampleRate"))

	audioURL := stringFromMap(payload, "audioUrl")
	if audioURL == "" {
		audioURL = stringFromMap(payload, "url")
	}
	if audioURL != "" {
		return &upstreamTTSResult{
			TaskID:           taskID,
			UpstreamAudioURL: audioURL,
			DurationSec:      duration,
			SampleRate:       sampleRate,
			Format:           format,
		}, nil
	}

	if audioBase64 := stringFromMap(payload, "audioBase64"); audioBase64 != "" {
		audioBytes, err := decodeBase64Audio(audioBase64)
		if err != nil {
			return nil, fmt.Errorf("invalid audioBase64")
		}
		return &upstreamTTSResult{
			TaskID:      taskID,
			AudioBytes:  audioBytes,
			DurationSec: duration,
			SampleRate:  sampleRate,
			Format:      format,
		}, nil
	}

	return nil, fmt.Errorf("upstream did not return audio")
}

func unwrapPayload(raw map[string]interface{}) map[string]interface{} {
	if raw == nil {
		return map[string]interface{}{}
	}
	if dataVal, ok := raw["data"]; ok {
		if dataMap, ok := dataVal.(map[string]interface{}); ok {
			return dataMap
		}
	}
	return raw
}

func downloadAudio(url string) ([]byte, error) {
	ctx, cancel := context.WithTimeout(context.Background(), time.Duration(ttsConfig.TimeoutSec)*time.Second)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	resp, err := (&http.Client{Timeout: time.Duration(ttsConfig.TimeoutSec) * time.Second}).Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		return nil, fmt.Errorf("audio download failed: %s", resp.Status)
	}
	return io.ReadAll(resp.Body)
}

func decodeBase64Audio(input string) ([]byte, error) {
	encoded := strings.TrimSpace(input)
	if strings.HasPrefix(encoded, "data:") {
		idx := strings.Index(encoded, ",")
		if idx > 0 {
			encoded = encoded[idx+1:]
		}
	}
	return base64.StdEncoding.DecodeString(encoded)
}

func normalizeAudioFormat(format string) string {
	f := strings.ToLower(strings.TrimSpace(format))
	switch f {
	case "wav", "wave":
		return "wav"
	case "mp3":
		return "mp3"
	default:
		return ""
	}
}

func stringFromMap(m map[string]interface{}, key string) string {
	v, ok := m[key]
	if !ok || v == nil {
		return ""
	}
	s, ok := v.(string)
	if !ok {
		return ""
	}
	return s
}

func numberFromMap(m map[string]interface{}, key string) float64 {
	v, ok := m[key]
	if !ok || v == nil {
		return 0
	}
	if n, ok := v.(float64); ok {
		return n
	}
	return 0
}

func sanitizeFilename(name string) string {
	base := filepath.Base(name)
	base = strings.ReplaceAll(base, "..", "")
	base = strings.TrimSpace(base)
	if base == "." || base == string(filepath.Separator) {
		return ""
	}
	return base
}

func setUpstreamAudioURL(taskID string, upstreamAudioURL string) {
	id := strings.TrimSpace(taskID)
	audioURL := strings.TrimSpace(upstreamAudioURL)
	if id == "" || audioURL == "" {
		return
	}
	ttsUpstreamAudioIndex.Lock()
	ttsUpstreamAudioIndex.byTaskID[id] = audioURL
	ttsUpstreamAudioIndex.Unlock()
}

func getUpstreamAudioURL(taskID string) string {
	id := strings.TrimSpace(taskID)
	if id == "" {
		return ""
	}
	ttsUpstreamAudioIndex.RLock()
	url := ttsUpstreamAudioIndex.byTaskID[id]
	ttsUpstreamAudioIndex.RUnlock()
	return url
}

func streamUpstreamAudio(c *gin.Context, upstreamAudioURL string) error {
	ctx, cancel := context.WithTimeout(c.Request.Context(), time.Duration(ttsConfig.TimeoutSec)*time.Second)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, upstreamAudioURL, nil)
	if err != nil {
		return err
	}
	if rangeHeader := c.GetHeader("Range"); rangeHeader != "" {
		req.Header.Set("Range", rangeHeader)
	}
	resp, err := (&http.Client{Timeout: time.Duration(ttsConfig.TimeoutSec) * time.Second}).Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		return fmt.Errorf("upstream status: %s", resp.Status)
	}

	copyHeaders := []string{"Content-Type", "Content-Length", "Content-Range", "Accept-Ranges", "Cache-Control", "ETag", "Last-Modified"}
	for _, h := range copyHeaders {
		if v := resp.Header.Get(h); v != "" {
			c.Header(h, v)
		}
	}
	c.Status(resp.StatusCode)
	_, err = io.Copy(c.Writer, resp.Body)
	return err
}

func clampProgress(v int) int {
	if v < 0 {
		return 0
	}
	if v > 100 {
		return 100
	}
	return v
}

func defaultString(v string, fallback string) string {
	if strings.TrimSpace(v) == "" {
		return fallback
	}
	return v
}
