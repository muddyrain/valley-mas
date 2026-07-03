package tools

import (
	"context"
	"encoding/json"
	"testing"
)

type stubTool struct {
	name  string
	scope string
}

func (s stubTool) Name() string           { return s.name }
func (s stubTool) Description() string    { return "stub-" + s.name }
func (s stubTool) Schema() map[string]any { return map[string]any{"type": "object"} }
func (s stubTool) Scope() string          { return s.scope }
func (s stubTool) Run(_ context.Context, _ json.RawMessage) (json.RawMessage, error) {
	return json.RawMessage(`{"ok":true}`), nil
}

func TestRegistryRegisterAndGet(t *testing.T) {
	r := NewRegistry()
	if err := r.Register(stubTool{name: "a", scope: "life-trace"}); err != nil {
		t.Fatalf("register a: %v", err)
	}
	if got := r.Get("a"); got == nil {
		t.Fatalf("Get(\"a\") returned nil")
	}
	if got := r.Get("missing"); got != nil {
		t.Fatalf("Get(\"missing\") should be nil, got %v", got)
	}
}

func TestRegistryDuplicateName(t *testing.T) {
	r := NewRegistry()
	if err := r.Register(stubTool{name: "a", scope: "s"}); err != nil {
		t.Fatalf("first register: %v", err)
	}
	err := r.Register(stubTool{name: "a", scope: "s"})
	if err == nil {
		t.Fatalf("expected duplicate error")
	}
}

func TestRegistryRegisterInvalid(t *testing.T) {
	r := NewRegistry()
	if err := r.Register(nil); err == nil {
		t.Fatalf("nil tool should error")
	}
	if err := r.Register(stubTool{name: "", scope: "s"}); err == nil {
		t.Fatalf("empty name should error")
	}
}

func TestRegistryFilter(t *testing.T) {
	r := NewRegistry()
	r.MustRegister(stubTool{name: "a", scope: "life-trace"})
	r.MustRegister(stubTool{name: "b", scope: "life-trace"})
	r.MustRegister(stubTool{name: "c", scope: "blog"})

	got := r.Filter("life-trace", nil)
	if len(got) != 2 || got[0].Name() != "a" || got[1].Name() != "b" {
		t.Fatalf("scope filter: %+v", got)
	}

	got = r.Filter("life-trace", []string{"b"})
	if len(got) != 1 || got[0].Name() != "b" {
		t.Fatalf("name whitelist: %+v", got)
	}

	got = r.Filter("", []string{"a", "c"})
	if len(got) != 2 || got[0].Name() != "a" || got[1].Name() != "c" {
		t.Fatalf("empty scope with names: %+v", got)
	}

	got = r.Filter("life-trace", []string{"missing"})
	if len(got) != 0 {
		t.Fatalf("unknown name should filter out: %+v", got)
	}
}

func TestMustRegisterPanicsOnDuplicate(t *testing.T) {
	r := NewRegistry()
	r.MustRegister(stubTool{name: "a", scope: "s"})
	defer func() {
		if recover() == nil {
			t.Fatalf("expected panic on duplicate MustRegister")
		}
	}()
	r.MustRegister(stubTool{name: "a", scope: "s"})
}
