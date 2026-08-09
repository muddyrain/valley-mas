package clarification

import (
	"context"
	"encoding/json"
	"errors"
	"testing"
)

func TestNewRequestAppliesServerRoundLimits(t *testing.T) {
	tests := []struct {
		complexity Complexity
		want       int
	}{
		{ComplexitySimple, 1},
		{ComplexityNormal, 3},
		{ComplexityComplex, 5},
	}
	for _, test := range tests {
		request, err := NewRequest(Input{
			ID: "target-format", Question: "请选择目标格式", Reason: "转换工具需要目标格式",
			AnswerType: AnswerSingleSelect, Suggestions: []Suggestion{{Label: "PNG", Value: "png"}},
			AllowCustomAnswer: true, Blocking: true, Complexity: test.complexity, Round: 1,
		})
		if err != nil {
			t.Fatalf("complexity %q: %v", test.complexity, err)
		}
		if request.MaxRounds != test.want {
			t.Fatalf("complexity %q max rounds = %d, want %d", test.complexity, request.MaxRounds, test.want)
		}
	}
}

func TestResolveSkipAndDeclineRespectBlockingBoundary(t *testing.T) {
	blocking, err := NewRequest(Input{
		ID: "target-format", Question: "请选择目标格式", Reason: "转换工具需要目标格式",
		AnswerType: AnswerText, Blocking: true, Complexity: ComplexitySimple, Round: 1,
	})
	if err != nil {
		t.Fatal(err)
	}
	nonBlocking, err := NewRequest(Input{
		ID: "image-quality", Question: "需要什么清晰度？", Reason: "未填写时使用默认清晰度",
		AnswerType: AnswerText, Blocking: false, Complexity: ComplexitySimple, Round: 1,
	})
	if err != nil {
		t.Fatal(err)
	}

	for _, decision := range []Decision{DecisionSkip, DecisionDecline} {
		resolution, err := Resolve(blocking, decision, "")
		if err != nil {
			t.Fatalf("blocking %q: %v", decision, err)
		}
		if resolution.CanContinue {
			t.Fatalf("blocking %q must stop execution", decision)
		}

		resolution, err = Resolve(nonBlocking, decision, "")
		if err != nil {
			t.Fatalf("non-blocking %q: %v", decision, err)
		}
		if !resolution.CanContinue || !resolution.UsedDefault {
			t.Fatalf("non-blocking %q should use a safe default: %#v", decision, resolution)
		}
	}
}

func TestNewRequestRejectsAnotherQuestionPastTheLimit(t *testing.T) {
	_, err := NewRequest(Input{
		ID: "too-many", Question: "继续追问", Reason: "测试上限", AnswerType: AnswerText,
		Blocking: true, Complexity: ComplexityNormal, Round: 4,
	})
	if err == nil {
		t.Fatal("expected the server to reject a clarification beyond the round limit")
	}
}

func TestAskToolReturnsARequiredRequestWithServerControlledRound(t *testing.T) {
	tool := NewAskTool()
	ctx := WithRound(context.Background(), 2)
	_, err := tool.Run(ctx, json.RawMessage(`{
		"question":"请选择目标格式",
		"reason":"转换前需要目标格式",
		"answerType":"single_select",
		"suggestions":[{"label":"PNG","value":"png"}],
		"allowCustomAnswer":true,
		"blocking":true,
		"complexity":"normal"
	}`))
	if err == nil {
		t.Fatal("expected clarification tool to pause execution")
	}
	var required *RequiredError
	if !errors.As(err, &required) {
		t.Fatalf("error = %T %v, want RequiredError", err, err)
	}
	if required.Request.Round != 2 || required.Request.MaxRounds != 3 {
		t.Fatalf("request round = %d/%d, want 2/3", required.Request.Round, required.Request.MaxRounds)
	}
	if required.Request.ID == "" || required.Request.Question != "请选择目标格式" {
		t.Fatalf("unexpected request = %#v", required.Request)
	}
}
