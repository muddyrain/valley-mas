package ai

import (
	"encoding/json"
	"fmt"
	"strings"
	"unicode/utf8"
	"valley-server/internal/mindarena"
)

const (
	maxDebateMessageRunes       = 88
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

type audienceSupportContext struct {
	PreviousRound           int    `json:"previousRound"`
	SupportedPersonaID      string `json:"supportedPersonaId,omitempty"`
	SupportedPersonaName    string `json:"supportedPersonaName,omitempty"`
	Skipped                 bool   `json:"skipped"`
	CurrentPersonaSupported bool   `json:"currentPersonaSupported,omitempty"`
	ResponseGoal            string `json:"responseGoal"`
	AudienceSignal          string `json:"audienceSignal"`
}

func normalizeGeneratedDebateMessages(generated []mindarena.DebateMessage, personas []mindarena.Persona, round int) []mindarena.DebateMessage {
	if len(personas) == 0 {
		return nil
	}

	used := make(map[int]bool, len(generated))
	usedContents := make(map[string]bool, len(personas))
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
		if shouldFallbackToTemplate(content, persona, round, usedContents) {
			content = fallbackDebateMessageContent(persona, round)
		}
		content = truncateRunes(content, maxDebateMessageRunes)
		usedContents[normalizeDebateMessageSignature(content)] = true

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
		return "先别被一时上头推着跑，这题先把风险、现金流、成功概率和退路一项项算清再谈值不值得。"
	case "毒舌派":
		return "我先拆台，这更像你受够了当前生活想立刻逃跑，不像真把代价和后果都想明白后的选择。"
	case "赌徒派":
		return "机会摆在眼前还一直捂着口袋，你不是稳，是把可能改命的窗口亲手拖到自动关闭。"
	case "父母派":
		return "先把房租、社保、存款和家里怎么交代算明白，别今天讲理想，明天就开始为现实补窟窿。"
	case "摆烂派":
		return "你现在像在情绪高压里替人生拍板，我建议先把脑子降温，不然今天的决心明天大概率自己打脸。"
	default:
		return truncateRunes(persona.Stance, maxRoundOneFallbackRuneSize)
	}
}

func fallbackRoundTwoMessage(persona mindarena.Persona) string {
	switch persona.Name {
	case "理性派":
		return "赌徒派别把热血当答案，你只负责喊冲，可一旦现金流断掉、试错成本爆表，收残局的人不是你。"
	case "毒舌派":
		return "理性派表格做得再漂亮，也别把害怕失败包装成稳健，你那套很多时候只是高级版不敢动。"
	case "赌徒派":
		return "父母派什么都想先保全，可机会不会等你把流程、批注和顾虑全部盖章完才开始倒计时。"
	case "父母派":
		return "毒舌派只会点火制造爽感，真等你没收入、没安全垫的时候，替你扛账单的还是现实，不是段子。"
	case "摆烂派":
		return "你们都急着抢话筒赢辩论，我只想提醒一句，人先被焦虑榨干了，再漂亮的决定最后也会执行变形。"
	default:
		return truncateRunes(persona.Stance, maxDebateMessageRunes)
	}
}

func fallbackRoundThreeMessage(persona mindarena.Persona) string {
	switch persona.Name {
	case "理性派":
		return "我的结论很简单：先用副业或低成本试水验证市场，跑出真实反馈后，再决定值不值得正式离场。"
	case "毒舌派":
		return "真要冲就别拿热爱演自己，先证明你不是为了逃离当下才想换赛道，不然表白和辞职都像冲动补偿。"
	case "赌徒派":
		return "给自己定清楚启动日、投入上限和止损线，别把野心一直预热到最后只剩嘴上热闹。"
	case "父母派":
		return "先备够安全垫、Plan B 和最坏情况下的生活方案，再出发才叫负责，不是把家底拿去赌气。"
	case "摆烂派":
		return "先睡够、先把人恢复正常，再用清醒脑子决定要不要翻桌重来，不然你只是在让疲惫替你做决定。"
	default:
		return truncateRunes(persona.Stance, maxDebateMessageRunes)
	}
}

func buildDebateRoundPromptInput(topic string, mode string, personas []mindarena.Persona, round int, history []mindarena.DebateMessage, supportHistory []mindarena.RoundSupportChoice) string {
	payload := struct {
		Topic                 string                         `json:"topic"`
		Mode                  string                         `json:"mode"`
		ModeGuide             string                         `json:"modeGuide"`
		Round                 int                            `json:"round"`
		RoundGoal             string                         `json:"roundGoal"`
		Constraints           []string                       `json:"constraints"`
		VoiceHints            []personaVoiceHint             `json:"personaVoiceHints"`
		LatestAudienceSupport *audienceSupportContext        `json:"latestAudienceSupport,omitempty"`
		SupportHistory        []mindarena.RoundSupportChoice `json:"supportHistory,omitempty"`
		Rebuttals             []roundTwoRebuttalTarget       `json:"rebuttalTargets,omitempty"`
		Summaries             []roundThreeSummaryBrief       `json:"summaryBriefs,omitempty"`
		Personas              []mindarena.Persona            `json:"personas"`
		History               []mindarena.DebateMessage      `json:"history"`
	}{
		Topic:                 topic,
		Mode:                  mode,
		ModeGuide:             modeStyleGuide(mode),
		Round:                 round,
		RoundGoal:             debateRoundGoal(round),
		Constraints:           debateRoundConstraints(round),
		VoiceHints:            buildPersonaVoiceHints(personas),
		LatestAudienceSupport: buildAudienceSupportContext(round, mindarena.Persona{}, supportHistory),
		SupportHistory:        supportHistory,
		Rebuttals:             buildRoundTwoRebuttalTargets(round, personas, history),
		Summaries:             buildRoundThreeSummaryBriefs(round, personas, history),
		Personas:              personas,
		History:               history,
	}
	raw, _ := jsonMarshal(payload)
	return raw
}

func buildDebateMessagePromptInput(topic string, mode string, personas []mindarena.Persona, persona mindarena.Persona, round int, history []mindarena.DebateMessage, supportHistory []mindarena.RoundSupportChoice) string {
	personaIndex := findPersonaIndex(persona, personas)
	payload := struct {
		Topic                 string                         `json:"topic"`
		Mode                  string                         `json:"mode"`
		ModeGuide             string                         `json:"modeGuide"`
		Round                 int                            `json:"round"`
		RoundGoal             string                         `json:"roundGoal"`
		Constraints           []string                       `json:"constraints"`
		CurrentPersona        mindarena.Persona              `json:"currentPersona"`
		CurrentVoice          string                         `json:"currentPersonaVoice"`
		LatestAudienceSupport *audienceSupportContext        `json:"latestAudienceSupport,omitempty"`
		SupportHistory        []mindarena.RoundSupportChoice `json:"supportHistory,omitempty"`
		RebuttalTarget        *roundTwoRebuttalTarget        `json:"rebuttalTarget,omitempty"`
		SummaryBrief          *roundThreeSummaryBrief        `json:"summaryBrief,omitempty"`
		Personas              []mindarena.Persona            `json:"personas"`
		History               []mindarena.DebateMessage      `json:"history"`
	}{
		Topic:                 topic,
		Mode:                  mode,
		ModeGuide:             modeStyleGuide(mode),
		Round:                 round,
		RoundGoal:             debateRoundGoal(round),
		Constraints:           append(debateRoundConstraints(round), "只输出 currentPersona 的一条 messages JSON。"),
		CurrentPersona:        persona,
		CurrentVoice:          personaVoiceGuide(persona),
		LatestAudienceSupport: buildAudienceSupportContext(round, persona, supportHistory),
		SupportHistory:        supportHistory,
		RebuttalTarget:        buildSingleRoundTwoRebuttalTarget(round, persona, personaIndex, personas, history),
		SummaryBrief:          buildSingleRoundThreeSummaryBrief(round, persona, history),
		Personas:              personas,
		History:               history,
	}
	raw, _ := jsonMarshal(payload)
	return raw
}

func buildAudienceSupportContext(round int, persona mindarena.Persona, supportHistory []mindarena.RoundSupportChoice) *audienceSupportContext {
	if round <= 1 {
		return nil
	}
	latest := findLatestSupportChoice(round-1, supportHistory)
	if latest == nil {
		return nil
	}

	context := &audienceSupportContext{
		PreviousRound:        latest.Round,
		SupportedPersonaID:   latest.PersonaID,
		SupportedPersonaName: latest.PersonaName,
		Skipped:              latest.Skipped,
	}
	if latest.Skipped {
		context.ResponseGoal = "上一轮用户没有明确站队，这一轮也要继续争取他，但别把注意力拉离议题。"
		context.AudienceSignal = "用户上一轮跳过站队，说明所有人格都还有争宠空间。"
		return context
	}

	if persona.ID != "" && (persona.ID == latest.PersonaID || persona.Name == latest.PersonaName) {
		context.CurrentPersonaSupported = true
		context.ResponseGoal = fmt.Sprintf("用户上一轮支持了你（%s），这一轮要稳住好感、继续给出更强论据。", latest.PersonaName)
		context.AudienceSignal = fmt.Sprintf("用户上一轮明显偏向 %s。", latest.PersonaName)
		return context
	}

	context.ResponseGoal = fmt.Sprintf("用户上一轮支持了 %s，这一轮你要正面回应这股偏好，争宠、拉票或表示不服。", latest.PersonaName)
	context.AudienceSignal = fmt.Sprintf("用户上一轮更支持 %s。", latest.PersonaName)
	return context
}

func findLatestSupportChoice(round int, supportHistory []mindarena.RoundSupportChoice) *mindarena.RoundSupportChoice {
	for i := len(supportHistory) - 1; i >= 0; i-- {
		if supportHistory[i].Round == round {
			choice := supportHistory[i]
			return &choice
		}
	}
	return nil
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
	return fmt.Sprintf("人格气质：%s；表达方式：%s；出场口号：%s。后续发言只借这个口号的气质，不要机械复读原句。", persona.Personality, persona.Style, persona.Catchphrase)
}

func debateRoundGoal(round int) string {
	switch round {
	case 1:
		return "开场亮立场：每个人格先亮明自己的倾向和核心理由。"
	case 2:
		return "交锋与结盟：根据 history、rebuttalTargets 和 latestAudienceSupport，可以拆别人的漏洞，也可以承认别人某一点说得对，再把优势拉回自己这边。"
	case 3:
		return "最终陈词：根据 history、summaryBriefs 和 latestAudienceSupport，把前两轮冲突收束成最后建议并做最后拉票。"
	default:
		return "加时对决：只剩下领先并列的人格继续抢胜，发言要更直接、更有压迫感，也更像最后拍板。"
	}
}

func debateRoundConstraints(round int) []string {
	base := []string{
		"每个人格只说一句完整的话。",
		"每句话目标 35 到 70 个中文字符，必要时可放宽到 88 个中文字符；不要只说 10 到 20 个字敷衍了事。",
		"必须让人一眼听出人格的 personality 和 style，但 catchphrase 只是出场口号，后续发言不要机械复读原句。",
		"每句话都要带出具体理由、判断、条件、代价或反击点，不能只喊情绪口号。",
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
			"Round 2 必须回应别人的观点，不能重复 Round 1 原话。",
			"优先使用 rebuttalTargets 中对应自己的一条目标，明确回应 targetPersonaName 的 Round 1 观点。",
			"如果 latestAudienceSupport 不为空，必须回应用户上一轮支持了谁，表现出争宠、拉票或不服气。",
			"允许两种打法：1）直接拆对方漏洞；2）先承认对方某一点说得对，再顺势把优势拉回自己这边。",
			"每句都必须形成关系：要么明确反驳，要么明确赞同一部分再转向自己的结论。",
			"不要五个人都说成一个腔调，每句都要体现当前人格的独特脾气和攻击方式。",
			"反驳要直接，但火力只能对观点，不能辱骂用户。",
			"可以犀利，但不要辱骂用户。",
		)
	case 3:
		return append(base,
			"Round 3 要收束，不要再展开新论点。",
			"必须参考 summaryBriefs 中自己的 openingContent、rebuttalContent 和 adviceFocus。",
			"如果 latestAudienceSupport 不为空，要知道用户上一轮支持了谁，并在收尾里争取最终认同。",
			"每句话要给出明确建议或决策条件，不能只喊口号。",
			"收尾必须像真人在拍板，不要把口号再换一种说法复读一遍。",
			"不要宣布最终胜者，裁判结果由下一步 judge 单独生成。",
			"像综艺最后发言，态度明确、节奏利落，而且要给出能执行的收尾动作。",
		)
	default:
		return append(base,
			"当前已经进入加时赛，只有并列领先的人格继续正面对决。",
			"加时赛里的句子要比前面三轮更硬、更准，必须推进胜负，不能再绕圈子。",
			"如果 latestAudienceSupport 不为空，要知道用户上一轮更支持谁，并在这一轮继续抢最后一票。",
			"不要复述前面的话，要补新证据、新条件或新的压制点。",
		)
	}
}

func truncateRunes(value string, limit int) string {
	if limit <= 0 || utf8.RuneCountInString(value) <= limit {
		return value
	}
	runes := []rune(value)
	return strings.TrimSpace(string(runes[:limit]))
}

func modeStyleGuide(mode string) string {
	switch strings.TrimSpace(mode) {
	case "serious":
		return "严肃理性风：更看重因果、成本、风险边界和执行条件，少玩梗。"
	case "funny":
		return "有梗不失真风：允许更有包袱和节目效果，但每句话仍要有明确判断。"
	case "sharp":
		return "锋利对线风：拆观点要更狠、更准、更直接，但不能变成无意义辱骂。"
	case "wild":
		return "脑洞放飞风：比喻和画面可以更夸张，但结论仍要落回现实选择。"
	case "workplace":
		return "职场会诊风：像会议室攻防，要多用推进、协作、风险复盘这类表达。"
	case "emotion":
		return "情绪会诊风：先承接情绪，再给判断，允许更有共情，但不能失去结论。"
	default:
		return "保持综艺辩论感，但一定围绕用户议题做真实判断。"
	}
}

func shouldFallbackToTemplate(content string, persona mindarena.Persona, round int, usedContents map[string]bool) bool {
	if strings.TrimSpace(content) == "" {
		return true
	}

	if utf8.RuneCountInString(content) < minimumDebateMessageRunes(round) {
		return true
	}

	signature := normalizeDebateMessageSignature(content)
	if signature == "" {
		return true
	}
	if usedContents[signature] {
		return true
	}

	catchphrase := normalizeDebateMessageSignature(persona.Catchphrase)
	if catchphrase != "" && strings.Contains(signature, catchphrase) {
		remaining := strings.Replace(signature, catchphrase, "", 1)
		if utf8.RuneCountInString(remaining) < 18 {
			return true
		}
	}

	return false
}

func normalizeDebateMessageSignature(content string) string {
	replacer := strings.NewReplacer("，", "", "。", "", "！", "", "？", "", "、", "", ",", "", ".", "", "!", "", "?", "", "：", "", "；", "", "“", "", "”", "", "\"", "", "'", "", " ", "")
	return replacer.Replace(strings.TrimSpace(content))
}

func minimumDebateMessageRunes(round int) int {
	switch round {
	case 1:
		return 26
	case 2:
		return 28
	case 3:
		return 30
	default:
		return 24
	}
}

func jsonMarshal(v any) (string, error) {
	raw, err := json.Marshal(v)
	if err != nil {
		return "", err
	}
	return string(raw), nil
}
