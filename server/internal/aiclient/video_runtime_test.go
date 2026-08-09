package aiclient

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestAmuxVideoAdapterCreatesLoopTask(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/video/generations" || r.Method != http.MethodPost {
			t.Fatalf("unexpected request: %s %s", r.Method, r.URL.Path)
		}
		if r.Header.Get("Authorization") != "Bearer test-key" {
			t.Fatalf("unexpected authorization header")
		}
		var payload struct {
			Model    string `json:"model"`
			Prompt   string `json:"prompt"`
			Metadata struct {
				Ratio         string `json:"ratio"`
				Duration      int    `json:"duration"`
				Resolution    string `json:"resolution"`
				GenerateAudio bool   `json:"generate_audio"`
				Content       []struct {
					Type     string `json:"type"`
					Role     string `json:"role"`
					ImageURL struct {
						URL string `json:"url"`
					} `json:"image_url"`
				} `json:"content"`
			} `json:"metadata"`
		}
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			t.Fatal(err)
		}
		if payload.Model != "doubao-seedance-2.0-fast" || payload.Prompt == "" ||
			payload.Metadata.Ratio != "1:1" || payload.Metadata.Duration != 5 ||
			payload.Metadata.Resolution != "720p" || payload.Metadata.GenerateAudio {
			t.Fatalf("unexpected payload: %+v", payload)
		}
		if len(payload.Metadata.Content) != 2 ||
			payload.Metadata.Content[0].Role != "first_frame" ||
			payload.Metadata.Content[1].Role != "last_frame" ||
			payload.Metadata.Content[0].ImageURL.URL != "https://cdn.test/reference.png" ||
			payload.Metadata.Content[1].ImageURL.URL != "https://cdn.test/reference.png" {
			t.Fatalf("loop frames not locked: %+v", payload.Metadata.Content)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = io.WriteString(w, `{"task_id":"task-1","status":"queued"}`)
	}))
	defer server.Close()

	client := NewProviderCompatibleClient("amux", server.URL, "test-key", time.Second)
	client.VideoProtocol = "amux_video"
	task, err := client.CreateVideo(context.Background(), VideoGenerationRequest{
		ModelID: "doubao-seedance-2.0-fast", Prompt: "角色轻轻跳一下后回到原位",
		ReferenceImageURL: "https://cdn.test/reference.png", Ratio: "1:1", DurationSeconds: 5,
		Resolution: "720p",
	})
	if err != nil {
		t.Fatal(err)
	}
	if task.ID != "task-1" || task.Status != VideoTaskQueued {
		t.Fatalf("unexpected task: %+v", task)
	}
}

func TestAmuxVideoAdapterNormalizesStatusAndDownloadsContent(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/video/generations/task-2":
			w.Header().Set("Content-Type", "application/json")
			_, _ = io.WriteString(w, `{"task_id":"task-2","status":"completed","url":"https://cdn.test/result.mp4","format":"mp4","metadata":{"duration":5,"fps":24,"width":1280,"height":720}}`)
		case "/videos/task-2/content":
			w.Header().Set("Content-Type", "video/mp4")
			_, _ = w.Write([]byte("video-bytes"))
		default:
			http.NotFound(w, r)
		}
	}))
	defer server.Close()

	client := NewProviderCompatibleClient("amux", server.URL, "test-key", time.Second)
	client.VideoProtocol = "amux_video"
	task, err := client.GetVideoTask(context.Background(), "task-2")
	if err != nil {
		t.Fatal(err)
	}
	if task.Status != VideoTaskSucceeded || task.VideoURL == "" || task.Width != 1280 || task.Height != 720 {
		t.Fatalf("unexpected task: %+v", task)
	}
	content, mimeType, err := client.DownloadVideo(context.Background(), "task-2", 1024)
	if err != nil {
		t.Fatal(err)
	}
	if string(content) != "video-bytes" || mimeType != "video/mp4" {
		t.Fatalf("unexpected download: %q %q", content, mimeType)
	}
}
