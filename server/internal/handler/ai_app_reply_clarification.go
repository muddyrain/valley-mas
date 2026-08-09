package handler

import (
	"fmt"
	"strings"

	clarificationprotocol "valley-server/internal/ai/clarification"
	"valley-server/internal/model"
)

const aiAppReplyClarificationMaxRounds = 3

var aiAppReplyClarificationInvitations = []string{
	"请告诉我",
	"能告诉我",
	"可以告诉我",
	"方便告诉我",
	"方便说",
	"你更",
	"您更",
	"你比较",
	"您比较",
	"你倾向",
	"您倾向",
	"你希望",
	"您希望",
	"你想先",
	"您想先",
}

var aiAppReplyClarificationLeadIns = []string{
	"需要先了解",
	"需要了解",
	"还需要了解",
	"想先了解",
	"需要先确认",
	"需要确认",
	"需要你补充",
	"需要您补充",
	"先问",
}

func buildAIAppReplyClarification(
	taskID model.Int64String,
	reply string,
	round int,
) (clarificationprotocol.Request, bool) {
	question := extractAIAppInvitedFollowUpQuestion(reply)
	suggestions := []clarificationprotocol.Suggestion(nil)
	if question == "" {
		question, suggestions = extractAIAppReplySelectionList(reply)
	}
	if question == "" {
		return clarificationprotocol.Request{}, false
	}
	if suggestions == nil {
		suggestions = extractAIAppReplyClarificationSuggestions(reply, question)
	}
	answerType := clarificationprotocol.AnswerText
	if len(suggestions) >= 2 {
		answerType = clarificationprotocol.AnswerSingleSelect
	}
	request, err := clarificationprotocol.NewRequest(clarificationprotocol.Input{
		ID:                fmt.Sprintf("reply-%s-%d", taskID, round),
		Question:          question,
		Reason:            "补充这项信息后，我可以继续给出更贴合你需求的结果。",
		AnswerType:        answerType,
		Suggestions:       suggestions,
		AllowCustomAnswer: true,
		Blocking:          false,
		Complexity:        clarificationprotocol.ComplexityNormal,
		Round:             round,
	})
	if err != nil {
		return clarificationprotocol.Request{}, false
	}
	return request, true
}

// extractAIAppReplySelectionList recognizes explicit model invitations followed
// immediately by a short Markdown option list. Keeping the list adjacent avoids
// turning ordinary answer bullets into a blocking conversation step.
func extractAIAppReplySelectionList(reply string) (string, []clarificationprotocol.Suggestion) {
	lines := strings.Split(strings.ReplaceAll(reply, "\r\n", "\n"), "\n")
	for index, rawLine := range lines {
		question := cleanAIAppClarificationLine(rawLine)
		if !isAIAppReplySelectionInvitation(question) {
			continue
		}

		options := extractAIAppReplyListOptions(lines[index+1:])
		if len(options) < 2 {
			continue
		}

		suggestions := make([]clarificationprotocol.Suggestion, 0, len(options))
		for _, option := range options {
			suggestions = append(suggestions, clarificationprotocol.Suggestion{Label: option, Value: option})
		}
		return question, suggestions
	}
	return "", nil
}

func extractAIAppReplyListOptions(lines []string) []string {
	options := make([]string, 0, 4)
	for _, candidate := range lines {
		if strings.TrimSpace(candidate) == "" {
			continue
		}
		option, ok := extractAIAppReplyListOption(candidate)
		if !ok {
			break
		}
		if !containsString(options, option) {
			options = append(options, option)
		}
		if len(options) == 6 {
			break
		}
	}
	return options
}

func isAIAppReplySelectionInvitation(line string) bool {
	line = strings.TrimSpace(line)
	if strings.HasPrefix(line, "请选择") {
		return true
	}
	for _, prefix := range []string{"请从", "请在", "从以下", "在以下"} {
		if strings.HasPrefix(line, prefix) && strings.Contains(line, "选择") {
			return true
		}
	}
	return false
}

func extractAIAppReplyListOption(line string) (string, bool) {
	value := strings.TrimSpace(line)
	for _, prefix := range []string{"- ", "* ", "+ ", "• "} {
		if strings.HasPrefix(value, prefix) {
			return normalizeAIAppReplyListOption(strings.TrimSpace(strings.TrimPrefix(value, prefix)))
		}
	}

	runes := []rune(value)
	digitEnd := 0
	for digitEnd < len(runes) && runes[digitEnd] >= '0' && runes[digitEnd] <= '9' {
		digitEnd++
	}
	if digitEnd > 0 && digitEnd < len(runes) && strings.ContainsRune(".、)）", runes[digitEnd]) {
		return normalizeAIAppReplyListOption(strings.TrimSpace(string(runes[digitEnd+1:])))
	}
	return "", false
}

func normalizeAIAppReplyListOption(value string) (string, bool) {
	value = strings.NewReplacer("**", "", "__", "", "`", "").Replace(value)
	value = strings.TrimSpace(value)
	if value == "" || len([]rune(value)) > 64 || strings.ContainsAny(value, "？?") {
		return "", false
	}
	return value, true
}

func buildAIAppReplyClarificationLimitNotice(reply string, round int) (string, bool) {
	if round <= aiAppReplyClarificationMaxRounds {
		return "", false
	}
	question := extractAIAppInvitedFollowUpQuestion(reply)
	if question == "" {
		return "", false
	}
	return fmt.Sprintf(
		"本轮澄清已达到 %d 轮上限，仍缺少“%s”。请直接在新消息中补充这项信息，我会继续处理。",
		aiAppReplyClarificationMaxRounds,
		question,
	), true
}

func extractAIAppInvitedFollowUpQuestion(reply string) string {
	normalized := strings.ReplaceAll(reply, "\r\n", "\n")
	waitingForQuestion := false
	for _, line := range strings.Split(normalized, "\n") {
		line = cleanAIAppClarificationLine(line)
		for _, invitation := range aiAppReplyClarificationInvitations {
			start := strings.Index(line, invitation)
			if start < 0 {
				continue
			}
			tail := line[start:]
			end := strings.IndexAny(tail, "？?")
			if end < 0 {
				continue
			}
			question := sanitizeAIAppClarificationQuestion(tail[:end+len(string([]rune(tail[end:])[0]))])
			if question != "" {
				return question
			}
		}
		if waitingForQuestion {
			if question := extractAIAppDirectQuestion(line); question != "" {
				return question
			}
		}
		for _, leadIn := range aiAppReplyClarificationLeadIns {
			if strings.Contains(line, leadIn) {
				waitingForQuestion = true
				break
			}
		}
	}
	return ""
}

func cleanAIAppClarificationLine(line string) string {
	line = strings.TrimSpace(strings.TrimLeft(line, "-*•0123456789.、 "))
	return strings.TrimSpace(strings.Trim(line, "*_` "))
}

func extractAIAppDirectQuestion(line string) string {
	end := strings.IndexAny(line, "？?")
	if end < 0 {
		return ""
	}
	questionEnd := end + 1
	if strings.HasPrefix(line[end:], "？") {
		questionEnd = end + len("？")
	}
	question := strings.TrimSpace(strings.Trim(line[:questionEnd], "*_` "))
	for _, starter := range []string{"请问", "你", "您"} {
		if start := strings.Index(question, starter); start >= 0 {
			return sanitizeAIAppClarificationQuestion(question[start:])
		}
	}
	return ""
}

func sanitizeAIAppClarificationQuestion(question string) string {
	question = strings.NewReplacer("**", "", "__", "", "`", "").Replace(question)
	return strings.TrimSpace(strings.Trim(question, "*_ "))
}

func extractAIAppReplyClarificationSuggestions(
	reply string,
	question string,
) []clarificationprotocol.Suggestion {
	lines := strings.Split(strings.ReplaceAll(reply, "\r\n", "\n"), "\n")
	for index, line := range lines {
		if !strings.Contains(sanitizeAIAppClarificationQuestion(line), question) {
			continue
		}
		options := make([]string, 0, 4)
		remaining := line
		for len(options) < 4 {
			start := strings.Index(remaining, "**")
			if start < 0 {
				break
			}
			remaining = remaining[start+2:]
			end := strings.Index(remaining, "**")
			if end < 0 {
				break
			}
			option := strings.TrimSpace(remaining[:end])
			remaining = remaining[end+2:]
			if option == "" || len(option) > 64 || strings.ContainsAny(option, "？?") || containsString(options, option) {
				continue
			}
			options = append(options, option)
		}
		if len(options) < 2 {
			options = extractAIAppReplyListOptions(lines[index+1:])
		}
		if len(options) < 2 && isAIAppReplyPrecedingChoiceQuestion(question) {
			return extractAIAppReplyPrecedingChoices(lines[:index])
		}
		if len(options) < 2 {
			return nil
		}
		suggestions := make([]clarificationprotocol.Suggestion, 0, len(options))
		for _, option := range options {
			suggestions = append(suggestions, clarificationprotocol.Suggestion{Label: option, Value: option})
		}
		return suggestions
	}
	return nil
}

func isAIAppReplyPrecedingChoiceQuestion(question string) bool {
	for _, signal := range []string{
		"哪个方案", "哪一个方案", "哪个计划", "哪一个计划", "哪条路线", "哪个方向",
		"更倾向", "选择哪个", "选哪个",
	} {
		if strings.Contains(question, signal) {
			return true
		}
	}
	return false
}

func extractAIAppReplyPrecedingChoices(lines []string) []clarificationprotocol.Suggestion {
	choices := make([]clarificationprotocol.Suggestion, 0, 4)
	expectedNumber := 1
	for _, line := range lines {
		number, content, ok := extractAIAppReplyNumberedChoice(line)
		if !ok {
			continue
		}
		if number == 1 {
			choices = choices[:0]
			expectedNumber = 1
		}
		if number != expectedNumber {
			continue
		}
		choice, ok := parseAIAppReplyChoice(content)
		if !ok {
			continue
		}
		choices = append(choices, choice)
		expectedNumber++
		if len(choices) == 6 {
			break
		}
	}
	if len(choices) < 2 {
		return nil
	}
	return choices
}

func extractAIAppReplyNumberedChoice(line string) (int, string, bool) {
	value := strings.TrimSpace(line)
	runes := []rune(value)
	digitEnd := 0
	for digitEnd < len(runes) && runes[digitEnd] >= '0' && runes[digitEnd] <= '9' {
		digitEnd++
	}
	if digitEnd == 0 || digitEnd >= len(runes) || !strings.ContainsRune(".、)）", runes[digitEnd]) {
		return 0, "", false
	}
	number := 0
	for _, digit := range runes[:digitEnd] {
		number = number*10 + int(digit-'0')
	}
	content := strings.TrimSpace(string(runes[digitEnd+1:]))
	return number, content, content != ""
}

func parseAIAppReplyChoice(content string) (clarificationprotocol.Suggestion, bool) {
	label := ""
	description := ""
	if start := strings.Index(content, "**"); start >= 0 {
		remaining := content[start+2:]
		if end := strings.Index(remaining, "**"); end >= 0 {
			label = remaining[:end]
			description = remaining[end+2:]
		}
	}
	if label == "" {
		if separator := strings.IndexAny(content, "：:"); separator >= 0 {
			label = content[:separator]
			description = content[separator+len(string([]rune(content[separator:])[0])):]
		} else {
			label = content
		}
	}
	label, ok := normalizeAIAppReplyListOption(label)
	if !ok {
		return clarificationprotocol.Suggestion{}, false
	}
	description = strings.NewReplacer("**", "", "__", "", "`", "").Replace(description)
	description = strings.TrimSpace(strings.TrimLeft(description, "：:—–- "))
	if runes := []rune(description); len(runes) > 240 {
		description = strings.TrimSpace(string(runes[:240])) + "…"
	}
	return clarificationprotocol.Suggestion{
		Label: label, Value: label, Description: description,
	}, true
}
