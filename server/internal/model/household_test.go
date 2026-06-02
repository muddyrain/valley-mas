package model

import (
	"reflect"
	"strings"
	"testing"
)

func TestHouseholdModelDefaultsAndIndexes(t *testing.T) {
	householdField, ok := reflect.TypeOf(Household{}).FieldByName("Kind")
	if !ok {
		t.Fatal("expected Kind field on Household")
	}
	if tag := householdField.Tag.Get("gorm"); !strings.Contains(tag, "default:'shared'") {
		t.Fatalf("expected Household.Kind to default to shared, got %q", tag)
	}

	memberField, ok := reflect.TypeOf(HouseholdMember{}).FieldByName("HouseholdID")
	if !ok {
		t.Fatal("expected HouseholdID field on HouseholdMember")
	}
	if tag := memberField.Tag.Get("gorm"); !strings.Contains(tag, "uidx_household_member_status") {
		t.Fatalf("expected HouseholdMember.HouseholdID to use composite uniqueness tag, got %q", tag)
	}

	inviteField, ok := reflect.TypeOf(HouseholdInvite{}).FieldByName("InviteCode")
	if !ok {
		t.Fatal("expected InviteCode field on HouseholdInvite")
	}
	if tag := inviteField.Tag.Get("gorm"); !strings.Contains(tag, "uniqueIndex") {
		t.Fatalf("expected HouseholdInvite.InviteCode to be unique, got %q", tag)
	}
}

func TestPersonalHouseholdUsesDeterministicNegativeID(t *testing.T) {
	household := Household{
		Kind:        "personal",
		OwnerUserID: 123,
	}

	if err := household.BeforeCreate(nil); err != nil {
		t.Fatalf("before create: %v", err)
	}
	if household.ID != Int64String(-123) {
		t.Fatalf("expected deterministic personal household id -123, got %s", household.ID.String())
	}
}
