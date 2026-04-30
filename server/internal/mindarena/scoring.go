package mindarena

import (
	"fmt"
	"strings"
	"unicode/utf8"
)

var (
	judgeClarityKeywords  = []string{"因为", "所以", "如果", "但", "先", "再", "而是", "不是"}
	judgeOpeningKeywords  = []string{"支持", "不支持", "建议", "应该", "先", "别"}
	judgeRebuttalKeywords = []string{"但", "别", "不是", "问题", "漏洞", "反而", "先别", "你这"}
	judgeAllianceKeywords = []string{"这点我认", "我同意", "有道理", "说得对", "这句没错", "我赞成", "我站", "我跟"}
	judgeClosingKeywords  = []string{"先", "再", "如果", "可以", "方案", "准备", "验证", "执行", "止损", "存够"}
)

type liveRawScore struct {
	personaID     string
	personaName   string
	judgeRaw      float64
	judgeScore    int
	audienceScore int
	totalScore    int
	judgeNote     string
	messageCount  int
	latestMessage *DebateMessage
}

func rebuildLiveScoreState(session *DebateSession) {
	if session == nil {
		return
	}
	scores, judge := evaluateLiveScoreState(session)
	session.LiveScores = scores
	session.NeutralJudge = judge
}

func evaluateLiveScoreState(session *DebateSession) ([]DebateScore, *NeutralJudgeState) {
	if session == nil {
		return nil, defaultNeutralJudgeState(DebateModeFunny, 1, nil)
	}

	personas := append([]Persona(nil), session.Personas...)
	messages := append([]DebateMessage(nil), session.Messages...)
	supportHistory := append([]RoundSupportChoice(nil), session.SupportHistory...)
	currentRound := resolveScoreRound(session)

	rawScores := make([]liveRawScore, 0, len(personas))
	activeRaw := make([]float64, 0, len(personas))
	for _, persona := range personas {
		personaMessages := filterMessagesForPersona(messages, persona)
		judgeRaw := 0.0
		judgeNote := ""
		var latestMessage *DebateMessage
		seen := make(map[string]bool, len(personaMessages))
		for i := range personaMessages {
			content := normalizeScoreContent(personaMessages[i].Content)
			score, note := evaluateJudgeMessageScore(session.Mode, personaMessages[i], content, personas, seen)
			judgeRaw += score
			if note != "" {
				judgeNote = note
			}
			if latestMessage == nil || personaMessages[i].Round >= latestMessage.Round {
				msg := personaMessages[i]
				latestMessage = &msg
			}
		}

		if len(personaMessages) > 0 {
			judgeRaw += float64(completedRoundsForScore(personaMessages)) * 3.5
			activeRaw = append(activeRaw, judgeRaw)
		}

		rawScores = append(rawScores, liveRawScore{
			personaID:     persona.ID,
			personaName:   persona.Name,
			judgeRaw:      judgeRaw,
			audienceScore: audienceScoreForPersona(persona, supportHistory),
			judgeNote:     judgeNote,
			messageCount:  len(personaMessages),
			latestMessage: latestMessage,
		})
	}

	minRaw, maxRaw := scoreRawBounds(activeRaw)
	liveScores := make([]DebateScore, 0, len(rawScores))
	for i := range rawScores {
		if rawScores[i].messageCount > 0 {
			rawScores[i].judgeScore = normalizeJudgeScore(rawScores[i].judgeRaw, minRaw, maxRaw)
		}
		rawScores[i].totalScore = clampLiveScore(rawScores[i].judgeScore + rawScores[i].audienceScore)
		if rawScores[i].messageCount == 0 && rawScores[i].audienceScore == 0 {
			rawScores[i].judgeNote = "等待上场"
		}
		liveScores = append(liveScores, DebateScore{
			Persona:       rawScores[i].personaName,
			PersonaID:     rawScores[i].personaID,
			Score:         rawScores[i].totalScore,
			JudgeScore:    rawScores[i].judgeScore,
			AudienceScore: rawScores[i].audienceScore,
			JudgeNote:     rawScores[i].judgeNote,
		})
	}

	return liveScores, buildNeutralJudgeState(session.Mode, currentRound, rawScores, supportHistory)
}

func evaluateJudgeMessageScore(mode DebateMode, message DebateMessage, content string, personas []Persona, seen map[string]bool) (float64, string) {
	if content == "" {
		return 0, "这句还没站稳"
	}

	base := 18.0
	switch message.Round {
	case 1:
		base = 24
	case 2:
		base = 29
	case 3:
		base = 32
	}

	lengthScore := minFloat(float64(utf8.RuneCountInString(content)), 42) * 0.42
	clarityScore := keywordScore(content, judgeClarityKeywords, 2.1)
	modeScore := judgeModeScore(mode, message.Round, content)
	repetitionPenalty := 0.0
	if seen[content] {
		repetitionPenalty = 10
	} else {
		seen[content] = true
	}

	roundScore := 0.0
	note := "有观点，但还可以更狠"
	switch message.Round {
	case 1:
		roundScore = keywordScore(content, judgeOpeningKeywords, 2.4)
		if roundScore >= 6 {
			note = "立场亮得够快"
		} else {
			note = "立场还不够清楚"
		}
	case 2:
		mentionScore := keywordScore(content, otherPersonaNames(personas, message.PersonaID), 4.4)
		rebuttalScore := keywordScore(content, judgeRebuttalKeywords, 2.8)
		allianceScore := keywordScore(content, judgeAllianceKeywords, 2.5)
		roundScore = mentionScore + maxFloat(rebuttalScore, allianceScore)
		switch {
		case mentionScore >= 4.4 && rebuttalScore >= 5.6:
			note = "拆招够直接"
		case mentionScore >= 4.4 && allianceScore >= 5:
			note = "借力打力很聪明"
		case allianceScore >= 5:
			note = "会借对手的话抬自己"
		case rebuttalScore >= 5.6:
			note = "火力在线"
		default:
			note = "回应还差点准头"
		}
	case 3:
		actionScore := keywordScore(content, judgeClosingKeywords, 2.7)
		roundScore = actionScore
		switch {
		case actionScore >= 8:
			note = "收尾能落地"
		case actionScore >= 4:
			note = "结论开始收住了"
		default:
			note = "结论还不够实"
		}
	}

	raw := base + lengthScore + clarityScore + modeScore + roundScore - repetitionPenalty
	if raw < 0 {
		raw = 0
	}
	return raw, note
}

func buildNeutralJudgeState(mode DebateMode, currentRound int, rawScores []liveRawScore, supportHistory []RoundSupportChoice) *NeutralJudgeState {
	state := defaultNeutralJudgeState(mode, currentRound, supportHistory)
	if len(rawScores) == 0 {
		return state
	}

	leader := rawScores[0]
	for _, candidate := range rawScores[1:] {
		if candidate.totalScore > leader.totalScore {
			leader = candidate
		}
	}

	state.LeadingPersona = leader.personaName
	state.Summary = fmt.Sprintf("目前 %s 领先，中立裁判认为 TA %s。", leader.personaName, normalizeJudgeSummaryNote(leader.judgeNote))

	if latest := latestSupportChoiceForSummary(supportHistory); latest != nil {
		if latest.Skipped {
			state.Summary += " 你上一轮没有投票，这一轮主要看裁判分。"
		} else {
			state.Summary += fmt.Sprintf(" 你的站队已经给 %s 加了 %d 分。", latest.PersonaName, latest.SupportScore)
		}
	}

	return state
}

func defaultNeutralJudgeState(mode DebateMode, currentRound int, supportHistory []RoundSupportChoice) *NeutralJudgeState {
	return &NeutralJudgeState{
		Name:           "中立裁判",
		CurrentRound:   currentRound,
		Focus:          judgeFocusByRound(mode, currentRound),
		Summary:        "所有人格发言后，中立裁判会结合当前辩论风格和现场表现实时打分。",
		UpdatedAt:      nowString(),
		LeadingPersona: "",
	}
}

func judgeFocusByRound(mode DebateMode, round int) string {
	modeFocus := judgeModeFocus(mode)
	switch round {
	case 1:
		return "更看重立场是否清楚、理由是否具体。" + modeFocus
	case 2:
		return "更看重谁能拆招够准，或借别人的合理点反手抬高自己。" + modeFocus
	case 3:
		return "更看重谁能把争论收束成可执行建议。" + modeFocus
	default:
		return "更看重谁能在加时里压住场子，把观点说得更狠更稳。" + modeFocus
	}
}

func resolveScoreRound(session *DebateSession) int {
	if session == nil {
		return 1
	}
	if session.AwaitingSupport && session.AwaitingSupportRound > 0 {
		return session.AwaitingSupportRound
	}
	if len(session.Messages) > 0 {
		return session.Messages[len(session.Messages)-1].Round
	}
	if session.CurrentRound > 0 {
		return session.CurrentRound
	}
	return 1
}

func filterMessagesForPersona(messages []DebateMessage, persona Persona) []DebateMessage {
	filtered := make([]DebateMessage, 0, len(messages))
	for _, message := range messages {
		if persona.ID != "" && message.PersonaID == persona.ID {
			filtered = append(filtered, message)
			continue
		}
		if persona.Name != "" && message.PersonaName == persona.Name {
			filtered = append(filtered, message)
		}
	}
	return filtered
}

func otherPersonaNames(personas []Persona, personaID string) []string {
	names := make([]string, 0, len(personas))
	for _, persona := range personas {
		if persona.ID == personaID {
			continue
		}
		if strings.TrimSpace(persona.Name) != "" {
			names = append(names, persona.Name)
		}
	}
	return names
}

func keywordScore(content string, keywords []string, weight float64) float64 {
	score := 0.0
	for _, keyword := range keywords {
		if strings.Contains(content, keyword) {
			score += weight
		}
	}
	return score
}

func normalizeScoreContent(content string) string {
	trimmed := strings.TrimSpace(content)
	return strings.ReplaceAll(trimmed, " ", "")
}

func completedRoundsForScore(messages []DebateMessage) int {
	rounds := make(map[int]struct{}, len(messages))
	for _, message := range messages {
		rounds[message.Round] = struct{}{}
	}
	return len(rounds)
}

func audienceScoreForPersona(persona Persona, supportHistory []RoundSupportChoice) int {
	score := 0
	for _, choice := range supportHistory {
		if choice.Skipped {
			continue
		}
		if (choice.PersonaID != "" && choice.PersonaID == persona.ID) || (choice.PersonaName != "" && choice.PersonaName == persona.Name) {
			score += choice.SupportScore
		}
	}
	return score
}

func scoreRawBounds(raw []float64) (float64, float64) {
	if len(raw) == 0 {
		return 0, 0
	}
	minRaw := raw[0]
	maxRaw := raw[0]
	for _, value := range raw[1:] {
		if value < minRaw {
			minRaw = value
		}
		if value > maxRaw {
			maxRaw = value
		}
	}
	return minRaw, maxRaw
}

func normalizeJudgeScore(raw, minRaw, maxRaw float64) int {
	if maxRaw <= minRaw {
		return clampLiveScore(58)
	}
	normalized := 34 + ((raw-minRaw)/(maxRaw-minRaw))*48
	return clampLiveScore(int(normalized + 0.5))
}

func clampLiveScore(score int) int {
	if score < 0 {
		return 0
	}
	if score > 100 {
		return 100
	}
	return score
}

func supportScoreForRound(round int) int {
	switch round {
	case 1:
		return 12
	case 2:
		return 16
	case 3:
		return 10
	case 4:
		return 12
	default:
		return 14
	}
}

func latestSupportChoiceForSummary(history []RoundSupportChoice) *RoundSupportChoice {
	for i := len(history) - 1; i >= 0; i-- {
		choice := history[i]
		if choice.Round > 0 {
			return &choice
		}
	}
	return nil
}

func normalizeJudgeSummaryNote(note string) string {
	if strings.TrimSpace(note) == "" {
		return "还在等更完整的论据"
	}
	return note
}

func minFloat(a, b float64) float64 {
	if a < b {
		return a
	}
	return b
}

func maxFloat(a, b float64) float64 {
	if a > b {
		return a
	}
	return b
}

func judgeModeScore(mode DebateMode, round int, content string) float64 {
	switch mode {
	case DebateModeSerious:
		return keywordScore(content, []string{"风险", "成本", "条件", "验证", "方案", "概率", "代价"}, 1.8)
	case DebateModeFunny:
		return keywordScore(content, []string{"笑话", "热闹", "上头", "演", "翻车", "节目效果"}, 1.4)
	case DebateModeSharp:
		return keywordScore(content, []string{"漏洞", "骗", "别装", "拆", "不服", "说穿"}, 1.9)
	case DebateModeWild:
		return keywordScore(content, []string{"副本", "开麦", "起飞", "爆", "翻桌", "冲"}, 1.5)
	case DebateModeWorkplace:
		return keywordScore(content, []string{"推进", "复盘", "风险", "协同", "节奏", "交付"}, 1.8)
	case DebateModeEmotion:
		return keywordScore(content, []string{"情绪", "安心", "害怕", "喜欢", "疲惫", "感受"}, 1.7)
	default:
		return 0
	}
}

func judgeModeFocus(mode DebateMode) string {
	switch mode {
	case DebateModeSerious:
		return " 当前是严肃理性风，裁判会更偏好成本、风险、条件和落地性。"
	case DebateModeFunny:
		return " 当前是整活模式，裁判会奖励有梗但不失真的表达。"
	case DebateModeSharp:
		return " 当前是锋芒对线，裁判会更看重拆解是否够准够狠。"
	case DebateModeWild:
		return " 当前是脑洞失控，裁判会接受更夸张的表达，但仍要求结论站得住。"
	case DebateModeWorkplace:
		return " 当前是职场会诊，裁判会更看重推进思路、复盘和协作判断。"
	case DebateModeEmotion:
		return " 当前是情绪会诊，裁判会更看重对情绪的承接和自我识别。"
	default:
		return ""
	}
}
