package handler

import (
	"strings"
	"testing"
)

func TestBuildAIAppReplyClarificationConvertsInvitedFollowUp(t *testing.T) {
	reply := `周末出去玩是个好主意。

为了给你更有针对性的建议，能告诉我一些细节吗？比如：
- 你所在的城市或想去的地区是哪里？
- 偏好户外徒步、城市探索，还是放松休闲？`
	request, ok := buildAIAppReplyClarification(101, reply, 1)
	if !ok {
		t.Fatal("expected invited follow-up to become a clarification")
	}
	if request.Question != "能告诉我一些细节吗？" {
		t.Fatalf("question = %q", request.Question)
	}
	if request.AnswerType != "text" || !request.AllowCustomAnswer || request.Blocking {
		t.Fatalf("request = %#v", request)
	}
	if request.Round != 1 || request.MaxRounds != 3 {
		t.Fatalf("rounds = %d/%d", request.Round, request.MaxRounds)
	}
}

func TestBuildAIAppReplyClarificationConvertsTrailingPreferenceQuestion(t *testing.T) {
	reply := "我可以先给你三个方向。\n\n您比较倾向**发音**还是**常用句子**？或者您现在在哪个城市？"
	request, ok := buildAIAppReplyClarification(102, reply, 2)
	if !ok || request.Question != "您比较倾向发音还是常用句子？" {
		t.Fatalf("request = %#v ok=%v", request, ok)
	}
	if request.AnswerType != "single_select" || len(request.Suggestions) != 2 {
		t.Fatalf("suggestions = %#v answerType=%q", request.Suggestions, request.AnswerType)
	}
	if request.Suggestions[0].Value != "发音" || request.Suggestions[1].Value != "常用句子" {
		t.Fatalf("suggestions = %#v", request.Suggestions)
	}
}

func TestBuildAIAppReplyClarificationConvertsMarkdownSelectionList(t *testing.T) {
	reply := `请选择您想去的目的地：

- 杭州
- 苏州
- 南京

（请回复您的选择，我会在您选定后再提供旅行方案。）`
	request, ok := buildAIAppReplyClarification(107, reply, 1)
	if !ok {
		t.Fatal("expected a markdown selection list to become a clarification")
	}
	if request.Question != "请选择您想去的目的地：" {
		t.Fatalf("question = %q", request.Question)
	}
	if request.AnswerType != "single_select" || len(request.Suggestions) != 3 {
		t.Fatalf("suggestions = %#v answerType=%q", request.Suggestions, request.AnswerType)
	}
	for index, expected := range []string{"杭州", "苏州", "南京"} {
		if request.Suggestions[index].Label != expected || request.Suggestions[index].Value != expected {
			t.Fatalf("suggestion %d = %#v", index, request.Suggestions[index])
		}
	}
}

func TestBuildAIAppReplyClarificationConvertsQuestionWithFollowingOptions(t *testing.T) {
	reply := `你更想去哪个城市？

- 杭州
- 苏州
- 南京`
	request, ok := buildAIAppReplyClarification(108, reply, 1)
	if !ok {
		t.Fatal("expected the invited question to become a clarification")
	}
	if request.Question != "你更想去哪个城市？" {
		t.Fatalf("question = %q", request.Question)
	}
	if request.AnswerType != "single_select" || len(request.Suggestions) != 3 {
		t.Fatalf("suggestions = %#v answerType=%q", request.Suggestions, request.AnswerType)
	}
	for index, expected := range []string{"杭州", "苏州", "南京"} {
		if request.Suggestions[index].Value != expected {
			t.Fatalf("suggestion %d = %#v", index, request.Suggestions[index])
		}
	}
}

func TestBuildAIAppReplyClarificationKeepsGeneratedPlansAsChoices(t *testing.T) {
	reply := `我为南京周末整理了三个方案：

1. **古都文化线**：中山陵、明孝陵和南京博物院，适合喜欢历史的人。
2. **城市漫游线**：老门东、明城墙和秦淮河，节奏轻松。
3. **自然放松线**：紫金山、玄武湖和汤山，适合户外休闲。

请告诉我您更倾向于哪个方案，或者需要我进一步细化某个方案的行程细节？`
	request, ok := buildAIAppReplyClarification(109, reply, 1)
	if !ok {
		t.Fatal("expected generated plans to become a clarification")
	}
	if request.AnswerType != "single_select" || len(request.Suggestions) != 3 {
		t.Fatalf("suggestions = %#v answerType=%q", request.Suggestions, request.AnswerType)
	}
	for index, expected := range []struct {
		label       string
		description string
	}{
		{label: "古都文化线", description: "中山陵、明孝陵和南京博物院，适合喜欢历史的人。"},
		{label: "城市漫游线", description: "老门东、明城墙和秦淮河，节奏轻松。"},
		{label: "自然放松线", description: "紫金山、玄武湖和汤山，适合户外休闲。"},
	} {
		if request.Suggestions[index].Label != expected.label || request.Suggestions[index].Value != expected.label || request.Suggestions[index].Description != expected.description {
			t.Fatalf("suggestion %d = %#v", index, request.Suggestions[index])
		}
	}
}

func TestBuildAIAppReplyClarificationConvertsNumberedQuestionsAfterExplicitNeed(t *testing.T) {
	reply := `你好！为了给你制定合适的计划，我需要先了解两点：
1. **你目前的英语基础大概是什么水平？**
   - 比如：几乎零基础 / 能简单对话 / 可以阅读但口语弱
2. **你练习英语的主要目标是什么？**`
	request, ok := buildAIAppReplyClarification(105, reply, 1)
	if !ok {
		t.Fatal("expected explicit information request to become a clarification")
	}
	if request.Question != "你目前的英语基础大概是什么水平？" {
		t.Fatalf("question = %q", request.Question)
	}
}

func TestBuildAIAppReplyClarificationConvertsQuestionsAfterAskLeadIn(t *testing.T) {
	reply := `先问两个关键问题：
1. **你目前的英语基础大概是什么水平？**
2. **你练英语的主要目标是什么？**`
	request, ok := buildAIAppReplyClarification(106, reply, 3)
	if !ok || request.Question != "你目前的英语基础大概是什么水平？" {
		t.Fatalf("request = %#v ok=%v", request, ok)
	}
}

func TestBuildAIAppReplyClarificationLimitNoticeStopsFurtherCards(t *testing.T) {
	reply := "先问一个关键问题：\n你每天能投入多少时间？"
	notice, ok := buildAIAppReplyClarificationLimitNotice(reply, 4)
	if !ok {
		t.Fatal("expected a limit notice after the normal clarification limit")
	}
	for _, expected := range []string{"3 轮上限", "你每天能投入多少时间？", "新消息"} {
		if !strings.Contains(notice, expected) {
			t.Fatalf("notice missing %q: %s", expected, notice)
		}
	}
	if _, ok := buildAIAppReplyClarificationLimitNotice(reply, 3); ok {
		t.Fatal("round 3 should still allow a clarification card")
	}
}

func TestBuildAIAppReplyClarificationKeepsSelfContainedAnswer(t *testing.T) {
	for _, reply := range []string{
		"可以从城市公园、短途徒步和本地展览三个方向选择。",
		"为什么建议先看天气？因为这会直接影响户外路线。",
		"这里是你要求的十个采访问题：\n- 你为什么开始创作？\n- 你最重视什么？",
		"请选择一个方向：\n这里先补充一段说明。\n- 杭州\n- 苏州",
	} {
		if request, ok := buildAIAppReplyClarification(103, reply, 1); ok {
			t.Fatalf("unexpected clarification for %q: %#v", reply, request)
		}
	}
}

func TestBuildAIAppReplyClarificationStopsAtRoundLimit(t *testing.T) {
	if request, ok := buildAIAppReplyClarification(104, "你更倾向哪种方式？", 4); ok {
		t.Fatalf("unexpected request beyond normal round limit: %#v", request)
	}
}
