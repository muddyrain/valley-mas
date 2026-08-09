package motionsticker

import (
	"testing"

	"valley-server/internal/ai/tools"
)

func TestGenerateToolContractReturnsDurableTask(t *testing.T) {
	contract := tools.ContractFor(NewGenerateTool(nil))
	if contract.Name != ToolName || contract.ResultCard != tools.ResultCardTool || contract.RiskLevel != tools.RiskMedium {
		t.Fatalf("unexpected contract: %+v", contract)
	}
	required, _ := contract.OutputSchema["required"].([]string)
	if len(required) != 2 || required[0] != "generationId" || required[1] != "status" {
		t.Fatalf("unexpected output requirements: %+v", required)
	}
}

func TestGenerateToolDefaultsToImageMode(t *testing.T) {
	properties := NewGenerateTool(nil).Schema()["properties"].(map[string]any)
	mode := properties["mode"].(map[string]any)
	if mode["default"] != "image" {
		t.Fatalf("mode schema = %+v", mode)
	}
}
