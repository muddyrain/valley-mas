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
	"os"
	"path/filepath"
	"strings"
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
}

type ttsSynthesizeResponse struct {
	TaskID      string `json:"taskId"`
	AudioURL    string `json:"audioUrl"`
	DurationSec int    `json:"durationSec"`
	SampleRate  int    `json:"sampleRate"`
	Format      string `json:"format"`
}

func SynthesizeTTS(c *gin.Context) {
	// Prevent recursive proxy loop when TTS_BASE_URL is misconfigured to this same API.
	if c.GetHeader("X-Valley-TTS-Proxy") == "1" {
		Error(c, http.StatusBadGateway, "TTS upstream is misconfigured (recursive proxy loop)")
		return
	}

	if strings.TrimSpace(ttsConfig.BaseURL) == "" {
		Error(c, http.StatusBadRequest, "TTS service is not configured")
		return
	}
	if strings.Contains(strings.TrimRight(ttsConfig.BaseURL, "/"), "/api/v1/public/tts") {
		Error(c, http.StatusBadRequest, "TTS_BASE_URL must point to local F5 service (e.g. http://127.0.0.1:7860), not this server API")
		return
	}

	var req ttsSynthesizeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		Error(c, http.StatusBadRequest, "invalid request")
		return
	}

	req.Text = strings.TrimSpace(req.Text)
	if req.Text == "" {
		Error(c, http.StatusBadRequest, "text is required")
		return
	}
	if len([]rune(req.Text)) > 240 {
		Error(c, http.StatusBadRequest, "text is too long for local CPU mode, max 240 chars")
		return
	}
	if req.Speed <= 0 {
		req.Speed = 1
	}

	payload := map[string]interface{}{
		"text":    req.Text,
		"voiceId": req.VoiceID,
		"speed":   req.Speed,
	}

	result, err := requestUpstreamTTS(c.Request.Context(), payload)
	if err != nil {
		Error(c, http.StatusBadGateway, "tts synthesize failed: "+err.Error())
		return
	}

	taskID := result.TaskID
	if taskID == "" {
		taskID = fmt.Sprintf("tts-%d", utils.GenerateID())
	}
	format := normalizeAudioFormat(result.Format)
	if format == "" {
		format = "wav"
	}

	if err := os.MkdirAll(ttsConfig.OutputDir, 0o755); err != nil {
		Error(c, http.StatusInternalServerError, "failed to prepare output dir")
		return
	}

	filename := fmt.Sprintf("%s.%s", taskID, format)
	filename = sanitizeFilename(filename)
	fullPath := filepath.Join(ttsConfig.OutputDir, filename)
	if err := os.WriteFile(fullPath, result.AudioBytes, 0o644); err != nil {
		Error(c, http.StatusInternalServerError, "failed to save audio")
		return
	}

	Success(c, ttsSynthesizeResponse{
		TaskID:      taskID,
		AudioURL:    "/api/v1/public/tts/audio/" + filename,
		DurationSec: result.DurationSec,
		SampleRate:  result.SampleRate,
		Format:      format,
	})
}

func GetTTSAudio(c *gin.Context) {
	filename := sanitizeFilename(c.Param("filename"))
	if filename == "" {
		Error(c, http.StatusBadRequest, "invalid file")
		return
	}

	fullPath := filepath.Join(ttsConfig.OutputDir, filename)
	if _, err := os.Stat(fullPath); err != nil {
		Error(c, http.StatusNotFound, "audio file not found")
		return
	}

	ext := strings.ToLower(filepath.Ext(filename))
	if contentType := mime.TypeByExtension(ext); contentType != "" {
		c.Header("Content-Type", contentType)
	}
	c.File(fullPath)
}

type upstreamTTSResult struct {
	TaskID      string
	AudioBytes  []byte
	DurationSec int
	SampleRate  int
	Format      string
}

func requestUpstreamTTS(ctx context.Context, payload map[string]interface{}) (*upstreamTTSResult, error) {
	if err := checkUpstreamHealth(); err != nil {
		return nil, err
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}

	path := ttsConfig.UpstreamPath
	if !strings.HasPrefix(path, "/") {
		path = "/" + path
	}
	url := strings.TrimRight(ttsConfig.BaseURL, "/") + path

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
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

	return parseUpstreamTTSResponse(respBytes)
}

func checkUpstreamHealth() error {
	url := strings.TrimRight(ttsConfig.BaseURL, "/") + "/health"
	req, err := http.NewRequest(http.MethodGet, url, nil)
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

	payload := raw
	if dataVal, ok := raw["data"]; ok {
		if dataMap, ok := dataVal.(map[string]interface{}); ok {
			payload = dataMap
		}
	}

	taskID := stringFromMap(payload, "taskId")
	format := stringFromMap(payload, "format")
	if format == "" {
		format = stringFromMap(payload, "audioFormat")
	}
	duration := int(numberFromMap(payload, "durationSec"))
	sampleRate := int(numberFromMap(payload, "sampleRate"))

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

	audioURL := stringFromMap(payload, "audioUrl")
	if audioURL == "" {
		audioURL = stringFromMap(payload, "url")
	}
	if audioURL == "" {
		return nil, fmt.Errorf("upstream did not return audio")
	}

	audioBytes, err := downloadAudio(audioURL)
	if err != nil {
		return nil, err
	}
	return &upstreamTTSResult{
		TaskID:      taskID,
		AudioBytes:  audioBytes,
		DurationSec: duration,
		SampleRate:  sampleRate,
		Format:      format,
	}, nil
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
