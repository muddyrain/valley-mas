package handler

import "strings"

// aiAppTypeWorkflow identifies the AIApp mirror that every workflow maintains
// for run snapshots and knowledge retrieval. The agent app surface was
// removed, but the workflow mirror and its version snapshots remain.
const aiAppTypeWorkflow = "workflow"

// Shared workbench limits. The workflow collaboration feature reuses the
// durable task and attachment budgets that were originally defined for agent
// conversations, so they stay here as stable cross-feature constraints.
const (
	aiAppTaskMaxConcurrentPerUser = 3
	aiAppTaskMaxUnfinishedPerUser = 20

	aiAppAttachmentMaxBytes      = 2 * 1024 * 1024
	aiAppImageAttachmentMaxBytes = 5 * 1024 * 1024
	aiAppAttachmentMaxCount      = 3
	aiAppAttachmentContextRunes  = 12000
)

// Prompt assistant field limits, extracted from the removed agent config
// schema. They still bound generated system prompts, opening messages and
// example questions for the remaining workflow / prompt-library targets.
const (
	maxPromptSystemRunes    = 12000
	maxPromptOpeningRunes   = 1000
	maxPromptQuestions      = 4
	maxPromptQuestionRunes  = 120
	promptModelProfileText  = "ark-text-default"
	maxPromptAgentDescRunes = 500
)

// normalizePromptQuestions trims, dedupes and caps generated example questions.
func normalizePromptQuestions(values []string) []string {
	seen := make(map[string]struct{}, len(values))
	questions := make([]string, 0, min(len(values), maxPromptQuestions))
	for _, item := range values {
		question := strings.TrimSpace(item)
		if question == "" {
			continue
		}
		if _, exists := seen[question]; exists {
			continue
		}
		seen[question] = struct{}{}
		questions = append(questions, question)
		if len(questions) == maxPromptQuestions {
			break
		}
	}
	return questions
}
