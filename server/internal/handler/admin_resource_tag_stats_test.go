package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"valley-server/internal/database"
	"valley-server/internal/model"
)

func TestAdminGetResourceTagStatsPaginatesAggregatedTags(t *testing.T) {
	router := setupAdminOperationsTestDB(t)
	router.GET("/admin/resource-tags/stats", AdminGetResourceTagStats)

	user := model.User{
		ID:       701,
		OpenID:   "resource-tag-admin-test",
		Username: "resource-tag-admin-test",
		Nickname: "Resource Tag Admin Test",
		IsActive: true,
	}
	if err := database.DB.Create(&user).Error; err != nil {
		t.Fatalf("seed user: %v", err)
	}
	resources := []model.Resource{
		{ID: 711, UserID: user.ID, Title: "One", Tags: model.StringList{"alpha", "beta", "gamma"}},
		{ID: 712, UserID: user.ID, Title: "Two", Tags: model.StringList{"beta", "gamma", "delta"}},
		{ID: 713, UserID: user.ID, Title: "Three", Tags: model.StringList{"gamma", "epsilon"}},
	}
	if err := database.DB.Create(&resources).Error; err != nil {
		t.Fatalf("seed resources: %v", err)
	}

	req := httptest.NewRequest(http.MethodGet, "/admin/resource-tags/stats?page=2&pageSize=2", nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	data := decodeResponseData(t, rec)
	if got := int(data["total"].(float64)); got != 5 {
		t.Fatalf("total=%d, want 5", got)
	}
	if got := int(data["page"].(float64)); got != 2 {
		t.Fatalf("page=%d, want 2", got)
	}
	if got := int(data["pageSize"].(float64)); got != 2 {
		t.Fatalf("pageSize=%d, want 2", got)
	}
	list := data["list"].([]interface{})
	if len(list) != 2 {
		t.Fatalf("list length=%d, want 2; data=%#v", len(list), data)
	}
	first := list[0].(map[string]interface{})
	second := list[1].(map[string]interface{})
	if first["name"] != "alpha" || second["name"] != "delta" {
		t.Fatalf("unexpected second page: %#v", list)
	}
}
