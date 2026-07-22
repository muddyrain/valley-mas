package workflowtrigger

import (
	"encoding/json"
	"fmt"

	"valley-server/internal/workflow"
)

// ValidateScheduledGraph restricts the first production trigger slice to
// self-contained, read-only graphs. Subworkflows are rejected until their
// complete capability graph can be evaluated transitively.
func ValidateScheduledGraph(graph workflow.Graph, registry *workflow.Registry) error {
	for _, node := range graph.Nodes {
		switch node.Type {
		case workflow.NodeTypeStart:
			var config struct {
				Inputs map[string]struct {
					Type workflow.ValueType `json:"type"`
				} `json:"inputs"`
			}
			if err := json.Unmarshal(node.Config, &config); err != nil {
				return fmt.Errorf("start input configuration is invalid")
			}
			for _, input := range config.Inputs {
				if input.Type == workflow.ValueTypeFile {
					return fmt.Errorf("file input is not supported by scheduled runs")
				}
			}
		case workflow.NodeTypeSubworkflow:
			return fmt.Errorf("subworkflow is not supported by scheduled runs")
		case workflow.NodeTypeTool:
			var config struct {
				CapabilityID string `json:"capabilityId"`
			}
			if err := json.Unmarshal(node.Config, &config); err != nil {
				return fmt.Errorf("tool configuration is invalid")
			}
			capability, _, found := registry.Capability(config.CapabilityID)
			if !found {
				return fmt.Errorf("tool capability is unavailable")
			}
			if capability.SideEffect != "none" && capability.SideEffect != "read" {
				return fmt.Errorf("tool %s has side effects", config.CapabilityID)
			}
		}
	}
	return nil
}
