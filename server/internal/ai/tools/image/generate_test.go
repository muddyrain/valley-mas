package image

import (
	"testing"

	"valley-server/internal/ai/tools"
)

func TestGenerateToolContractUsesImageResultCard(t *testing.T) {
	contract := tools.ContractFor(NewGenerateTool(nil, nil))
	if contract.ResultCard != tools.ResultCardImage || contract.RiskLevel != tools.RiskMedium {
		t.Fatalf("unexpected contract: %#v", contract)
	}
	if contract.Confirmation != tools.ConfirmationNever {
		t.Fatalf("image generation must not require confirmation: %#v", contract)
	}
}
