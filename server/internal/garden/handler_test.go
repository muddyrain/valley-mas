package garden_test

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
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

func TestPlantHandlerCreatesPlant(t *testing.T) {
	gin.SetMode(gin.TestMode)

	store := newMemStore()
	store.EnsureGarden(context.Background(), 42)
	ai := &fakeAI{reply: `{"name_zh":"x","concept_en":"x","tags":["x"],"rarity":"N","mood":"困","description":"d","first_log":"l"}`}
	manifest := garden.NewManifest([]garden.AssetEntry{{Key: "k", Rarity: "N", Tags: []string{"x"}}})
	svc := garden.NewServiceWithDeps(store, ai, manifest, 1)

	r := gin.New()
	api := r.Group("/api/v1")
	fakeAuth := func(c *gin.Context) {
		c.Set("user_id", uint64(42))
		c.Next()
	}
	garden.RegisterGardenRoutes(api, garden.NewHandler(svc), fakeAuth)

	body := strings.NewReader(`{"concept":"未读消息","water_style":"water"}`)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/garden/plant", body)
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", w.Code, w.Body.String())
	}
}
