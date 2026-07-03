// Package tools 定义 Valley MAS agent runtime 使用的工具接口与注册表。
//
// 分层约束：
//
//   - 根包（本文件）只放接口和 Registry，只依赖标准库。
//     禁止 import 任何业务包。
//   - 领域子包（例如 tools/lifetrace）负责具体 tool 实现，可以 import
//     业务包，通过 init() 或显式 Register 反向注册到根 Registry。
//   - agent 包只依赖本包的 Tool / Registry 类型，不依赖领域子包。
package tools

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"sort"
	"sync"
)

// Tool 是 agent runtime 调度的工具单元。
//
//   - Name 全局唯一。
//   - Description 会传给模型，作为 tool_choice 的判断依据。
//   - Schema 是 JSON schema，直接透传给上游 tools 参数。
//   - Run 收到模型给出的原始 JSON 参数字节，返回工具执行结果的 JSON 字节。
//     结果不需要包在特定信封里，但推荐使用 {"ok":true,...} / {"ok":false,"error":"..."}
//     格式，以便模型理解成功/失败。
//   - Scope 用于按业务域筛选（例如 "life-trace"），避免所有入口共享全部 tool。
type Tool interface {
	Name() string
	Description() string
	Schema() map[string]any
	Scope() string
	Run(ctx context.Context, args json.RawMessage) (json.RawMessage, error)
}

// Registry 保存 Tool 名称到实例的映射。零值可用（不推荐，请用 NewRegistry）。
type Registry struct {
	mu    sync.RWMutex
	tools map[string]Tool
}

// NewRegistry 返回一个空的 Registry。
func NewRegistry() *Registry {
	return &Registry{tools: make(map[string]Tool)}
}

// Register 注册一个 Tool。名字冲突返回错误，调用方通常在 init() 里用
// MustRegister 直接 panic。
func (r *Registry) Register(t Tool) error {
	if t == nil {
		return errors.New("tools: register nil tool")
	}
	name := t.Name()
	if name == "" {
		return errors.New("tools: register tool with empty name")
	}
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.tools == nil {
		r.tools = make(map[string]Tool)
	}
	if _, exists := r.tools[name]; exists {
		return fmt.Errorf("tools: duplicate tool name %q", name)
	}
	r.tools[name] = t
	return nil
}

// MustRegister 是 Register 的 panic 版本，专供 init() 使用。
func (r *Registry) MustRegister(t Tool) {
	if err := r.Register(t); err != nil {
		panic(err)
	}
}

// Get 按名称查询一个 Tool；未注册返回 nil。
func (r *Registry) Get(name string) Tool {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.tools[name]
}

// Filter 按 scope 与 name 白名单返回符合条件的 Tool 列表。
//
//   - scope 为空时不按 scope 过滤。
//   - names 为空时返回该 scope 下全部 Tool。
//   - names 非空时只返回既在名单中、又存在于注册表中的 Tool。
//   - 结果按 Name 升序，方便测试与日志稳定。
func (r *Registry) Filter(scope string, names []string) []Tool {
	r.mu.RLock()
	defer r.mu.RUnlock()

	nameSet := make(map[string]struct{}, len(names))
	for _, n := range names {
		if n != "" {
			nameSet[n] = struct{}{}
		}
	}

	var out []Tool
	for _, t := range r.tools {
		if scope != "" && t.Scope() != scope {
			continue
		}
		if len(nameSet) > 0 {
			if _, ok := nameSet[t.Name()]; !ok {
				continue
			}
		}
		out = append(out, t)
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Name() < out[j].Name() })
	return out
}

// DefaultRegistry 是全局共享的 Registry 单例。领域子包应在 init() 里调用
// DefaultRegistry.MustRegister 完成注册。
var DefaultRegistry = NewRegistry()
