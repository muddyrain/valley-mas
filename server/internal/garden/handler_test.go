package garden_test

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"valley-server/internal/garden"

	"github.com/gin-gonic/gin"
)

func TestHealth(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	api := r.Group("/api/v1")
	h := garden.NewHandler(garden.NewService(nil))
	garden.RegisterGardenRoutes(api, h, func(c *gin.Context) { c.Next() })

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/v1/garden/health", nil)
	r.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
}
