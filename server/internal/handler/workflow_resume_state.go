package handler

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"

	"valley-server/internal/config"
	"valley-server/internal/workflow"
)

// workflowRunResumeState is encrypted before persistence. It contains the
// original inputs and full intermediate outputs required to avoid replaying
// successful nodes after a failure; public run records continue to expose only
// safe previews.
type workflowRunResumeState struct {
	Inputs    map[string]any                `json:"inputs"`
	Outputs   map[string]map[string]any     `json:"outputs"`
	Completed map[string]workflowResumeNode `json:"completed"`
}

type workflowResumeNode struct {
	ActivateOutgoing bool `json:"activateOutgoing"`
}

func encryptWorkflowRunResumeState(state workflowRunResumeState) (string, error) {
	payload, err := json.Marshal(state)
	if err != nil {
		return "", err
	}
	block, err := aes.NewCipher(workflowRunStateKey())
	if err != nil {
		return "", err
	}
	aead, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}
	nonce := make([]byte, aead.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(aead.Seal(nonce, nonce, payload, nil)), nil
}

func decryptWorkflowRunResumeState(ciphertext string) (workflowRunResumeState, error) {
	if ciphertext == "" {
		return workflowRunResumeState{}, fmt.Errorf("该运行没有可恢复的检查点")
	}
	raw, err := base64.RawURLEncoding.DecodeString(ciphertext)
	if err != nil {
		return workflowRunResumeState{}, fmt.Errorf("运行检查点无效")
	}
	block, err := aes.NewCipher(workflowRunStateKey())
	if err != nil {
		return workflowRunResumeState{}, err
	}
	aead, err := cipher.NewGCM(block)
	if err != nil {
		return workflowRunResumeState{}, err
	}
	if len(raw) < aead.NonceSize() {
		return workflowRunResumeState{}, fmt.Errorf("运行检查点无效")
	}
	payload, err := aead.Open(nil, raw[:aead.NonceSize()], raw[aead.NonceSize():], nil)
	if err != nil {
		return workflowRunResumeState{}, fmt.Errorf("运行检查点无法解密")
	}
	var state workflowRunResumeState
	if err := json.Unmarshal(payload, &state); err != nil {
		return workflowRunResumeState{}, fmt.Errorf("运行检查点格式错误")
	}
	if state.Inputs == nil {
		state.Inputs = map[string]any{}
	}
	if state.Outputs == nil {
		state.Outputs = map[string]map[string]any{}
	}
	if state.Completed == nil {
		state.Completed = map[string]workflowResumeNode{}
	}
	return state, nil
}

func workflowRunStateKey() []byte {
	key := sha256.Sum256([]byte("valley-workflow-run-state:" + config.Load().JWT.Secret))
	return key[:]
}

func workflowCompletedNodes(state workflowRunResumeState) map[string]workflow.CompletedNode {
	completed := make(map[string]workflow.CompletedNode, len(state.Completed))
	for nodeID, node := range state.Completed {
		completed[nodeID] = workflow.CompletedNode{ActivateOutgoing: node.ActivateOutgoing}
	}
	return completed
}

func restoreWorkflowFileInputs(graph workflow.Graph, inputs map[string]any) error {
	for _, node := range graph.Nodes {
		if node.Type != workflow.NodeTypeStart {
			continue
		}
		var config struct {
			Inputs map[string]workflow.InputDefinition `json:"inputs"`
		}
		if err := json.Unmarshal(node.Config, &config); err != nil {
			return err
		}
		for name, definition := range config.Inputs {
			if definition.Type != workflow.ValueTypeFile || inputs[name] == nil {
				continue
			}
			encoded, err := json.Marshal(inputs[name])
			if err != nil {
				return err
			}
			var file workflow.FileInput
			if err := json.Unmarshal(encoded, &file); err != nil {
				return err
			}
			inputs[name] = file
		}
		return nil
	}
	return nil
}
