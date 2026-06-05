package logger

import (
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
	"valley-server/internal/database"
	"valley-server/internal/model"

	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/sirupsen/logrus"
	"gorm.io/gorm"
)

func TestRequestLoggerPersistsResponseBodySummary(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite db: %v", err)
	}
	if err := db.AutoMigrate(&model.OperationLog{}); err != nil {
		t.Fatalf("migrate operation log: %v", err)
	}

	previousDB := database.DB
	database.DB = db
	t.Cleanup(func() {
		database.DB = previousDB
	})

	previousLog := Log
	Log = logrus.New()
	Log.SetOutput(io.Discard)
	t.Cleanup(func() {
		Log = previousLog
	})

	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(RequestLogger())
	router.POST("/scan", func(c *gin.Context) {
		SetOperationLogResponseBody(c, `{"scanned":true}`)
		c.JSON(http.StatusOK, gin.H{"scanned": true})
	})

	req := httptest.NewRequest(http.MethodPost, "/scan", nil)
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	var op model.OperationLog
	if err := database.GetDB().First(&op).Error; err != nil {
		t.Fatalf("read operation log: %v", err)
	}
	if op.ResponseBody != `{"scanned":true}` {
		t.Fatalf("expected response body summary to persist, got %+v", op)
	}
}
