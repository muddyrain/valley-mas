package agent

import "testing"

func TestRegistryRegistersAndFindsAction(t *testing.T) {
	registry := NewRegistry(ActionSpec{
		Type:           "create_plan",
		Description:    "create a plan",
		RequiredFields: []string{"title"},
	})

	spec, ok := registry.Get("create_plan")
	if !ok {
		t.Fatal("expected action to be registered")
	}
	if spec.RequiredFields[0] != "title" {
		t.Fatalf("unexpected spec: %+v", spec)
	}
}

func TestRegistryRejectsEmptyActionType(t *testing.T) {
	registry := NewRegistry()
	if err := registry.Register(ActionSpec{}); err == nil {
		t.Fatal("expected empty action type to be rejected")
	}
}
