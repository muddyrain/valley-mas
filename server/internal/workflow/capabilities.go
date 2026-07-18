package workflow

type CapabilityCatalog struct {
	SchemaVersion    int              `json:"schemaVersion"`
	NodeTypes        []NodeDefinition `json:"nodeTypes"`
	ToolCapabilities []ToolCapability `json:"toolCapabilities"`
	Limits           Limits           `json:"limits"`
}

func Capabilities(registry *Registry) CapabilityCatalog {
	if registry == nil {
		return CapabilityCatalog{SchemaVersion: SchemaVersion, Limits: DefaultLimits}
	}
	return CapabilityCatalog{
		SchemaVersion:    SchemaVersion,
		NodeTypes:        registry.NodeDefinitions(),
		ToolCapabilities: registry.ToolCapabilities(),
		Limits:           DefaultLimits,
	}
}
