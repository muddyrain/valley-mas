package lifetrace

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"testing"
	"valley-server/internal/config"
	"valley-server/internal/database"
	"valley-server/internal/model"

	"github.com/gin-gonic/gin"
)

func buildTraceTestRouter(userID model.Int64String, webPush ...config.WebPushConfig) *gin.Engine {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	auth := func(c *gin.Context) {
		c.Set("userId", userID)
		c.Next()
	}
	handlerArgs := []config.WebPushConfig{}
	if len(webPush) > 0 {
		handlerArgs = append(handlerArgs, webPush[0])
	}
	RegisterRoutes(router.Group("/api/v1"), NewHandler(NewWeatherService(config.QWeatherConfig{}), handlerArgs...), auth)
	return router
}

func TestListHouseholdsCreatesPersonalHouseholdAndAllowsCreateSharedHousehold(t *testing.T) {
	router := setupTraceTestRouter(t, 101)

	listReq := httptest.NewRequest(http.MethodGet, "/api/v1/life-trace/households", nil)
	listResp := httptest.NewRecorder()
	router.ServeHTTP(listResp, listReq)

	data := decodeTracePayload(t, listResp)["data"].(map[string]interface{})
	list := data["list"].([]interface{})
	if len(list) != 1 {
		t.Fatalf("expected personal household to be created lazily, got %+v", list)
	}
	first := list[0].(map[string]interface{})
	if first["kind"] != householdKindPersonal || first["name"] != "我的空间" {
		t.Fatalf("expected personal household summary, got %+v", first)
	}
	if data["currentHouseholdId"] != first["id"] {
		t.Fatalf("expected current household id to point personal household, got %+v", data)
	}

	createReq := httptest.NewRequest(http.MethodPost, "/api/v1/life-trace/households", bytes.NewBufferString(`{"name":"周末家用库存"}`))
	createReq.Header.Set("Content-Type", "application/json")
	createResp := httptest.NewRecorder()
	router.ServeHTTP(createResp, createReq)

	created := decodeTracePayload(t, createResp)["data"].(map[string]interface{})
	if created["kind"] != householdKindShared || created["role"] != householdRoleOwner {
		t.Fatalf("expected shared household owner payload, got %+v", created)
	}

	refreshReq := httptest.NewRequest(http.MethodGet, "/api/v1/life-trace/households", nil)
	refreshResp := httptest.NewRecorder()
	router.ServeHTTP(refreshResp, refreshReq)

	refreshedList := decodeTracePayload(t, refreshResp)["data"].(map[string]interface{})["list"].([]interface{})
	if len(refreshedList) != 2 {
		t.Fatalf("expected personal + shared households, got %+v", refreshedList)
	}
}

func TestHouseholdInviteJoinLeaveAndDissolveFlow(t *testing.T) {
	router101 := setupTraceTestRouter(t, 101)

	createReq := httptest.NewRequest(http.MethodPost, "/api/v1/life-trace/households", bytes.NewBufferString(`{"name":"爸妈家"}`))
	createReq.Header.Set("Content-Type", "application/json")
	createResp := httptest.NewRecorder()
	router101.ServeHTTP(createResp, createReq)
	created := decodeTracePayload(t, createResp)["data"].(map[string]interface{})
	householdID := created["id"].(string)

	inviteReq := httptest.NewRequest(http.MethodPost, "/api/v1/life-trace/households/"+householdID+"/invites", bytes.NewBufferString(`{}`))
	inviteReq.Header.Set("Content-Type", "application/json")
	inviteResp := httptest.NewRecorder()
	router101.ServeHTTP(inviteResp, inviteReq)
	invite := decodeTracePayload(t, inviteResp)["data"].(map[string]interface{})
	inviteCode := invite["inviteCode"].(string)

	router202 := buildTraceTestRouter(202)
	joinReq := httptest.NewRequest(http.MethodPost, "/api/v1/life-trace/households/join", bytes.NewBufferString(`{"inviteCode":"`+inviteCode+`"}`))
	joinReq.Header.Set("Content-Type", "application/json")
	joinResp := httptest.NewRecorder()
	router202.ServeHTTP(joinResp, joinReq)

	joined := decodeTracePayload(t, joinResp)["data"].(map[string]interface{})
	if joined["id"] != householdID || joined["role"] != householdRoleMember {
		t.Fatalf("expected joined shared household, got %+v", joined)
	}

	membersReq := httptest.NewRequest(http.MethodGet, "/api/v1/life-trace/households/"+householdID+"/members", nil)
	membersResp := httptest.NewRecorder()
	router101.ServeHTTP(membersResp, membersReq)

	members := decodeTracePayload(t, membersResp)["data"].(map[string]interface{})["list"].([]interface{})
	if len(members) != 2 {
		t.Fatalf("expected two active members after join, got %+v", members)
	}

	transferReq := httptest.NewRequest(
		http.MethodPost,
		"/api/v1/life-trace/households/"+householdID+"/transfer-owner",
		bytes.NewBufferString(`{"targetUserId":202}`),
	)
	transferReq.Header.Set("Content-Type", "application/json")
	transferResp := httptest.NewRecorder()
	router101.ServeHTTP(transferResp, transferReq)

	transferData := decodeTracePayload(t, transferResp)["data"].(map[string]interface{})
	if transferData["ownerUserId"] != "202" || transferData["role"] != householdRoleAdmin {
		t.Fatalf("expected ownership transferred to 202 and current owner downgraded to admin, got %+v", transferData)
	}

	leaveReq := httptest.NewRequest(http.MethodPost, "/api/v1/life-trace/households/"+householdID+"/leave", bytes.NewBufferString(`{}`))
	leaveResp := httptest.NewRecorder()
	router101.ServeHTTP(leaveResp, leaveReq)
	leaveData := decodeTracePayload(t, leaveResp)["data"].(map[string]interface{})
	if leaveData["left"] != true {
		t.Fatalf("expected leave response, got %+v", leaveData)
	}

	membersReq = httptest.NewRequest(http.MethodGet, "/api/v1/life-trace/households/"+householdID+"/members", nil)
	membersResp = httptest.NewRecorder()
	router202.ServeHTTP(membersResp, membersReq)

	members = decodeTracePayload(t, membersResp)["data"].(map[string]interface{})["list"].([]interface{})
	if len(members) != 1 || members[0].(map[string]interface{})["userId"] != "202" {
		t.Fatalf("expected only new owner to remain active, got %+v", members)
	}

	dissolveReq := httptest.NewRequest(http.MethodPost, "/api/v1/life-trace/households/"+householdID+"/dissolve", bytes.NewBufferString(`{}`))
	dissolveResp := httptest.NewRecorder()
	router202.ServeHTTP(dissolveResp, dissolveReq)
	dissolved := decodeTracePayload(t, dissolveResp)["data"].(map[string]interface{})
	if dissolved["status"] != householdStatusDissolved {
		t.Fatalf("expected dissolved household, got %+v", dissolved)
	}

	var household model.Household
	if err := database.GetDB().First(&household, "id = ?", householdID).Error; err != nil {
		t.Fatalf("load dissolved household: %v", err)
	}
	if household.Status != householdStatusDissolved {
		t.Fatalf("expected household status dissolved, got %+v", household)
	}
}
