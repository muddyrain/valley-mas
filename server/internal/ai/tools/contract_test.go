package tools

import (
	"context"
	"encoding/json"
	"testing"
)

type contractTestTool struct {
	contract *Contract
}

func (tool contractTestTool) Name() string        { return "document.convert" }
func (tool contractTestTool) Description() string { return "convert a private document" }
func (tool contractTestTool) Scope() string       { return "workbench" }
func (tool contractTestTool) Schema() map[string]any {
	return map[string]any{"type": "object", "required": []string{"attachmentId"}}
}
func (tool contractTestTool) Run(context.Context, json.RawMessage) (json.RawMessage, error) {
	return json.RawMessage(`{"ok":true}`), nil
}
func (tool contractTestTool) ToolContract() Contract {
	if tool.contract == nil {
		return Contract{}
	}
	return *tool.contract
}

func TestContractForUsesSafeDefaults(t *testing.T) {
	contract := ContractFor(contractTestTool{})

	if contract.Name != "document.convert" || contract.Description != "convert a private document" {
		t.Fatalf("unexpected identity: %#v", contract)
	}
	if contract.Scope != "workbench" || contract.RiskLevel != RiskLow {
		t.Fatalf("unexpected scope or risk: %#v", contract)
	}
	if contract.Confirmation != ConfirmationNever || contract.ResultCard != ResultCardTool {
		t.Fatalf("unexpected defaults: %#v", contract)
	}
	if contract.OutputSchema["type"] != "object" {
		t.Fatalf("unexpected output schema: %#v", contract.OutputSchema)
	}
}

func TestContractForKeepsToolIdentityAndAppliesPresentationMetadata(t *testing.T) {
	contract := ContractFor(contractTestTool{contract: &Contract{
		Name:         "spoofed",
		Description:  "spoofed",
		Scope:        "spoofed",
		OutputSchema: map[string]any{"type": "object", "required": []string{"artifactId"}},
		RiskLevel:    RiskMedium,
		Confirmation: ConfirmationBeforeWrite,
		ResultCard:   ResultCardConversion,
	}})

	if contract.Name != "document.convert" || contract.Description != "convert a private document" || contract.Scope != "workbench" {
		t.Fatalf("tool identity must come from Tool: %#v", contract)
	}
	if contract.RiskLevel != RiskMedium || contract.Confirmation != ConfirmationBeforeWrite || contract.ResultCard != ResultCardConversion {
		t.Fatalf("metadata not applied: %#v", contract)
	}
}
