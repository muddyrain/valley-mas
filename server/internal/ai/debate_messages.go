package ai

import (
	"encoding/json"
	"strings"
	"unicode/utf8"
	"valley-server/internal/mindarena"
)

const (
	maxDebateMessageRunes       = 50
	maxRoundOneFallbackRuneSize = 46
)

func normalizeGeneratedDebateMessages(generated []mindarena.DebateMessage, personas []mindarena.Persona, round int) []mindarena.DebateMessage {
	if len(personas) == 0 {
		return nil
	}

	used := make(map[int]bool, len(generated))
	normalized := make([]mindarena.DebateMessage, 0, len(personas))
	for _, persona := range personas {
		message, matchedIndex := findGeneratedMessageForPersona(persona, generated, used)
		if matchedIndex >= 0 {
			used[matchedIndex] = true
		}

		content := ""
		if message != nil {
			content = sanitizeDebateMessageContent(message.Content)
		}
		if content == "" {
			content = fallbackDebateMessageContent(persona, round)
		}
		content = truncateRunes(content, maxDebateMessageRunes)

		normalized = append(normalized, mindarena.DebateMessage{
			PersonaID:   persona.ID,
			PersonaName: persona.Name,
			Content:     content,
		})
	}

	return normalized
}

func findGeneratedMessageForPersona(persona mindarena.Persona, generated []mindarena.DebateMessage, used map[int]bool) (*mindarena.DebateMessage, int) {
	for i := range generated {
		if used[i] {
			continue
		}
		if generated[i].PersonaID == persona.ID || generated[i].PersonaName == persona.Name {
			return &generated[i], i
		}
	}
	for i := range generated {
		if used[i] {
			continue
		}
		if i < len(canonicalMindArenaPersonas) && canonicalMindArenaPersonas[i].ID == persona.ID {
			return &generated[i], i
		}
	}
	return nil, -1
}

func sanitizeDebateMessageContent(content string) string {
	trimmed := strings.TrimSpace(content)
	trimmed = strings.Trim(trimmed, "\"'“”‘’")
	trimmed = strings.ReplaceAll(trimmed, "\r", "")
	trimmed = strings.ReplaceAll(trimmed, "\n", "")
	return strings.TrimSpace(trimmed)
}

func fallbackDebateMessageContent(persona mindarena.Persona, round int) string {
	switch round {
	case 1:
		return fallbackRoundOneMessage(persona)
	case 2:
		return fallbackRoundTwoMessage(persona)
	case 3:
		return fallbackRoundThreeMessage(persona)
	default:
		return truncateRunes(persona.Stance, maxDebateMessageRunes)
	}
}

func fallbackRoundOneMessage(persona mindarena.Persona) string {
	switch persona.Name {
	case "理性派":
		return "我支持先算清风险和回报，再决定要不要上桌。"
	case "毒舌派":
		return "我先泼冷水，别把一时上头误认成天命召唤。"
	case "赌徒派":
		return "我支持先冲一次，机会错过了可不会自己回头。"
	case "父母派":
		return "我先站稳字当头，基本盘没护住就别急着变。"
	case "摆烂派":
		return "我建议先缓一口气，别在崩溃时替人生签字。"
	default:
		return truncateRunes(persona.Stance, maxRoundOneFallbackRuneSize)
	}
}

func fallbackRoundTwoMessage(persona mindarena.Persona) string {
	switch persona.Name {
	case "理性派":
		return "热血可以有，但别把风险当背景音乐。"
	case "毒舌派":
		return "你们说得再燃，账算不平照样翻车。"
	case "赌徒派":
		return "犹豫太久的人，往往输在还没上场。"
	case "父母派":
		return "先把现实问题答完，再谈理想多闪亮。"
	case "摆烂派":
		return "先别吵赢，先别把自己累坏。"
	default:
		return truncateRunes(persona.Stance, maxDebateMessageRunes)
	}
}

func fallbackRoundThreeMessage(persona mindarena.Persona) string {
	switch persona.Name {
	case "理性派":
		return "结论很简单，算清代价后再决定值不值得做。"
	case "毒舌派":
		return "真要冲就别骗自己，别把冲动包装成热爱。"
	case "赌徒派":
		return "想做就定个启动日，别把一生耗在预热里。"
	case "父母派":
		return "先留退路，再谈出发，稳住才走得远。"
	case "摆烂派":
		return "先睡够再决定，清醒的人生比硬撑体面。"
	default:
		return truncateRunes(persona.Stance, maxDebateMessageRunes)
	}
}

func buildDebateRoundPromptInput(topic string, mode string, personas []mindarena.Persona, round int, history []mindarena.DebateMessage) string {
	payload := struct {
		Topic       string                    `json:"topic"`
		Mode        string                    `json:"mode"`
		Round       int                       `json:"round"`
		RoundGoal   string                    `json:"roundGoal"`
		Constraints []string                  `json:"constraints"`
		Personas    []mindarena.Persona       `json:"personas"`
		History     []mindarena.DebateMessage `json:"history"`
	}{
		Topic:       topic,
		Mode:        mode,
		Round:       round,
		RoundGoal:   debateRoundGoal(round),
		Constraints: debateRoundConstraints(round),
		Personas:    personas,
		History:     history,
	}
	raw, _ := jsonMarshal(payload)
	return raw
}

func debateRoundGoal(round int) string {
	switch round {
	case 1:
		return "开场亮立场：每个人格先亮明自己的倾向和核心理由。"
	case 2:
		return "互相反驳：针对其他人格刚才的观点开火。"
	case 3:
		return "最终陈词：给出最后建议和态度收束。"
	default:
		return "继续围绕议题辩论。"
	}
}

func debateRoundConstraints(round int) []string {
	base := []string{
		"每个人格只说一句话。",
		"每句话不超过 50 个中文字符。",
		"输出顺序必须与 personas 数组顺序一致。",
		"只能输出 messages JSON，不要解释。",
	}

	switch round {
	case 1:
		return append(base,
			"Round 1 只做立场表达，不要反驳其他人格，不要下最终结论。",
			"每句话要先亮态度，再补一个最核心的理由。",
			"不要连续提问，不要把一句话写成清单。",
		)
	case 2:
		return append(base,
			"Round 2 必须点到别人的漏洞，不能重复 Round 1 原话。",
			"可以犀利，但不要辱骂用户。",
		)
	case 3:
		return append(base,
			"Round 3 要收束，不要再展开新论点。",
			"像综艺最后发言，态度明确、节奏利落。",
		)
	default:
		return base
	}
}

func truncateRunes(value string, limit int) string {
	if limit <= 0 || utf8.RuneCountInString(value) <= limit {
		return value
	}
	runes := []rune(value)
	return strings.TrimSpace(string(runes[:limit]))
}

func jsonMarshal(v any) (string, error) {
	raw, err := json.Marshal(v)
	if err != nil {
		return "", err
	}
	return string(raw), nil
}
