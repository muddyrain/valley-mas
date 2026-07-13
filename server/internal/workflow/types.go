package workflow

import (
	"context"
	"encoding/json"
)

type NodeType string

type ValueType string

const (
	ValueTypeString     ValueType = "string"
	ValueTypeStringList ValueType = "string[]"
	ValueTypeObject     ValueType = "object"
	ValueTypeNumber     ValueType = "number"
	ValueTypeBoolean    ValueType = "boolean"
	ValueTypeFile       ValueType = "file"
)

const (
	NodeTypeStart           NodeType = "start"
	NodeTypeBlogParse       NodeType = "blog.parseMarkdown"
	NodeTypeLLMText         NodeType = "llm.text"
	NodeTypeBlogCreateDraft NodeType = "blog.createDraft"
	NodeTypeVariable        NodeType = "variable"
	NodeTypeHTTP            NodeType = "http"
	NodeTypeCode            NodeType = "code"
	NodeTypeEnd             NodeType = "end"
)

type Node struct {
	ID     string          `json:"id"`
	Type   NodeType        `json:"type"`
	Config json.RawMessage `json:"config"`
}

type Edge struct {
	Source       string `json:"source"`
	SourceHandle string `json:"sourceHandle,omitempty"`
	Target       string `json:"target"`
	TargetHandle string `json:"targetHandle,omitempty"`
}

type Graph struct {
	SchemaVersion int    `json:"schemaVersion"`
	Nodes         []Node `json:"nodes"`
	Edges         []Edge `json:"edges"`
}

type RunStatus string

const (
	StatusRunning   RunStatus = "running"
	StatusSucceeded RunStatus = "success"
	StatusFailed    RunStatus = "error"
)

type RunContext struct {
	ID      string
	Actor   Actor
	Inputs  map[string]any
	Outputs map[string]map[string]any
}

// Actor is the authenticated user who started a workflow run. It is runtime
// context rather than a graph input, so workflow definitions cannot forge an
// owner or elevate their role.
type Actor struct {
	UserID int64
	Role   string
}

// FileInput is a runtime-only uploaded file. Content must never be persisted
// or included in events; safePreviewMap emits only its metadata.
type FileInput struct {
	Filename    string
	ContentType string
	Size        int64
	Content     []byte
}

// Event is emitted at every node state transition. Input and Output contain
// only values already supplied to, or produced by, the workflow runtime.
type Event struct {
	RunID      string         `json:"runId"`
	NodeID     string         `json:"nodeId"`
	Status     RunStatus      `json:"status"`
	Message    string         `json:"message,omitempty"`
	Input      map[string]any `json:"input,omitempty"`
	Output     map[string]any `json:"output,omitempty"`
	Error      string         `json:"error,omitempty"`
	DurationMs int64          `json:"durationMs,omitempty"`
}

type NodeResult struct {
	Output   map[string]any
	Metadata map[string]any
}

// NodeExecution is the runtime view of a graph node. Input contains the
// already resolved, type-preserving configuration values for this execution.
type NodeExecution struct {
	NodeID   string
	NodeType NodeType
	Input    map[string]any
}

type NodeExecutor interface {
	Type() NodeType
	Execute(context.Context, RunContext, NodeExecution) (NodeResult, error)
}
