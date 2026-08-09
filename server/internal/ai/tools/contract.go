package tools

// RiskLevel describes the user impact of a tool invocation. It is transport
// neutral so the same contract can later be mapped to MCP or workflow tools.
type RiskLevel string

const (
	RiskLow    RiskLevel = "low"
	RiskMedium RiskLevel = "medium"
	RiskHigh   RiskLevel = "high"
)

// ConfirmationPolicy states whether a tool may run immediately or must pause
// for an owner decision before it writes durable user data.
type ConfirmationPolicy string

const (
	ConfirmationNever       ConfirmationPolicy = "never"
	ConfirmationBeforeWrite ConfirmationPolicy = "before_write"
)

const (
	ResultCardTool          = "tool_result"
	ResultCardClarification = "clarification"
	ResultCardImage         = "image_result"
	ResultCardFile          = "file_artifact"
	ResultCardConversion    = "conversion_result"
)

// Contract is the stable, MCP-adaptable description of an internal tool.
// Name, Description, Scope and InputSchema are always taken from Tool itself;
// optional providers can only add output and presentation metadata.
type Contract struct {
	Name         string
	Description  string
	Scope        string
	InputSchema  map[string]any
	OutputSchema map[string]any
	RiskLevel    RiskLevel
	Confirmation ConfirmationPolicy
	ResultCard   string
}

// ContractProvider is optional so existing tools remain source compatible.
type ContractProvider interface {
	ToolContract() Contract
}

// ContractFor returns a complete contract with conservative defaults.
func ContractFor(tool Tool) Contract {
	contract := Contract{
		OutputSchema: map[string]any{"type": "object"},
		RiskLevel:    RiskLow,
		Confirmation: ConfirmationNever,
		ResultCard:   ResultCardTool,
	}
	if provider, ok := tool.(ContractProvider); ok {
		provided := provider.ToolContract()
		if provided.OutputSchema != nil {
			contract.OutputSchema = provided.OutputSchema
		}
		if provided.RiskLevel != "" {
			contract.RiskLevel = provided.RiskLevel
		}
		if provided.Confirmation != "" {
			contract.Confirmation = provided.Confirmation
		}
		if provided.ResultCard != "" {
			contract.ResultCard = provided.ResultCard
		}
	}
	contract.Name = tool.Name()
	contract.Description = tool.Description()
	contract.Scope = tool.Scope()
	contract.InputSchema = tool.Schema()
	return contract
}
