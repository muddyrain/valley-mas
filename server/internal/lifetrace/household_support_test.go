package lifetrace

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"valley-server/internal/database"
	"valley-server/internal/model"
)

func TestEnsurePersonalHouseholdDeduplicatesExistingPersonalSpaces(t *testing.T) {
	router := setupTraceTestRouter(t, 101)

	primary := model.Household{
		Name:        "我的空间",
		Kind:        householdKindPersonal,
		OwnerUserID: 101,
		Status:      householdStatusActive,
	}
	duplicate := model.Household{
		ID:          999001,
		Name:        "我的空间",
		Kind:        householdKindPersonal,
		OwnerUserID: 101,
		Status:      householdStatusActive,
	}
	if err := database.GetDB().Create(&primary).Error; err != nil {
		t.Fatalf("create primary personal household: %v", err)
	}
	if err := database.GetDB().Create(&duplicate).Error; err != nil {
		t.Fatalf("create duplicate personal household: %v", err)
	}
	if err := database.GetDB().Create(&model.HouseholdMember{
		HouseholdID: duplicate.ID,
		UserID:      101,
		Role:        householdRoleOwner,
		Status:      householdMemberStatusActive,
	}).Error; err != nil {
		t.Fatalf("create duplicate membership: %v", err)
	}
	if err := database.GetDB().Create(&model.LifeTracePantryItem{
		UserID:             101,
		HouseholdID:        duplicate.ID,
		CreatedBy:          101,
		UpdatedBy:          101,
		Name:               "重复库存",
		Category:           "食品",
		Quantity:           1,
		Unit:               "件",
		Location:           "厨房",
		Status:             "normal",
		ReminderEnabled:    true,
		ReminderUseDefault: true,
		ReminderRules:      model.StringList{"7d", "3d", "same-day", "expired"},
		ReminderTime:       "09:00",
	}).Error; err != nil {
		t.Fatalf("create pantry item on duplicate household: %v", err)
	}

	req := httptest.NewRequest(http.MethodGet, "/api/v1/life-trace/households", nil)
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	data := decodeTracePayload(t, resp)["data"].(map[string]interface{})
	list := data["list"].([]interface{})
	if len(list) != 1 {
		t.Fatalf("expected duplicate personal households to be collapsed, got %+v", list)
	}

	var activeCount int64
	if err := database.GetDB().
		Model(&model.Household{}).
		Where("owner_user_id = ? AND kind = ? AND status = ? AND deleted_at IS NULL", 101, householdKindPersonal, householdStatusActive).
		Count(&activeCount).Error; err != nil {
		t.Fatalf("count active personal households: %v", err)
	}
	if activeCount != 1 {
		t.Fatalf("expected exactly one active personal household, got %d", activeCount)
	}

	var pantryItem model.LifeTracePantryItem
	if err := database.GetDB().First(&pantryItem, "name = ?", "重复库存").Error; err != nil {
		t.Fatalf("load pantry item: %v", err)
	}
	primaryID := list[0].(map[string]interface{})["id"].(string)
	if pantryItem.HouseholdID.String() != primaryID {
		t.Fatalf("expected pantry item to be reassigned to surviving household %s, got %s", primaryID, pantryItem.HouseholdID.String())
	}
}
