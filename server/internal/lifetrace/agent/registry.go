package agent

import (
	"fmt"
	"sort"
	"sync"
)

type ActionSpec struct {
	Type               string
	Description        string
	RequiredFields     []string
	NeedMoreInfoFields []string
	AuditScene         string
}

type Registry struct {
	mu      sync.RWMutex
	actions map[string]ActionSpec
}

func NewRegistry(specs ...ActionSpec) *Registry {
	r := &Registry{actions: make(map[string]ActionSpec, len(specs))}
	for _, spec := range specs {
		_ = r.Register(spec)
	}
	return r
}

func (r *Registry) Register(spec ActionSpec) error {
	if spec.Type == "" {
		return fmt.Errorf("agent action type is required")
	}
	r.mu.Lock()
	defer r.mu.Unlock()
	r.actions[spec.Type] = spec
	return nil
}

func (r *Registry) Get(actionType string) (ActionSpec, bool) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	spec, ok := r.actions[actionType]
	return spec, ok
}

func (r *Registry) Types() []string {
	r.mu.RLock()
	defer r.mu.RUnlock()
	types := make([]string, 0, len(r.actions))
	for actionType := range r.actions {
		types = append(types, actionType)
	}
	sort.Strings(types)
	return types
}

type Context struct {
	UserID    string
	Timezone  string
	Now       string
	Household string
}

type StreamEvent[T any] struct {
	Chunk  string
	Done   bool
	Error  string
	Source string
	Model  string
	Action *T
}
