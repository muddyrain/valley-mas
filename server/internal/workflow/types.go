package workflow

import (
	"context"
	"encoding/json"
)

const SchemaVersion = 4

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
	NodeTypeStart       NodeType = "start"
	NodeTypeEnd         NodeType = "end"
	NodeTypeLLM         NodeType = "llm"
	NodeTypeTool        NodeType = "tool"
	NodeTypeCondition   NodeType = "condition"
	NodeTypeMerge       NodeType = "merge"
	NodeTypeVariable    NodeType = "variable"
	NodeTypeSubworkflow NodeType = "subworkflow"
)

type Position struct {
	X float64 `json:"x"`
	Y float64 `json:"y"`
}

type Rule struct {
	Left     any    `json:"left"`
	Operator string `json:"operator"`
	Right    any    `json:"right,omitempty"`
}

type Node struct {
	ID       string          `json:"id"`
	Type     NodeType        `json:"type"`
	Label    string          `json:"label"`
	Position Position        `json:"position"`
	Config   json.RawMessage `json:"config"`
	When     *Rule           `json:"when,omitempty"`
}

type Edge struct {
	ID           string `json:"id,omitempty"`
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
	StatusSkipped   RunStatus = "skipped"
)

type RunContext struct {
	ID                 string
	Actor              Actor
	Inputs             map[string]any
	Outputs            map[string]map[string]any
	KnowledgeRetriever KnowledgeRetriever
	ContentSearcher    ContentSearcher
	CoverGenerator     CoverGenerator
	SubworkflowRunner  SubworkflowRunner
}

type Actor struct {
	UserID int64
	Role   string
}

type FileInput struct {
	Filename    string
	ContentType string
	Size        int64
	Content     []byte
}

type Event struct {
	RunID        string         `json:"runId"`
	NodeID       string         `json:"nodeId"`
	NodeType     NodeType       `json:"nodeType"`
	CapabilityID string         `json:"capabilityId,omitempty"`
	Status       RunStatus      `json:"status"`
	Message      string         `json:"message,omitempty"`
	Input        map[string]any `json:"input,omitempty"`
	Output       map[string]any `json:"output,omitempty"`
	Error        string         `json:"error,omitempty"`
	DurationMs   int64          `json:"durationMs,omitempty"`
}

type NodeResult struct {
	Output   map[string]any
	Metadata map[string]any
}

type NodeExecution struct {
	NodeID       string
	NodeType     NodeType
	CapabilityID string
	Input        map[string]any
}

type KnowledgeReference struct {
	DocumentName string  `json:"documentName"`
	ChunkID      string  `json:"chunkId"`
	Excerpt      string  `json:"excerpt"`
	Score        float64 `json:"score"`
}

type KnowledgeResult struct {
	Context    string               `json:"context"`
	References []KnowledgeReference `json:"references"`
}

type KnowledgeRetriever interface {
	Retrieve(context.Context, string) (KnowledgeResult, error)
}

type KnowledgeRetrieverFunc func(context.Context, string) (KnowledgeResult, error)

func (fn KnowledgeRetrieverFunc) Retrieve(ctx context.Context, query string) (KnowledgeResult, error) {
	return fn(ctx, query)
}

type ContentSearchItem struct {
	Type    string `json:"type"`
	ID      string `json:"id"`
	Title   string `json:"title"`
	Excerpt string `json:"excerpt"`
	Href    string `json:"href"`
}

type ContentSearchResult struct {
	Items []ContentSearchItem `json:"items"`
}

type ContentSearcher interface {
	Search(context.Context, string, string, string) (ContentSearchResult, error)
}

type ContentSearcherFunc func(context.Context, string, string, string) (ContentSearchResult, error)

func (fn ContentSearcherFunc) Search(ctx context.Context, query, createdFrom, createdTo string) (ContentSearchResult, error) {
	return fn(ctx, query, createdFrom, createdTo)
}

type GeneratedCover struct {
	URL        string `json:"url"`
	StorageKey string `json:"storageKey"`
	Model      string `json:"model"`
	Size       string `json:"size"`
}

type CoverGenerator interface {
	GenerateCover(context.Context, int64, string, string, string) (GeneratedCover, error)
}

type CoverGeneratorFunc func(context.Context, int64, string, string, string) (GeneratedCover, error)

func (fn CoverGeneratorFunc) GenerateCover(ctx context.Context, userID int64, title, summary, style string) (GeneratedCover, error) {
	return fn(ctx, userID, title, summary, style)
}

type SubworkflowRequest struct {
	WorkflowID string
	VersionID  string
	Inputs     map[string]any
}

type SubworkflowRunner interface {
	Run(context.Context, Actor, SubworkflowRequest) (map[string]any, error)
}

type SubworkflowRunnerFunc func(context.Context, Actor, SubworkflowRequest) (map[string]any, error)

func (fn SubworkflowRunnerFunc) Run(ctx context.Context, actor Actor, request SubworkflowRequest) (map[string]any, error) {
	return fn(ctx, actor, request)
}

type NodeExecutor interface {
	Type() NodeType
	Execute(context.Context, RunContext, NodeExecution) (NodeResult, error)
}

type CapabilityExecutor interface {
	Execute(context.Context, RunContext, NodeExecution) (NodeResult, error)
}
