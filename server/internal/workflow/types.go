package workflow

import (
	"context"
	"encoding/json"
	"errors"
)

const SchemaVersion = 4

var ErrNodeCancelled = errors.New("workflow node cancelled")

type NodeType string

type ValueType string

const (
	ValueTypeString     ValueType = "string"
	ValueTypeStringList ValueType = "string[]"
	ValueTypeArray      ValueType = "array"
	ValueTypeObject     ValueType = "object"
	ValueTypeNumber     ValueType = "number"
	ValueTypeBoolean    ValueType = "boolean"
	ValueTypeFile       ValueType = "file"
)

const (
	NodeTypeStart         NodeType = "start"
	NodeTypeEnd           NodeType = "end"
	NodeTypeLLM           NodeType = "llm"
	NodeTypeTemplate      NodeType = "template"
	NodeTypeHTTP          NodeType = "http"
	NodeTypeTool          NodeType = "tool"
	NodeTypeCondition     NodeType = "condition"
	NodeTypeSwitch        NodeType = "switch"
	NodeTypeMerge         NodeType = "merge"
	NodeTypeVariable      NodeType = "variable"
	NodeTypeSubworkflow   NodeType = "subworkflow"
	NodeTypeIntent        NodeType = "intent"
	NodeTypeLoop          NodeType = "loop"
	NodeTypeSetLoopVar    NodeType = "set_loop_variable"
	NodeTypeContinueLoop  NodeType = "continue_loop"
	NodeTypeTerminateLoop NodeType = "terminate_loop"
	NodeTypeApproval      NodeType = "approval"
	NodeTypeDelay         NodeType = "delay"
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
	StatusCancelled RunStatus = "cancelled"
	StatusWaiting   RunStatus = "waiting_approval"
)

type RunContext struct {
	ID                       string
	Actor                    Actor
	Inputs                   map[string]any
	Outputs                  map[string]map[string]any
	CompletedNodes           map[string]CompletedNode
	ResumeFromNodeID         string
	KnowledgeRetriever       KnowledgeRetriever
	ContentSearcher          ContentSearcher
	NotionSearcher           NotionSearcher
	CoverGenerator           CoverGenerator
	AIImageGenerator         AIImageGenerator
	AIImageUnderstander      AIImageUnderstander
	AIImageResourceSaver     AIImageResourceSaver
	NotificationSender       NotificationSender
	SubworkflowRunner        SubworkflowRunner
	ApprovalGate             ApprovalGate
	SkillInstructionResolver SkillInstructionResolver
	RegisterNodeCancellation func(nodeID string, cancel func()) func()
	Emitter                  func(Event)
}

type SkillInstructionResolver func(context.Context, []string) (string, error)

// CompletedNode records the branch decision for a node restored from a prior
// failed run. It is runtime-only state and is never included in public traces.
type CompletedNode struct {
	ActivateOutgoing bool
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
	RunID         string         `json:"runId"`
	Sequence      int64          `json:"sequence,omitempty"`
	NodeID        string         `json:"nodeId"`
	NodeType      NodeType       `json:"nodeType"`
	CapabilityID  string         `json:"capabilityId,omitempty"`
	Status        RunStatus      `json:"status"`
	Message       string         `json:"message,omitempty"`
	Input         map[string]any `json:"input,omitempty"`
	Output        map[string]any `json:"output,omitempty"`
	Error         string         `json:"error,omitempty"`
	DurationMs    int64          `json:"durationMs,omitempty"`
	LoopIteration *int           `json:"loopIteration,omitempty"`
	LoopDepth     int            `json:"loopDepth,omitempty"`
	BodyNodeID    string         `json:"bodyNodeId,omitempty"`
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
	Locals       map[string]any
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

type NotionSearchItem struct {
	ID           string `json:"id"`
	Title        string `json:"title"`
	URL          string `json:"url"`
	Kind         string `json:"kind"`
	LastEditedAt string `json:"lastEditedAt,omitempty"`
}

type NotionSearchResult struct {
	Items []NotionSearchItem `json:"items"`
}

type NotionSearcher interface {
	Search(context.Context, string, int) (NotionSearchResult, error)
}

type NotionSearcherFunc func(context.Context, string, int) (NotionSearchResult, error)

func (fn NotionSearcherFunc) Search(ctx context.Context, query string, limit int) (NotionSearchResult, error) {
	return fn(ctx, query, limit)
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

type GeneratedAIImage struct {
	GenerationID string
	URL          string
	Width        int
	Height       int
	Model        string
	Size         string
}

type AIImageGenerator interface {
	GenerateAIImage(context.Context, int64, string, string, string, string, string, int) (GeneratedAIImage, error)
}

type AIImageGeneratorFunc func(context.Context, int64, string, string, string, string, string, int) (GeneratedAIImage, error)

func (fn AIImageGeneratorFunc) GenerateAIImage(
	ctx context.Context,
	userID int64,
	modelID string,
	prompt string,
	aspectRatio string,
	quality string,
	referenceImage string,
	timeoutSeconds int,
) (GeneratedAIImage, error) {
	return fn(ctx, userID, modelID, prompt, aspectRatio, quality, referenceImage, timeoutSeconds)
}

type UnderstoodAIImage struct {
	Text       string
	Model      string
	TokenUsage int
}

type AIImageUnderstander interface {
	UnderstandAIImage(context.Context, int64, string, string, string) (UnderstoodAIImage, error)
}

type AIImageUnderstanderFunc func(context.Context, int64, string, string, string) (UnderstoodAIImage, error)

func (fn AIImageUnderstanderFunc) UnderstandAIImage(
	ctx context.Context,
	userID int64,
	modelID string,
	imageURL string,
	prompt string,
) (UnderstoodAIImage, error) {
	return fn(ctx, userID, modelID, imageURL, prompt)
}

type SavedAIImageResource struct {
	ResourceID string
	Title      string
	Tags       []string
	URL        string
	Visibility string
	Model      string
}

type AIImageResourceSaver interface {
	SaveAIImageResource(context.Context, int64, string, string) (SavedAIImageResource, error)
}

type AIImageResourceSaverFunc func(context.Context, int64, string, string) (SavedAIImageResource, error)

func (fn AIImageResourceSaverFunc) SaveAIImageResource(ctx context.Context, userID int64, generationID, visibility string) (SavedAIImageResource, error) {
	return fn(ctx, userID, generationID, visibility)
}

type NotificationRequest struct {
	RunID   string
	Status  string
	Title   string
	Content string
	Path    string
}

type SentNotification struct {
	ID     string
	Status string
	Path   string
}

type NotificationSender interface {
	SendNotification(context.Context, int64, NotificationRequest) (SentNotification, error)
}

type NotificationSenderFunc func(context.Context, int64, NotificationRequest) (SentNotification, error)

func (fn NotificationSenderFunc) SendNotification(
	ctx context.Context,
	userID int64,
	request NotificationRequest,
) (SentNotification, error) {
	return fn(ctx, userID, request)
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
