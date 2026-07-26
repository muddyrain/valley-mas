package workflow

import (
	"context"
	"reflect"
	"testing"
)

func TestListProcessingCapabilityOperations(t *testing.T) {
	items := []any{
		map[string]any{"id": "a", "score": 10.0, "author": map[string]any{"name": "Ada"}},
		map[string]any{"id": "b", "score": 5.0, "author": map[string]any{"name": "Bob"}},
		map[string]any{"id": "c", "score": 10.0, "author": map[string]any{"name": "Ada"}},
	}
	adapter := ListProcessingCapabilityAdapter{}

	t.Run("filter", func(t *testing.T) {
		result, err := adapter.Execute(context.Background(), RunContext{}, NodeExecution{Input: map[string]any{
			"items": items, "operation": "filter", "field": "score",
			"operator": "greaterOrEqual", "value": "10",
		}})
		if err != nil {
			t.Fatalf("filter list: %v", err)
		}
		filtered := result.Output["items"].([]any)
		if len(filtered) != 2 || result.Output["originalCount"] != 3 {
			t.Fatalf("unexpected filter output: %#v", result.Output)
		}
	})

	t.Run("map nested field", func(t *testing.T) {
		result, err := adapter.Execute(context.Background(), RunContext{}, NodeExecution{Input: map[string]any{
			"items": items, "operation": "map", "field": "author.name",
		}})
		if err != nil {
			t.Fatalf("map list: %v", err)
		}
		if !reflect.DeepEqual(result.Output["items"], []any{"Ada", "Bob", "Ada"}) {
			t.Fatalf("unexpected map output: %#v", result.Output)
		}
	})

	t.Run("stable sort", func(t *testing.T) {
		result, err := adapter.Execute(context.Background(), RunContext{}, NodeExecution{Input: map[string]any{
			"items": items, "operation": "sort", "field": "score", "direction": "desc",
		}})
		if err != nil {
			t.Fatalf("sort list: %v", err)
		}
		sorted := result.Output["items"].([]any)
		if sorted[0].(map[string]any)["id"] != "a" || sorted[1].(map[string]any)["id"] != "c" {
			t.Fatalf("sort was not stable: %#v", sorted)
		}
	})

	t.Run("dedupe", func(t *testing.T) {
		result, err := adapter.Execute(context.Background(), RunContext{}, NodeExecution{Input: map[string]any{
			"items": items, "operation": "dedupe", "field": "author.name",
		}})
		if err != nil {
			t.Fatalf("dedupe list: %v", err)
		}
		deduped := result.Output["items"].([]any)
		if len(deduped) != 2 || deduped[0].(map[string]any)["id"] != "a" {
			t.Fatalf("unexpected dedupe output: %#v", deduped)
		}
	})
}

func TestListProcessingCapabilitySupportsTypedStructFields(t *testing.T) {
	items := []ContentSearchItem{
		{ID: "2", Title: "Beta"},
		{ID: "1", Title: "Alpha"},
	}
	result, err := (ListProcessingCapabilityAdapter{}).Execute(
		context.Background(),
		RunContext{},
		NodeExecution{Input: map[string]any{
			"items": items, "operation": "sort", "field": "title", "direction": "asc",
		}},
	)
	if err != nil {
		t.Fatalf("sort typed list: %v", err)
	}
	sorted := result.Output["items"].([]any)
	if sorted[0].(ContentSearchItem).ID != "1" {
		t.Fatalf("unexpected typed sort output: %#v", sorted)
	}
}

func TestListProcessingCapabilityRejectsInvalidInputs(t *testing.T) {
	adapter := ListProcessingCapabilityAdapter{}
	if _, err := adapter.Execute(context.Background(), RunContext{}, NodeExecution{Input: map[string]any{
		"items": "not-an-array", "operation": "map",
	}}); err == nil {
		t.Fatal("expected array validation error")
	}
	if _, err := adapter.Execute(context.Background(), RunContext{}, NodeExecution{Input: map[string]any{
		"items": []any{1}, "operation": "filter", "operator": "greaterThan", "value": "many",
	}}); err == nil {
		t.Fatal("expected numeric comparison validation error")
	}
}

func TestListProcessingCapabilityDefaultsToFilter(t *testing.T) {
	result, err := (ListProcessingCapabilityAdapter{}).Execute(
		context.Background(),
		RunContext{},
		NodeExecution{Input: map[string]any{
			"items":    []any{"draft", "published"},
			"operator": "equals",
			"value":    "draft",
		}},
	)
	if err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(result.Output["items"], []any{"draft"}) {
		t.Fatalf("unexpected default filter output: %#v", result.Output["items"])
	}
}
