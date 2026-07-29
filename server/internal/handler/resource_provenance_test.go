package handler

import (
	"net/http/httptest"
	"testing"
	"valley-server/internal/model"

	"github.com/gin-gonic/gin"
)

func TestCanViewResourceProvenance(t *testing.T) {
	gin.SetMode(gin.TestMode)
	privateResource := model.Resource{UserID: 42, Visibility: "private"}
	publicResource := model.Resource{UserID: 42, Visibility: "public"}

	tests := []struct {
		name               string
		resource           model.Resource
		userID             *int64
		role               string
		wantCanView        bool
		wantPrivateContext bool
	}{
		{name: "visitor can view public resource", resource: publicResource, wantCanView: true},
		{name: "visitor cannot view private resource", resource: privateResource},
		{name: "owner can view private context", resource: privateResource, userID: pointerTo(int64(42)), wantCanView: true, wantPrivateContext: true},
		{name: "other user cannot view private resource", resource: privateResource, userID: pointerTo(int64(7))},
		{name: "admin can view private context", resource: privateResource, role: "admin", wantCanView: true, wantPrivateContext: true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			context, _ := gin.CreateTestContext(httptest.NewRecorder())
			if tt.userID != nil {
				context.Set("userId", *tt.userID)
			}
			if tt.role != "" {
				context.Set("userRole", tt.role)
			}

			canView, canViewPrivateContext := canViewResourceProvenance(context, tt.resource)
			if canView != tt.wantCanView || canViewPrivateContext != tt.wantPrivateContext {
				t.Fatalf("got canView=%v privateContext=%v, want canView=%v privateContext=%v", canView, canViewPrivateContext, tt.wantCanView, tt.wantPrivateContext)
			}
		})
	}
}

func pointerTo(value int64) *int64 {
	return &value
}
