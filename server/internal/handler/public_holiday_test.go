package handler

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestGetChinaHolidayCalendar(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.GET("/api/v1/public/holiday-calendars/china/:year", GetChinaHolidayCalendar)

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/api/v1/public/holiday-calendars/china/2026", nil)
	router.ServeHTTP(recorder, request)

	var body struct {
		Code int `json:"code"`
		Data struct {
			Country          string `json:"country"`
			Year             int    `json:"year"`
			Holidays         []any  `json:"holidays"`
			AdjustedWorkdays []any  `json:"adjustedWorkdays"`
		} `json:"data"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if body.Code != 0 || body.Data.Country != "CN" || body.Data.Year != 2026 {
		t.Fatalf("unexpected response: %s", recorder.Body.String())
	}
	if len(body.Data.Holidays) == 0 || len(body.Data.AdjustedWorkdays) == 0 {
		t.Fatalf("expected holiday and adjusted workday data, got %s", recorder.Body.String())
	}
}

func TestGetChinaHolidayCalendarRejectsInvalidYear(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.GET("/api/v1/public/holiday-calendars/china/:year", GetChinaHolidayCalendar)

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/api/v1/public/holiday-calendars/china/not-year", nil)
	router.ServeHTTP(recorder, request)

	var body struct {
		Code int `json:"code"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if body.Code != http.StatusBadRequest {
		t.Fatalf("expected bad request code, got %s", recorder.Body.String())
	}
}
