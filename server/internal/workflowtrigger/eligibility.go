package workflowtrigger

import (
	"encoding/json"
	"fmt"
	"strings"

	"valley-server/internal/workflow"
)

const (
	TypeCron    = "cron"
	TypeWebhook = "webhook"
	TypeEvent   = "event"
)

// ValidateGraph restricts durable triggers to graphs whose invocation contract
// can be represented by a JSON snapshot. Cron stays unattended/read-only;
// authenticated webhooks and owner-scoped events may intentionally invoke
// write capabilities, while durable delivery idempotency prevents job replay.
func ValidateGraph(graph workflow.Graph, registry *workflow.Registry, triggerType string) error {
	if triggerType != TypeCron && triggerType != TypeWebhook && triggerType != TypeEvent {
		return fmt.Errorf("unsupported trigger type")
	}
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
					return fmt.Errorf("file input is not supported by durable triggers")
				}
				if triggerType == TypeCron {
					return fmt.Errorf("start inputs are not supported by scheduled runs")
				}
			}
		case workflow.NodeTypeSubworkflow:
			return fmt.Errorf("subworkflow is not supported by durable triggers")
		case workflow.NodeTypeApproval:
			if triggerType == TypeCron {
				return fmt.Errorf("manual approval is not supported by scheduled runs")
			}
		case workflow.NodeTypeHTTP:
			if triggerType != TypeCron {
				continue
			}
			var config struct {
				Method string `json:"method"`
			}
			if err := json.Unmarshal(node.Config, &config); err != nil {
				return fmt.Errorf("HTTP configuration is invalid")
			}
			method := strings.ToUpper(strings.TrimSpace(config.Method))
			if method != "GET" && method != "HEAD" {
				return fmt.Errorf("scheduled HTTP requests must use GET or HEAD")
			}
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
			if triggerType == TypeCron && capability.SideEffect != "none" && capability.SideEffect != "read" {
				return fmt.Errorf("tool %s has side effects", config.CapabilityID)
			}
		}
	}
	return nil
}

func ValidateScheduledGraph(graph workflow.Graph, registry *workflow.Registry) error {
	return ValidateGraph(graph, registry, TypeCron)
}
