package handler

import (
	"strings"
	"testing"
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
