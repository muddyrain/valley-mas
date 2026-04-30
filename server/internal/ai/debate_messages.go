package ai

import (
	"encoding/json"
	"fmt"
	"strings"
	"unicode/utf8"
	"valley-server/internal/mindarena"
)

const (
	maxDebateMessageRunes       = 60
	maxRoundOneFallbackRuneSize = 56
)

type roundTwoRebuttalTarget struct {
	PersonaID         string `json:"personaId"`
	PersonaName       string `json:"personaName"`
	TargetPersonaID   string `json:"targetPersonaId"`
	TargetPersonaName string `json:"targetPersonaName"`
	TargetContent     string `json:"targetContent"`
}

type roundThreeSummaryBrief struct {
	PersonaID       string `json:"personaId"`
	PersonaName     string `json:"personaName"`
	OpeningContent  string `json:"openingContent,omitempty"`
	RebuttalContent string `json:"rebuttalContent,omitempty"`
	AdviceFocus     string `json:"adviceFocus"`
}

type personaVoiceHint struct {
	PersonaID   string `json:"personaId"`
	PersonaName string `json:"personaName"`
	Voice       string `json:"voice"`
}

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
		defaults := defaultMindArenaPersonas()
		if i < len(defaults) && defaults[i].ID == persona.ID {
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
		return "先别被热血带节奏，我要先把风险、现金流和退路算清。"
	case "毒舌派":
		return "我先拆台，这更像逃离眼下，不像深思熟虑的理想。"
	case "赌徒派":
		return "机会来了还捂着口袋，等于亲手把翻盘按钮关掉。"
	case "父母派":
		return "先把房租、社保和家里交代想明白，再谈潇洒转身。"
	case "摆烂派":
		return "你现在像在情绪高压下拍板，我建议先缓口气再说。"
	default:
		return truncateRunes(persona.Stance, maxRoundOneFallbackRuneSize)
	}
}

func fallbackRoundTwoMessage(persona mindarena.Persona) string {
	switch persona.Name {
	case "理性派":
		return "赌徒派别拿热血装答案，现金流断了谁替你续命。"
	case "毒舌派":
		return "理性派算得再细，也别把怂包装成稳健策略。"
	case "赌徒派":
		return "父母派老想先保全一切，机会可不会等你批完流程。"
	case "父母派":
		return "毒舌派只会点火不管后果，真扛账单的是现实。"
	case "摆烂派":
		return "你们都想赢辩论，我只想提醒别把自己先吵崩。"
	default:
		return truncateRunes(persona.Stance, maxDebateMessageRunes)
	}
}

func fallbackRoundThreeMessage(persona mindarena.Persona) string {
	switch persona.Name {
	case "理性派":
		return "结论：先用副业验证市场，再决定值不值得正式离场。"
	case "毒舌派":
		return "真要冲就别演热爱，先证明你不是在逃避当前生活。"
	case "赌徒派":
		return "给自己定启动日和止损线，别把野心耗成长期预热。"
	case "父母派":
		return "先备足安全垫和 Plan B，再出发才不会把家底押光。"
	case "摆烂派":
		return "先睡够、先复原，再用清醒脑子决定要不要翻桌重来。"
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
		VoiceHints  []personaVoiceHint        `json:"personaVoiceHints"`
		Rebuttals   []roundTwoRebuttalTarget  `json:"rebuttalTargets,omitempty"`
		Summaries   []roundThreeSummaryBrief  `json:"summaryBriefs,omitempty"`
		Personas    []mindarena.Persona       `json:"personas"`
		History     []mindarena.DebateMessage `json:"history"`
	}{
		Topic:       topic,
		Mode:        mode,
		Round:       round,
		RoundGoal:   debateRoundGoal(round),
		Constraints: debateRoundConstraints(round),
		VoiceHints:  buildPersonaVoiceHints(personas),
		Rebuttals:   buildRoundTwoRebuttalTargets(round, personas, history),
		Summaries:   buildRoundThreeSummaryBriefs(round, personas, history),
		Personas:    personas,
		History:     history,
	}
	raw, _ := jsonMarshal(payload)
	return raw
}

func buildDebateMessagePromptInput(topic string, mode string, personas []mindarena.Persona, persona mindarena.Persona, round int, history []mindarena.DebateMessage) string {
	personaIndex := findPersonaIndex(persona, personas)
	payload := struct {
		Topic          string                    `json:"topic"`
		Mode           string                    `json:"mode"`
		Round          int                       `json:"round"`
		RoundGoal      string                    `json:"roundGoal"`
		Constraints    []string                  `json:"constraints"`
		CurrentPersona mindarena.Persona         `json:"currentPersona"`
		CurrentVoice   string                    `json:"currentPersonaVoice"`
		RebuttalTarget *roundTwoRebuttalTarget   `json:"rebuttalTarget,omitempty"`
		SummaryBrief   *roundThreeSummaryBrief   `json:"summaryBrief,omitempty"`
		Personas       []mindarena.Persona       `json:"personas"`
		History        []mindarena.DebateMessage `json:"history"`
	}{
		Topic:          topic,
		Mode:           mode,
		Round:          round,
		RoundGoal:      debateRoundGoal(round),
		Constraints:    append(debateRoundConstraints(round), "只输出 currentPersona 的一条 messages JSON。"),
		CurrentPersona: persona,
		CurrentVoice:   personaVoiceGuide(persona),
		RebuttalTarget: buildSingleRoundTwoRebuttalTarget(round, persona, personaIndex, personas, history),
		SummaryBrief:   buildSingleRoundThreeSummaryBrief(round, persona, history),
		Personas:       personas,
		History:        history,
	}
	raw, _ := jsonMarshal(payload)
	return raw
}

func buildRoundTwoRebuttalTargets(round int, personas []mindarena.Persona, history []mindarena.DebateMessage) []roundTwoRebuttalTarget {
	if round != 2 || len(personas) < 2 || len(history) == 0 {
		return nil
	}

	targets := make([]roundTwoRebuttalTarget, 0, len(personas))
	for i, persona := range personas {
		target := findRebuttalTargetMessage(persona, i, personas, history)
		if target == nil {
			continue
		}

		content := sanitizeDebateMessageContent(target.Content)
		if content == "" {
			continue
		}

		targets = append(targets, roundTwoRebuttalTarget{
			PersonaID:         persona.ID,
			PersonaName:       persona.Name,
			TargetPersonaID:   target.PersonaID,
			TargetPersonaName: target.PersonaName,
			TargetContent:     truncateRunes(content, maxDebateMessageRunes),
		})
	}
	return targets
}

func buildSingleRoundTwoRebuttalTarget(round int, persona mindarena.Persona, personaIndex int, personas []mindarena.Persona, history []mindarena.DebateMessage) *roundTwoRebuttalTarget {
	if round != 2 || personaIndex < 0 {
		return nil
	}
	target := findRebuttalTargetMessage(persona, personaIndex, personas, history)
	if target == nil {
		return nil
	}
	content := sanitizeDebateMessageContent(target.Content)
	if content == "" {
		return nil
	}
	return &roundTwoRebuttalTarget{
		PersonaID:         persona.ID,
		PersonaName:       persona.Name,
		TargetPersonaID:   target.PersonaID,
		TargetPersonaName: target.PersonaName,
		TargetContent:     truncateRunes(content, maxDebateMessageRunes),
	}
}

func findRebuttalTargetMessage(persona mindarena.Persona, personaIndex int, personas []mindarena.Persona, history []mindarena.DebateMessage) *mindarena.DebateMessage {
	for offset := 1; offset < len(personas); offset++ {
		targetPersona := personas[(personaIndex+offset)%len(personas)]
		if target := findRoundOneHistoryMessage(targetPersona, history); target != nil {
			return target
		}
	}

	for i := range history {
		if history[i].Round != 1 || isMessageFromPersona(history[i], persona) {
			continue
		}
		if sanitizeDebateMessageContent(history[i].Content) != "" {
			return &history[i]
		}
	}
	return nil
}

func findRoundOneHistoryMessage(persona mindarena.Persona, history []mindarena.DebateMessage) *mindarena.DebateMessage {
	for i := range history {
		if history[i].Round != 1 || !isMessageFromPersona(history[i], persona) {
			continue
		}
		if sanitizeDebateMessageContent(history[i].Content) != "" {
			return &history[i]
		}
	}
	return nil
}

func isMessageFromPersona(message mindarena.DebateMessage, persona mindarena.Persona) bool {
	if persona.ID != "" && message.PersonaID == persona.ID {
		return true
	}
	return persona.Name != "" && message.PersonaName == persona.Name
}

func buildRoundThreeSummaryBriefs(round int, personas []mindarena.Persona, history []mindarena.DebateMessage) []roundThreeSummaryBrief {
	if round != 3 || len(personas) == 0 || len(history) == 0 {
		return nil
	}

	briefs := make([]roundThreeSummaryBrief, 0, len(personas))
	for _, persona := range personas {
		briefs = append(briefs, roundThreeSummaryBrief{
			PersonaID:       persona.ID,
			PersonaName:     persona.Name,
			OpeningContent:  historyContentForPersonaRound(persona, history, 1),
			RebuttalContent: historyContentForPersonaRound(persona, history, 2),
			AdviceFocus:     finalAdviceFocus(persona),
		})
	}
	return briefs
}

func buildSingleRoundThreeSummaryBrief(round int, persona mindarena.Persona, history []mindarena.DebateMessage) *roundThreeSummaryBrief {
	if round != 3 {
		return nil
	}
	brief := roundThreeSummaryBrief{
		PersonaID:       persona.ID,
		PersonaName:     persona.Name,
		OpeningContent:  historyContentForPersonaRound(persona, history, 1),
		RebuttalContent: historyContentForPersonaRound(persona, history, 2),
		AdviceFocus:     finalAdviceFocus(persona),
	}
	return &brief
}

func findPersonaIndex(persona mindarena.Persona, personas []mindarena.Persona) int {
	for i, candidate := range personas {
		if candidate.ID == persona.ID || candidate.Name == persona.Name {
			return i
		}
	}
	return -1
}

func historyContentForPersonaRound(persona mindarena.Persona, history []mindarena.DebateMessage, round int) string {
	for i := range history {
		if history[i].Round != round || !isMessageFromPersona(history[i], persona) {
			continue
		}
		content := sanitizeDebateMessageContent(history[i].Content)
		if content != "" {
			return truncateRunes(content, maxDebateMessageRunes)
		}
	}
	return ""
}

func finalAdviceFocus(persona mindarena.Persona) string {
	switch persona.Name {
	case "理性派":
		return "把前两轮争论收束成可执行条件、风险边界和下一步验证。"
	case "毒舌派":
		return "拆掉自我欺骗，只留下一个清醒但不伤人的提醒。"
	case "赌徒派":
		return "把冲劲落到具体行动窗口，别让热血无限空转。"
	case "父母派":
		return "给出保底方案、现实账本和能安心出发的前提。"
	case "摆烂派":
		return "提醒用户先恢复状态，再做决定，语气松弛但有结论。"
	default:
		return "结合自己的立场给出最终建议，必须收束成可行动判断。"
	}
}

func buildPersonaVoiceHints(personas []mindarena.Persona) []personaVoiceHint {
	hints := make([]personaVoiceHint, 0, len(personas))
	for _, persona := range personas {
		hints = append(hints, personaVoiceHint{
			PersonaID:   persona.ID,
			PersonaName: persona.Name,
			Voice:       personaVoiceGuide(persona),
		})
	}
	return hints
}

func personaVoiceGuide(persona mindarena.Persona) string {
	return fmt.Sprintf("人格气质：%s；表达方式：%s；口头禅气场：%s。", persona.Personality, persona.Style, persona.Catchphrase)
}

func debateRoundGoal(round int) string {
	switch round {
	case 1:
		return "开场亮立场：每个人格先亮明自己的倾向和核心理由。"
	case 2:
		return "互相反驳：根据 history 和 rebuttalTargets，针对其他人格刚才的观点开火。"
	case 3:
		return "最终陈词：根据 history 和 summaryBriefs，把前两轮冲突收束成最后建议。"
	default:
		return "继续围绕议题辩论。"
	}
}

func debateRoundConstraints(round int) []string {
	base := []string{
		"每个人格只说一句话。",
		"每句话不超过 60 个中文字符。",
		"必须把人格的 personality、style、catchphrase 气质写进话里，让人一眼听出是谁。",
		"输出顺序必须与 personas 数组顺序一致。",
		"只能输出 messages JSON，不要解释。",
	}

	switch round {
	case 1:
		return append(base,
			"Round 1 只做立场表达，不要反驳其他人格，不要下最终结论。",
			"每句话要先亮态度，再补一个最核心的理由。",
			"句子可以更完整，但不要堆砌空话或连续口号。",
			"不要连续提问，不要把一句话写成清单。",
		)
	case 2:
		return append(base,
			"Round 2 必须点到别人的漏洞，不能重复 Round 1 原话。",
			"优先使用 rebuttalTargets 中对应自己的一条目标，明确回应 targetPersonaName 的 Round 1 观点。",
			"每句必须形成反驳关系：先指出对方漏洞，再给自己的反向判断。",
			"反驳要直接，但火力只能对观点，不能辱骂用户。",
			"可以犀利，但不要辱骂用户。",
		)
	case 3:
		return append(base,
			"Round 3 要收束，不要再展开新论点。",
			"必须参考 summaryBriefs 中自己的 openingContent、rebuttalContent 和 adviceFocus。",
			"每句话要给出明确建议或决策条件，不能只喊口号。",
			"不要宣布最终胜者，裁判结果由下一步 judge 单独生成。",
			"像综艺最后发言，态度明确、节奏利落，而且要给出能执行的收尾动作。",
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
