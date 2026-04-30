package ai

import (
	"context"
	"fmt"
	"time"
	"valley-server/internal/mindarena"
)

type MockAIService struct{}

func NewMockAIService() *MockAIService {
	return &MockAIService{}
}

func (s *MockAIService) GeneratePersonas(ctx context.Context, topic string, mode string, count int) ([]mindarena.Persona, error) {
	select {
	case <-ctx.Done():
		return nil, ctx.Err()
	default:
	}

	personas := defaultMindArenaPersonas()
	if count > len(personas) {
		count = len(personas)
	}
	personas = append([]mindarena.Persona(nil), personas[:count]...)
	return personas, nil
}

func (s *MockAIService) GeneratePersona(ctx context.Context, topic string, mode string, persona mindarena.Persona, index int, count int) (*mindarena.Persona, error) {
	select {
	case <-ctx.Done():
		return nil, ctx.Err()
	default:
	}

	return &persona, nil
}

func (s *MockAIService) GenerateDebateRound(ctx context.Context, topic string, mode string, personas []mindarena.Persona, round int, history []mindarena.DebateMessage, supportHistory []mindarena.RoundSupportChoice) ([]mindarena.DebateMessage, error) {
	select {
	case <-ctx.Done():
		return nil, ctx.Err()
	default:
	}

	lines := map[int][]string{
		1: {
			"我先亮牌，所有决定都得先把风险、现金流和退路算清。",
			"我先拆台，这更像情绪出逃，不像深思熟虑后的理想召唤。",
			"我支持先冲一次，机会错过了可不会排队等你回头。",
			"我先站稳字当头，房租社保没想明白就别急着表演潇洒。",
			"我建议先缓一口气，你现在像在情绪高压下替人生签字。",
		},
		2: {
			"赌徒派别只喊冲，风险不是背景音乐，断粮了谁来接盘。",
			"理性派也别把人生算成 Excel，你那套稳法有时只是怂。",
			"父母派老想先保全一切，可机会不会等你批完整套流程。",
			"毒舌派只会点火不管后果，真扛账单的人可不是你。",
			"你们都想赢辩论，我只想提醒别把自己先吵到报废。",
		},
		3: {
			"我支持先做副业验证，再决定要不要正式离场。",
			"真要冲就别演热爱，先证明你不是想逃离眼下生活。",
			"给自己定启动日和止损线，别把野心拖成长期预热。",
			"存够安全垫和 Plan B，再把计划摊到桌上谈执行。",
			"结论：先睡够，先复原，再用清醒脑子决定翻不翻桌。",
		},
	}

	if mode == "sharp" {
		lines[1][1] = "别把逃避包装成远大理想，观众和你的银行卡都看见了。"
		lines[2][4] = "醒醒，离职邮件不是许愿池，发出去也不会自动兑奖。"
	}
	if mode == "wild" {
		lines[1][2] = "开麦！人生副本不点开始，装备和隐藏剧情都不会自己掉落。"
		lines[3][4] = "先躺平十分钟回血，再垂直起飞狠狠干一票。"
	}

	messages := make([]mindarena.DebateMessage, 0, len(personas))
	for i, persona := range personas {
		content := truncateRunes(mockDebateLine(lines, round, i, persona, supportHistory), maxDebateMessageRunes)
		messages = append(messages, mindarena.DebateMessage{
			ID:          fmt.Sprintf("mock_%d_%d_%d", round, i+1, time.Now().UnixNano()),
			Round:       round,
			RoundTitle:  roundTitle(round),
			PersonaID:   persona.ID,
			PersonaName: persona.Name,
			Content:     content,
			CreatedAt:   time.Now().Format(time.RFC3339),
		})
	}
	return messages, nil
}

func (s *MockAIService) GenerateDebateMessage(ctx context.Context, topic string, mode string, personas []mindarena.Persona, persona mindarena.Persona, round int, history []mindarena.DebateMessage, supportHistory []mindarena.RoundSupportChoice) (*mindarena.DebateMessage, error) {
	messages, err := s.GenerateDebateRound(ctx, topic, mode, personas, round, history, supportHistory)
	if err != nil {
		return nil, err
	}
	for i := range messages {
		if messages[i].PersonaID == persona.ID || messages[i].PersonaName == persona.Name {
			return &messages[i], nil
		}
	}
	return &mindarena.DebateMessage{
		ID:          fmt.Sprintf("mock_%d_%s_%d", round, persona.ID, time.Now().UnixNano()),
		Round:       round,
		RoundTitle:  roundTitle(round),
		PersonaID:   persona.ID,
		PersonaName: persona.Name,
		Content:     fallbackDebateMessageContent(persona, round),
		CreatedAt:   time.Now().Format(time.RFC3339),
	}, nil
}

func mockDebateLine(lines map[int][]string, round int, personaIndex int, persona mindarena.Persona, supportHistory []mindarena.RoundSupportChoice) string {
	if line := audienceSupportMockLine(round, persona, supportHistory); line != "" {
		return line
	}
	roundLines := lines[round]
	if len(roundLines) == 0 {
		return ""
	}
	return roundLines[personaIndex%len(roundLines)]
}

func audienceSupportMockLine(round int, persona mindarena.Persona, supportHistory []mindarena.RoundSupportChoice) string {
	latest := latestSupportChoiceForRound(round, supportHistory)
	if latest == nil || latest.Skipped || latest.PersonaName == "" {
		return ""
	}
	if persona.ID == latest.PersonaID || persona.Name == latest.PersonaName {
		if round == 2 {
			return fmt.Sprintf("上一轮你都站我了，那我继续说透：%s这次别被别人的噪音带跑。", persona.Name)
		}
		return fmt.Sprintf("你前一轮已经押我，这一轮我给你落地版：%s别只听热闹，照我这套执行。", persona.Name)
	}
	if round == 2 {
		return fmt.Sprintf("你上一轮站%s？我不服，这恰好说明你还没听懂我的关键牌。", latest.PersonaName)
	}
	return fmt.Sprintf("你前一轮偏向%s没关系，我最后再拉你一把，听完再定输赢。", latest.PersonaName)
}

func latestSupportChoiceForRound(round int, supportHistory []mindarena.RoundSupportChoice) *mindarena.RoundSupportChoice {
	targetRound := round - 1
	if targetRound < 1 {
		return nil
	}
	for i := len(supportHistory) - 1; i >= 0; i-- {
		if supportHistory[i].Round == targetRound {
			choice := supportHistory[i]
			return &choice
		}
	}
	return nil
}

func (s *MockAIService) JudgeDebate(ctx context.Context, topic string, personas []mindarena.Persona, messages []mindarena.DebateMessage) (*mindarena.DebateResult, error) {
	select {
	case <-ctx.Done():
		return nil, ctx.Err()
	default:
	}

	scores := make([]mindarena.DebateScore, 0, len(personas))
	base := []int{88, 76, 72, 83, 69}
	for i, persona := range personas {
		scores = append(scores, mindarena.DebateScore{
			Persona: persona.Name,
			Score:   base[i%len(base)],
		})
	}
	return &mindarena.DebateResult{
		Winner:      "理性派",
		FinalAdvice: "可以试，但别拿冲动替代计划。先验证、再加码，别让热血直接签合同。",
		Quote:       "你不是没想法，你是还没算完代价。",
		Scores:      scores,
	}, nil
}

func roundTitle(round int) string {
	switch round {
	case 1:
		return "立场表达"
	case 2:
		return "互相反驳"
	case 3:
		return "最终陈词"
	default:
		return "加时讨论"
	}
}
