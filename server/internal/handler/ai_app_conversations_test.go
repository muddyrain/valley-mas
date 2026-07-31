package handler

import (
	"encoding/json"
	"strings"
	"testing"

	imagetool "valley-server/internal/ai/tools/image"
	"valley-server/internal/aiapp"
)

func TestBuildAIAppConversationSystemPromptSeparatesRuntimeIntentFromAgentInstructions(t *testing.T) {
	system := buildAIAppConversationSystemPrompt(
		"一个可爱的二次元少女，站在樱花树下。",
		"资料标题：春日壁纸规范",
	)

	runtimeIndex := strings.Index(system, aiAppConversationRuntimePrompt)
	customIndex := strings.Index(system, "智能体自定义指令：")
	knowledgeIndex := strings.Index(system, "以下是与当前问题相关的私有参考资料。")
	if customIndex != 0 || knowledgeIndex <= customIndex || runtimeIndex <= knowledgeIndex {
		t.Fatalf("unexpected conversation prompt sections: %q", system)
	}
	if !strings.Contains(system, "除非用户明确提出") {
		t.Fatalf("runtime prompt must guard against treating instructions as the latest user task: %q", system)
	}
}

func TestBuildAIAppConversationSystemPromptAlwaysIncludesRuntimeGuidance(t *testing.T) {
	system := buildAIAppConversationSystemPrompt("", "")
	if system != aiAppConversationRuntimePrompt {
		t.Fatalf("expected runtime guidance only, got %q", system)
	}
}

func TestSelectedAIAppImageStyleRequiresBoundSkill(t *testing.T) {
	config := aiapp.Config{SkillIDs: []string{"11"}}
	styleID, err := selectedAIAppImageStyle(config, []string{"11"})
	if err != nil || styleID != "skill:11" {
		t.Fatalf("selectedAIAppImageStyle() = %q, %v", styleID, err)
	}
	if _, err := selectedAIAppImageStyle(config, []string{"12"}); err == nil {
		t.Fatal("selectedAIAppImageStyle() accepted an unbound skill")
	}
}

func TestImageGenerationIDsFromToolResult(t *testing.T) {
	payload, _ := json.Marshal(map[string]any{"ok": true, "generationId": "42"})
	ids := imageGenerationIDsFromToolResult(imagetool.ToolName, payload)
	if len(ids) != 1 || ids[0] != "42" {
		t.Fatalf("imageGenerationIDsFromToolResult() = %#v", ids)
	}
	if got := imageGenerationIDsFromToolResult("content.search", payload); len(got) != 0 {
		t.Fatalf("unexpected IDs from another tool: %#v", got)
	}
}
