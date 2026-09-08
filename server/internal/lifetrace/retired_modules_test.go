package lifetrace

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestRetiredModuleEndpointsAreUnavailable(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	RegisterRoutes(router.Group("/api/v1"), &Handler{}, func(c *gin.Context) {
		c.AbortWithStatus(http.StatusUnauthorized)
	})
	for _, endpoint := range []struct{ method, path string }{
		{http.MethodGet, "/inbox"},
		{http.MethodPatch, "/inbox/1/convert"},
		{http.MethodGet, "/ledger"},
		{http.MethodGet, "/recurring-payments"},
		{http.MethodPost, "/recurring-payments/1/advance"},
		{http.MethodGet, "/places"},
		{http.MethodGet, "/media-diary"},
		{http.MethodPost, "/ai/recipes"},
		{http.MethodPost, "/ai/recipes/render-video"},
	} {
		t.Run(endpoint.method+endpoint.path, func(t *testing.T) {
			response := httptest.NewRecorder()
			router.ServeHTTP(response, httptest.NewRequest(endpoint.method, "/api/v1/life-trace"+endpoint.path, nil))
			if response.Code != http.StatusNotFound {
				t.Fatalf("retired endpoint is still registered: status %d", response.Code)
			}
		})
	}
	for _, path := range []string{"/plans", "/traces", "/pantry", "/shopping", "/closet/items"} {
		response := httptest.NewRecorder()
		router.ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/api/v1/life-trace"+path, nil))
		if response.Code != http.StatusUnauthorized {
			t.Fatalf("retained endpoint %s must still be protected, got %d", path, response.Code)
		}
	}
}
