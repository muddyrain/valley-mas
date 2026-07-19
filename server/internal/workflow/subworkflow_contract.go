package workflow

import (
	"encoding/json"
	"fmt"
	"strings"
)

// SubworkflowContract is the public boundary of one immutable workflow version.
// Parent graphs persist this snapshot so their variable picker and validator use
// the same fields as the invoked version.
type SubworkflowContract struct {
	Inputs  map[string]InputDefinition
	Outputs map[string]ValueType
}

func SubworkflowContractFromGraph(graph Graph) (SubworkflowContract, error) {
	contract := SubworkflowContract{Inputs: map[string]InputDefinition{}, Outputs: map[string]ValueType{}}
	for _, node := range graph.Nodes {
		switch node.Type {
		case NodeTypeStart:
			config, err := decodeConfig(node.Config)
			if err != nil {
				return SubworkflowContract{}, fmt.Errorf("开始节点配置无效")
			}
			encoded, _ := json.Marshal(config["inputs"])
			if err := json.Unmarshal(encoded, &contract.Inputs); err != nil {
				return SubworkflowContract{}, fmt.Errorf("开始节点输入配置无效")
			}
			for name, definition := range contract.Inputs {
				if strings.TrimSpace(name) == "" || !validValueType(definition.Type) {
					return SubworkflowContract{}, fmt.Errorf("开始节点输入契约无效")
				}
			}
		case NodeTypeEnd:
			config, err := decodeConfig(node.Config)
			if err != nil {
				return SubworkflowContract{}, fmt.Errorf("结束节点配置无效")
			}
			outputs, _ := config["outputs"].(map[string]any)
			outputTypes, _ := config["outputTypes"].(map[string]any)
			for name := range outputs {
				valueType := ValueType(stringFromValue(outputTypes[name]))
				if strings.TrimSpace(name) != "" && validValueType(valueType) {
					contract.Outputs[name] = valueType
				}
			}
		}
	}
	return contract, nil
}

func subworkflowDeclaredSchemas(config map[string]any) (map[string]ValueType, map[string]ValueType, bool, error) {
	inputs, inputsDeclared, err := declaredValueTypeSchema(config["inputSchema"], "inputSchema")
	if err != nil {
		return nil, nil, false, err
	}
	outputs, outputsDeclared, err := declaredValueTypeSchema(config["outputSchema"], "outputSchema")
	if err != nil {
		return nil, nil, false, err
	}
	if inputsDeclared != outputsDeclared {
		return nil, nil, false, fmt.Errorf("子工作流节点必须同时声明输入和输出契约")
	}
	return inputs, outputs, inputsDeclared, nil
}

func declaredValueTypeSchema(raw any, name string) (map[string]ValueType, bool, error) {
	if raw == nil {
		return nil, false, nil
	}
	fields, ok := raw.(map[string]any)
	if !ok {
		return nil, false, fmt.Errorf("子工作流节点 %s 必须为对象", name)
	}
	schema := make(map[string]ValueType, len(fields))
	for field, rawType := range fields {
		valueType := ValueType(stringFromValue(rawType))
		if strings.TrimSpace(field) == "" || !validValueType(valueType) {
			return nil, false, fmt.Errorf("子工作流节点 %s 包含无效字段", name)
		}
		schema[field] = valueType
	}
	return schema, true, nil
}
