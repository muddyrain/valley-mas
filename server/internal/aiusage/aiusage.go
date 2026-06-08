package aiusage

import (
	"context"
	"strings"
	"time"
	"unicode/utf8"
	"valley-server/internal/database"
	"valley-server/internal/model"

	"github.com/sirupsen/logrus"
)

const (
	StatusSuccess = "success"
	StatusFailed  = "failed"
)

type contextKey string

const auditContextKey contextKey = "aiusage.audit"

type AuditContext struct {
	Feature string
	UserID  string
}

func WithAudit(ctx context.Context, feature string, userID string) context.Context {
	return context.WithValue(ctx, auditContextKey, AuditContext{
		Feature: strings.TrimSpace(feature),
		UserID:  strings.TrimSpace(userID),
	})
}

func FromContext(ctx context.Context) AuditContext {
	if ctx == nil {
		return AuditContext{}
	}
	if audit, ok := ctx.Value(auditContextKey).(AuditContext); ok {
		return audit
	}
	return AuditContext{}
}

type Entry struct {
	Feature          string
	Provider         string
	Model            string
	UserID           string
	Status           string
	Stream           bool
	PromptChars      int
	ResponseChars    int
	PromptTokens     int
	CompletionTokens int
	TotalTokens      int
	LatencyMs        int64
	ErrorMessage     string
}

func CharCount(value string) int {
	return utf8.RuneCountInString(value)
}

func Since(start time.Time) int64 {
	return time.Since(start).Milliseconds()
}

func Record(entry Entry) {
	db := database.GetDB()
	if db == nil {
		return
	}

	status := strings.TrimSpace(entry.Status)
	if status == "" {
		status = StatusSuccess
	}
	provider := strings.TrimSpace(entry.Provider)
	if provider == "" {
		provider = "unknown"
	}

	log := model.AIUsageLog{
		Feature:          strings.TrimSpace(entry.Feature),
		Provider:         provider,
		Model:            strings.TrimSpace(entry.Model),
		UserID:           strings.TrimSpace(entry.UserID),
		Status:           status,
		Stream:           entry.Stream,
		PromptChars:      entry.PromptChars,
		ResponseChars:    entry.ResponseChars,
		PromptTokens:     entry.PromptTokens,
		CompletionTokens: entry.CompletionTokens,
		TotalTokens:      entry.TotalTokens,
		LatencyMs:        entry.LatencyMs,
		ErrorMessage:     truncate(entry.ErrorMessage, 1000),
	}
	if log.Feature == "" {
		log.Feature = "unknown"
	}
	if err := db.Create(&log).Error; err != nil {
		logrus.WithError(err).Warn("record AI usage failed")
	}
}

func truncate(value string, limit int) string {
	value = strings.TrimSpace(value)
	if limit <= 0 || utf8.RuneCountInString(value) <= limit {
		return value
	}
	runes := []rune(value)
	return string(runes[:limit])
}
