package handler

import "testing"

func TestWorkflowTestAssertionsSupportDeclaredRules(t *testing.T) {
	assertions := []workflowTestAssertion{
		{Field: "title", Operator: "exists"},
		{Field: "title", Operator: "type", Value: "string"},
		{Field: "title", Operator: "equals", Value: "Valley"},
		{Field: "title", Operator: "contains", Value: "all"},
		{Field: "score", Operator: "range", Value: map[string]any{"min": 80.0, "max": 100.0}},
		{Field: "meta", Operator: "jsonSchema", Value: map[string]any{
			"type":       "object",
			"required":   []any{"source"},
			"properties": map[string]any{"source": map[string]any{"type": "string"}},
		}},
	}
	if err := validateWorkflowTestAssertions(assertions); err != nil {
		t.Fatalf("validate assertions: %v", err)
	}
	results, passed := evaluateWorkflowTestAssertions(map[string]any{
		"title": "Valley",
		"score": 92,
		"meta":  map[string]any{"source": "test"},
	}, assertions)
	if !passed || len(results) != len(assertions) {
		t.Fatalf("passed=%v results=%+v", passed, results)
	}
}

func TestWorkflowTestAssertionsRejectUnsupportedSchema(t *testing.T) {
	assertions := []workflowTestAssertion{{
		Field:    "title",
		Operator: "jsonSchema",
		Value:    map[string]any{"type": "array"},
	}}
	if err := validateWorkflowTestAssertions(assertions); err != nil {
		t.Fatalf("schema is structurally valid: %v", err)
	}
	_, passed := evaluateWorkflowTestAssertions(map[string]any{"title": []any{}}, assertions)
	if passed {
		t.Fatal("unsupported schema type must not pass")
	}
}
