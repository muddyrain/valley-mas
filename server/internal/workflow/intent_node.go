package workflow

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"regexp"
	"strings"
)

const otherIntentID = "other"

var (
	ErrIntentClassificationInvalid = errors.New("INTENT_CLASSIFICATION_INVALID")
	intentIDPattern                = regexp.MustCompile(`^[a-z][a-z0-9_-]{0,39}$`)
)

type intentDefinition struct {
	ID          string   `json:"id"`
	Name        string   `json:"name"`
	Description string   `json:"description"`
	Examples    []string `json:"examples"`
}

type intentNodeConfig struct {
	Query   string             `json:"query"`
	Intents []intentDefinition `json:"intents"`
}

// IntentClassifierExecutor is a deliberately narrow model node: graph authors
// define the allowable intents, but cannot select a model, endpoint, or tool.
type IntentClassifierExecutor struct {
	Generator TextGenerator
}

func (IntentClassifierExecutor) Type() NodeType { return NodeTypeIntent }

func (executor IntentClassifierExecutor) Execute(
	ctx context.Context,
	_ RunContext,
	execution NodeExecution,
) (NodeResult, error) {
	config, err := intentConfigFromMap(execution.Input)
	if err != nil {
		return NodeResult{}, err
	}
	query := truncateIntentText(config.Query, 4000)
	if query == "" {
		return NodeResult{}, fmt.Errorf("意图识别节点 query 不能为空")
	}
	definitions, _ := json.Marshal(config.Intents)
	generator := executor.Generator
	if generator == nil {
		generator = ARKTextGenerator{}
	}
	result, err := generator.Generate(ctx, TextGenerationRequest{
		SystemPrompt: "你是一个严格的意图分类器。只能从给定 intentId 或 other 中选择，不能解释。",
		Prompt: fmt.Sprintf(
			"用户输入：%s\n\n可选意图：%s\n\n只返回一个 JSON 对象，不要使用 Markdown：{\"intentId\":\"已配置的 intentId 或 other\",\"confidence\":0 到 1 的数字}。输入无法明确匹配时必须返回 other。",
			query,
			string(definitions),
		),
		Temperature:     0,
		MaxOutputTokens: 120,
	})
	if err != nil {
		return NodeResult{}, err
	}
	parsed, err := parseStructuredLLMOutput(result.Text, fields(
		field("intentId", ValueTypeString),
		field("confidence", ValueTypeNumber),
	))
	if err != nil {
		return NodeResult{}, fmt.Errorf("%w: %v", ErrIntentClassificationInvalid, err)
	}
	intentID := strings.TrimSpace(stringFromValue(parsed["intentId"]))
	confidence := numberFromValue(parsed["confidence"])
	if confidence < 0 || confidence > 1 {
		return NodeResult{}, fmt.Errorf("%w: confidence 必须介于 0 和 1", ErrIntentClassificationInvalid)
	}
	intentName := "其他"
	matched := false
	for _, intent := range config.Intents {
		if intent.ID == intentID {
			intentName = intent.Name
			matched = true
			break
		}
	}
	if !matched {
		intentID = otherIntentID
		confidence = 0
	}
	return NodeResult{Output: map[string]any{
		"intentId":   intentID,
		"intentName": intentName,
		"confidence": confidence,
	}}, nil
}

func validateIntentConfig(nodeID string, config map[string]any) []string {
	_, err := intentConfigFromMap(config)
	if err == nil {
		return nil
	}
	return []string{fmt.Sprintf("意图识别节点 %s 配置无效：%v", nodeID, err)}
}

func intentBranchHandles(config map[string]any) []string {
	parsed, err := intentConfigFromMap(config)
	if err != nil {
		return nil
	}
	handles := make([]string, 0, len(parsed.Intents)+1)
	for _, intent := range parsed.Intents {
		handles = append(handles, "intent:"+intent.ID)
	}
	return append(handles, "intent:"+otherIntentID)
}

func intentConfigFromMap(config map[string]any) (intentNodeConfig, error) {
	encoded, err := json.Marshal(config)
	if err != nil {
		return intentNodeConfig{}, err
	}
	var parsed intentNodeConfig
	if err := json.Unmarshal(encoded, &parsed); err != nil {
		return intentNodeConfig{}, err
	}
	parsed.Query = strings.TrimSpace(parsed.Query)
	if parsed.Query == "" {
		return intentNodeConfig{}, errors.New("query 不能为空")
	}
	if len(parsed.Intents) == 0 || len(parsed.Intents) > 10 {
		return intentNodeConfig{}, errors.New("意图数量必须为 1 到 10 个")
	}
	seen := make(map[string]bool, len(parsed.Intents))
	for index := range parsed.Intents {
		intent := &parsed.Intents[index]
		intent.ID = strings.TrimSpace(intent.ID)
		intent.Name = strings.TrimSpace(intent.Name)
		intent.Description = strings.TrimSpace(intent.Description)
		if !intentIDPattern.MatchString(intent.ID) || intent.ID == otherIntentID || seen[intent.ID] {
			return intentNodeConfig{}, fmt.Errorf("第 %d 个意图 ID 无效或重复", index+1)
		}
		if intent.Name == "" || len([]rune(intent.Name)) > 80 {
			return intentNodeConfig{}, fmt.Errorf("第 %d 个意图名称无效", index+1)
		}
		if len([]rune(intent.Description)) > 500 {
			return intentNodeConfig{}, fmt.Errorf("第 %d 个意图说明无效", index+1)
		}
		if len(intent.Examples) > 5 {
			return intentNodeConfig{}, fmt.Errorf("第 %d 个意图示例不能超过 5 条", index+1)
		}
		for exampleIndex, example := range intent.Examples {
			intent.Examples[exampleIndex] = strings.TrimSpace(example)
			if intent.Examples[exampleIndex] == "" || len([]rune(intent.Examples[exampleIndex])) > 200 {
				return intentNodeConfig{}, fmt.Errorf("第 %d 个意图示例无效", index+1)
			}
		}
		seen[intent.ID] = true
	}
	return parsed, nil
}

func truncateIntentText(value string, maxRunes int) string {
	value = strings.TrimSpace(value)
	runes := []rune(value)
	if len(runes) <= maxRunes {
		return value
	}
	return string(runes[:maxRunes])
}
