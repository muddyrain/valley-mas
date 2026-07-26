package workflow

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"
)

const (
	maxNodeRetryCount   = 3
	maxNodeRetryDelayMS = 5000
)

type nodeExecutionPolicy struct {
	RetryCount  int
	RetryDelay  time.Duration
	ErrorAction string
	Configured  bool
}

func executionPolicyFromConfig(node Node, config map[string]any, registry *Registry) (nodeExecutionPolicy, error) {
	raw, exists := config["errorHandling"]
	if !exists || raw == nil {
		return nodeExecutionPolicy{ErrorAction: "fail"}, nil
	}
	values, ok := raw.(map[string]any)
	if !ok {
		return nodeExecutionPolicy{}, errors.New("errorHandling 必须为对象")
	}
	policy := nodeExecutionPolicy{
		RetryCount:  int(numberFromValue(values["retryCount"])),
		RetryDelay:  time.Duration(numberFromValue(values["retryDelayMs"])) * time.Millisecond,
		ErrorAction: strings.TrimSpace(stringFromValue(values["strategy"])),
		Configured:  true,
	}
	if policy.ErrorAction == "" {
		policy.ErrorAction = "fail"
	}
	if policy.RetryCount < 0 || policy.RetryCount > maxNodeRetryCount {
		return nodeExecutionPolicy{}, fmt.Errorf("重试次数必须为 0 到 %d", maxNodeRetryCount)
	}
	delayMS := policy.RetryDelay.Milliseconds()
	if delayMS < 0 || delayMS > maxNodeRetryDelayMS {
		return nodeExecutionPolicy{}, fmt.Errorf("重试间隔必须为 0 到 %d 毫秒", maxNodeRetryDelayMS)
	}
	if policy.ErrorAction != "fail" && policy.ErrorAction != "continue" {
		return nodeExecutionPolicy{}, errors.New("错误策略必须为 fail 或 continue")
	}
	if policy.RetryCount > 0 && !nodeAllowsAutomaticRetry(node, config, registry) {
		return nodeExecutionPolicy{}, errors.New("该节点可能产生不可安全重放的副作用，不支持自动重试")
	}
	if policy.ErrorAction == "continue" && !nodeAllowsErrorContinue(node.Type) {
		return nodeExecutionPolicy{}, errors.New("该节点参与流程路由或边界控制，不支持失败后继续")
	}
	return policy, nil
}

func nodeAllowsAutomaticRetry(node Node, config map[string]any, registry *Registry) bool {
	switch node.Type {
	case NodeTypeLLM, NodeTypeIntent, NodeTypeTemplate, NodeTypeVariable:
		return true
	case NodeTypeHTTP:
		method := strings.ToUpper(stringFromValue(config["method"]))
		return (method == "GET" || method == "HEAD") && int(numberFromValue(config["retryCount"])) == 0
	case NodeTypeTool:
		capability, _, found := registry.Capability(stringFromValue(config["capabilityId"]))
		return found && (capability.SideEffect == "none" || capability.SideEffect == "read" || capability.SideEffect == "model")
	default:
		return false
	}
}

func nodeAllowsErrorContinue(nodeType NodeType) bool {
	switch nodeType {
	case NodeTypeLLM, NodeTypeTemplate, NodeTypeHTTP, NodeTypeTool, NodeTypeVariable, NodeTypeSubworkflow:
		return true
	default:
		return false
	}
}

func executeNodeWithPolicy(
	ctx context.Context,
	executor NodeExecutor,
	run RunContext,
	execution NodeExecution,
	policy nodeExecutionPolicy,
) (NodeResult, int, error) {
	attempts := 0
	for {
		attempts++
		result, err := executor.Execute(ctx, run, execution)
		if err == nil {
			return result, attempts, nil
		}
		if attempts > policy.RetryCount || errors.Is(err, context.Canceled) || errors.Is(err, context.DeadlineExceeded) {
			return NodeResult{}, attempts, err
		}
		delay := policy.RetryDelay
		if delay <= 0 {
			continue
		}
		timer := time.NewTimer(delay)
		select {
		case <-ctx.Done():
			if !timer.Stop() {
				<-timer.C
			}
			return NodeResult{}, attempts, ctx.Err()
		case <-timer.C:
		}
	}
}

func addExecutionPolicyOutput(output map[string]any, policy nodeExecutionPolicy, attempts int, failed bool, message, code string) {
	if !policy.Configured {
		return
	}
	output["_failed"] = failed
	output["_error"] = message
	output["_errorCode"] = code
	output["_attempts"] = attempts
}

func addExecutionPolicyOutputFields(output map[string]ValueType, policy nodeExecutionPolicy) map[string]ValueType {
	if !policy.Configured {
		return output
	}
	if output == nil {
		output = map[string]ValueType{}
	}
	output["_failed"] = ValueTypeBoolean
	output["_error"] = ValueTypeString
	output["_errorCode"] = ValueTypeString
	output["_attempts"] = ValueTypeNumber
	return output
}
