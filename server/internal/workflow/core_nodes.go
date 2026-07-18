package workflow

import (
	"context"
	"fmt"
	"strings"
)

type startExecutor struct{}

func (startExecutor) Type() NodeType { return NodeTypeStart }

func (startExecutor) Execute(_ context.Context, run RunContext, _ NodeExecution) (NodeResult, error) {
	return NodeResult{Output: run.Inputs}, nil
}

type endExecutor struct{}

func (endExecutor) Type() NodeType { return NodeTypeEnd }

func (endExecutor) Execute(_ context.Context, _ RunContext, execution NodeExecution) (NodeResult, error) {
	outputs, _ := execution.Input["outputs"].(map[string]any)
	outputTypes, _ := execution.Input["outputTypes"].(map[string]any)
	result := make(map[string]any, len(outputs))
	for name, value := range outputs {
		if value == nil && ValueType(stringFromValue(outputTypes[name])) == ValueTypeString {
			result[name] = ""
			continue
		}
		result[name] = value
	}
	return NodeResult{Output: result}, nil
}

type ContentSearchCapabilityAdapter struct{}

func (ContentSearchCapabilityAdapter) Execute(ctx context.Context, run RunContext, execution NodeExecution) (NodeResult, error) {
	if run.ContentSearcher == nil {
		return NodeResult{}, fmt.Errorf("内容搜索未配置")
	}
	result, err := run.ContentSearcher.Search(ctx, stringFromValue(execution.Input["query"]), stringFromValue(execution.Input["createdFrom"]), stringFromValue(execution.Input["createdTo"]))
	if err != nil {
		return NodeResult{}, err
	}
	return NodeResult{Output: map[string]any{"count": len(result.Items), "items": result.Items}}, nil
}

type ConditionExecutor struct{}

func (ConditionExecutor) Type() NodeType { return NodeTypeCondition }

func (ConditionExecutor) Execute(_ context.Context, _ RunContext, execution NodeExecution) (NodeResult, error) {
	matched, err := evaluateCondition(execution.Input["left"], stringFromValue(execution.Input["operator"]), execution.Input["right"])
	if err != nil {
		return NodeResult{}, err
	}
	return NodeResult{Output: map[string]any{"matched": matched}}, nil
}

type MergeExecutor struct{}

func (MergeExecutor) Type() NodeType { return NodeTypeMerge }

func (MergeExecutor) Execute(_ context.Context, run RunContext, execution NodeExecution) (NodeResult, error) {
	fieldsValue, ok := execution.Input["fields"].([]any)
	if !ok {
		return NodeResult{}, fmt.Errorf("合并节点 fields 必须为数组")
	}
	output := make(map[string]any, len(fieldsValue))
	for _, raw := range fieldsValue {
		fieldConfig, ok := raw.(map[string]any)
		if !ok {
			return NodeResult{}, fmt.Errorf("合并字段配置无效")
		}
		name := stringFromValue(fieldConfig["name"])
		if name == "" {
			return NodeResult{}, fmt.Errorf("合并字段名称不能为空")
		}
		output[name] = nil
		sources, _ := fieldConfig["sources"].([]any)
		for _, rawSource := range sources {
			source := stringFromValue(rawSource)
			value, err := ResolveTemplate(source, run.Outputs)
			if err == nil && value != nil {
				output[name] = value
				break
			}
		}
	}
	return NodeResult{Output: output}, nil
}

type VariableExecutor struct{}

func (VariableExecutor) Type() NodeType { return NodeTypeVariable }

func (VariableExecutor) Execute(_ context.Context, _ RunContext, execution NodeExecution) (NodeResult, error) {
	assignments, ok := execution.Input["assignments"].([]any)
	if !ok {
		return NodeResult{}, fmt.Errorf("变量节点 assignments 必须为数组")
	}
	output := make(map[string]any, len(assignments))
	for _, raw := range assignments {
		assignment, ok := raw.(map[string]any)
		if !ok {
			return NodeResult{}, fmt.Errorf("变量赋值配置无效")
		}
		name := stringFromValue(assignment["name"])
		if name == "" {
			return NodeResult{}, fmt.Errorf("变量名称不能为空")
		}
		output[name] = assignment["value"]
	}
	return NodeResult{Output: output}, nil
}

type SubworkflowExecutor struct{}

func (SubworkflowExecutor) Type() NodeType { return NodeTypeSubworkflow }

func (SubworkflowExecutor) Execute(ctx context.Context, run RunContext, execution NodeExecution) (NodeResult, error) {
	if run.SubworkflowRunner == nil {
		return NodeResult{}, fmt.Errorf("子工作流运行器未配置")
	}
	inputs, _ := execution.Input["inputs"].(map[string]any)
	output, err := run.SubworkflowRunner.Run(ctx, run.Actor, SubworkflowRequest{WorkflowID: stringFromValue(execution.Input["workflowId"]), VersionID: stringFromValue(execution.Input["versionId"]), Inputs: inputs})
	if err != nil {
		return NodeResult{}, err
	}
	return NodeResult{Output: output}, nil
}

type ToolNodeExecutor struct{ Registry *Registry }

func (ToolNodeExecutor) Type() NodeType { return NodeTypeTool }

func (executor ToolNodeExecutor) Execute(ctx context.Context, run RunContext, execution NodeExecution) (NodeResult, error) {
	capabilityID := stringFromValue(execution.Input["capabilityId"])
	_, capabilityExecutor, ok := executor.Registry.Capability(capabilityID)
	if !ok {
		return NodeResult{}, fmt.Errorf("工具能力 %s 未开放", capabilityID)
	}
	inputs, ok := execution.Input["inputs"].(map[string]any)
	if !ok {
		return NodeResult{}, fmt.Errorf("工具节点 inputs 必须为对象")
	}
	execution.CapabilityID = capabilityID
	execution.Input = inputs
	return capabilityExecutor.Execute(ctx, run, execution)
}

func evaluateCondition(left any, operator string, right any) (bool, error) {
	switch operator {
	case "equals":
		return fmt.Sprint(left) == fmt.Sprint(right), nil
	case "notEquals":
		return fmt.Sprint(left) != fmt.Sprint(right), nil
	case "contains":
		return strings.Contains(fmt.Sprint(left), fmt.Sprint(right)), nil
	case "isEmpty":
		return left == nil || strings.TrimSpace(fmt.Sprint(left)) == "", nil
	case "greaterThan":
		return numberFromValue(left) > numberFromValue(right), nil
	case "lessThan":
		return numberFromValue(left) < numberFromValue(right), nil
	default:
		return false, fmt.Errorf("不支持的条件操作符 %s", operator)
	}
}
