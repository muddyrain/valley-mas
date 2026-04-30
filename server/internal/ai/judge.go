package ai

import (
	"encoding/json"
	"strings"
	"valley-server/internal/mindarena"
)

const (
	maxJudgeAdviceRunes = 84
	maxJudgeQuoteRunes  = 42
)

func buildJudgePromptInput(topic string, personas []mindarena.Persona, messages []mindarena.DebateMessage) string {
	payload := struct {
		Topic       string                    `json:"topic"`
		JudgeGoal   string                    `json:"judgeGoal"`
		Constraints []string                  `json:"constraints"`
		ScoreRules  []string                  `json:"scoreRules"`
		Personas    []mindarena.Persona       `json:"personas"`
		Messages    []mindarena.DebateMessage `json:"messages"`
	}{
		Topic:     topic,
		JudgeGoal: "根据三轮辩论选出最终胜者，给出一句决策建议、一句金句，以及每个人格的支持率分数。",
		Constraints: []string{
			"winner 必须是 personas 中的 name。",
			"finalAdvice 必须是一句面向用户的最终建议，不能只复述某个人格观点。",
			"quote 必须短、有传播感、能总结这场脑内会议。",
			"scores 必须覆盖每一个 persona，不能新增、漏掉或改名。",
			"只输出 DebateResult JSON，不要 Markdown，不要解释。",
		},
		ScoreRules: []string{
			"score 是 0 到 100 的整数。",
			"最高分人格应与 winner 一致。",
			"分数要体现辩论表现差异，不要全部相同。",
		},
		Personas: personas,
		Messages: messages,
	}
	raw, _ := json.Marshal(payload)
	return string(raw)
}

func normalizeGeneratedDebateResult(result mindarena.DebateResult, personas []mindarena.Persona, messages []mindarena.DebateMessage) *mindarena.DebateResult {
	scores := normalizeDebateScores(result.Scores, personas)
	winner := normalizeDebateWinner(result.Winner, personas, scores)
	finalAdvice := truncateRunes(sanitizeDebateMessageContent(result.FinalAdvice), maxJudgeAdviceRunes)
	if finalAdvice == "" {
		finalAdvice = fallbackFinalAdvice(winner)
	}
	quote := truncateRunes(sanitizeDebateMessageContent(result.Quote), maxJudgeQuoteRunes)
	if quote == "" {
		quote = fallbackJudgeQuote(winner, messages)
	}

	return &mindarena.DebateResult{
		Winner:      winner,
		FinalAdvice: finalAdvice,
		Quote:       quote,
		Scores:      scores,
	}
}

func normalizeDebateScores(generated []mindarena.DebateScore, personas []mindarena.Persona) []mindarena.DebateScore {
	if len(personas) == 0 {
		return nil
	}

	used := make(map[int]bool, len(generated))
	scores := make([]mindarena.DebateScore, 0, len(personas))
	for i, persona := range personas {
		score, matchedIndex := findGeneratedScoreForPersona(persona, generated, used)
		if matchedIndex >= 0 {
			used[matchedIndex] = true
		} else {
			score = fallbackDebateScore(i)
		}

		scores = append(scores, mindarena.DebateScore{
			Persona: persona.Name,
			Score:   clampScore(score),
		})
	}
	return scores
}

func findGeneratedScoreForPersona(persona mindarena.Persona, generated []mindarena.DebateScore, used map[int]bool) (int, int) {
	for i := range generated {
		if used[i] {
			continue
		}
		if strings.TrimSpace(generated[i].Persona) == persona.Name {
			return generated[i].Score, i
		}
	}
	return 0, -1
}

func normalizeDebateWinner(winner string, personas []mindarena.Persona, scores []mindarena.DebateScore) string {
	trimmedWinner := strings.TrimSpace(winner)
	for _, persona := range personas {
		if trimmedWinner == persona.Name {
			return persona.Name
		}
	}

	if len(scores) > 0 {
		best := scores[0]
		for _, score := range scores[1:] {
			if score.Score > best.Score {
				best = score
			}
		}
		return best.Persona
	}
	if len(personas) > 0 {
		return personas[0].Name
	}
	return ""
}

func clampScore(score int) int {
	if score < 0 {
		return 0
	}
	if score > 100 {
		return 100
	}
	return score
}

func fallbackDebateScore(index int) int {
	base := []int{82, 76, 73, 78, 70}
	return base[index%len(base)]
}

func fallbackFinalAdvice(winner string) string {
	if winner == "" {
		return "先把选择拆成可验证的小步，再决定要不要加码。"
	}
	return winner + "赢在更能落地，先按这个方向小步验证。"
}

func fallbackJudgeQuote(winner string, messages []mindarena.DebateMessage) string {
	for i := len(messages) - 1; i >= 0; i-- {
		if winner != "" && messages[i].PersonaName != winner {
			continue
		}
		content := truncateRunes(sanitizeDebateMessageContent(messages[i].Content), maxJudgeQuoteRunes)
		if content != "" {
			return content
		}
	}
	return "别让情绪替你拍板，也别让恐惧替你否决。"
}
