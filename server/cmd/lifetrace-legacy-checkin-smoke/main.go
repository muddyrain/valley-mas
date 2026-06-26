package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"valley-server/internal/config"
	"valley-server/internal/lifetrace"

	"github.com/gin-gonic/gin"
)

type apiEnvelope struct {
	Code    int             `json:"code"`
	Message string          `json:"message"`
	Data    json.RawMessage `json:"data"`
}

func main() {
	if err := run(); err != nil {
		fmt.Fprintf(os.Stderr, "legacy checkin smoke failed: %v\n", err)
		os.Exit(1)
	}
}

func run() error {
	gin.SetMode(gin.TestMode)

	router := gin.New()
	auth := func(c *gin.Context) {
		c.Set("userId", int64(101))
		c.Next()
	}
	lifetrace.RegisterRoutes(
		router.Group("/api/v1"),
		lifetrace.NewHandler(lifetrace.NewWeatherService(config.QWeatherConfig{})),
		auth,
	)

	if err := requestLegacyCheckinList(router); err != nil {
		return err
	}
	if err := clickLegacyCheckinButton(router); err != nil {
		return err
	}

	fmt.Println("PASS legacy PWA checkin smoke: GET list and PUT toggle both returned success envelopes")
	return nil
}

func requestLegacyCheckinList(router http.Handler) error {
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(
		http.MethodGet,
		"/api/v1/life-trace/checkins?date=2026-06-25",
		nil,
	)
	router.ServeHTTP(recorder, request)

	envelope, err := expectSuccess(recorder, "GET /life-trace/checkins")
	if err != nil {
		return err
	}

	var data struct {
		Date string            `json:"date"`
		List []json.RawMessage `json:"list"`
	}
	if err := json.Unmarshal(envelope.Data, &data); err != nil {
		return fmt.Errorf("decode legacy checkin list payload: %w", err)
	}
	if data.Date != "2026-06-25" {
		return fmt.Errorf("expected date 2026-06-25, got %q", data.Date)
	}
	if len(data.List) != 0 {
		return fmt.Errorf("expected empty legacy checkin list, got %d items", len(data.List))
	}
	return nil
}

func clickLegacyCheckinButton(router http.Handler) error {
	body := bytes.NewBufferString(`{"date":"2026-06-25","name":"喝水","completed":true}`)
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPut, "/api/v1/life-trace/checkins", body)
	request.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(recorder, request)

	envelope, err := expectSuccess(recorder, "PUT /life-trace/checkins")
	if err != nil {
		return err
	}

	var data struct {
		Date      string `json:"date"`
		Name      string `json:"name"`
		Completed bool   `json:"completed"`
	}
	if err := json.Unmarshal(envelope.Data, &data); err != nil {
		return fmt.Errorf("decode legacy checkin toggle payload: %w", err)
	}
	if data.Date != "2026-06-25" || data.Name != "喝水" || !data.Completed {
		return fmt.Errorf("unexpected legacy checkin toggle payload: %+v", data)
	}
	return nil
}

func expectSuccess(recorder *httptest.ResponseRecorder, action string) (apiEnvelope, error) {
	if recorder.Code == http.StatusNotFound {
		return apiEnvelope{}, fmt.Errorf("%s returned 404: cached PWA would show not found toast", action)
	}
	if recorder.Code != http.StatusOK {
		return apiEnvelope{}, fmt.Errorf("%s returned HTTP %d: %s", action, recorder.Code, recorder.Body.String())
	}

	var envelope apiEnvelope
	if err := json.Unmarshal(recorder.Body.Bytes(), &envelope); err != nil {
		return apiEnvelope{}, fmt.Errorf("%s returned invalid JSON: %w", action, err)
	}
	if envelope.Code != 0 {
		message := strings.TrimSpace(envelope.Message)
		if message == "" {
			message = "unknown error"
		}
		return apiEnvelope{}, fmt.Errorf("%s returned envelope code %d: %s", action, envelope.Code, message)
	}
	return envelope, nil
}
