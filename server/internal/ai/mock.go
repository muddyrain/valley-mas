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
			"我先亮牌，所有决定都得先把风险、现金流、回本周期和最坏退路算清，再谈值不值得冲。",
			"我先拆台，这更像你受够了眼下想逃跑，不像真把代价、后果和持续性都想明白后的热爱。",
			"我支持先冲一次，机会错过了可不会排队等你回头，犹豫太久往往比试错本身更伤人。",
			"我先把稳字摆上桌，房租社保、家里交代和基本盘没想明白，就别急着演潇洒离场。",
			"我建议先缓一口气，你现在像在情绪高压里替人生签字，这种状态下的豪言最容易隔天后悔。",
		},
		2: {
			"父母派有一点说得对，现实账本确实不能装瞎，但光会防守也没用，关键还是要把风险算完后敢不敢动。",
			"我承认理性派至少还在算代价，可你别把表格当护身符，很多拖延就是披着稳健外衣的不敢动。",
			"毒舌派那句别自我感动我认，可老是拆不肯动也没结果，机会不会等你把犹豫全部聊清再开门。",
			"理性派和毒舌派都说到一点，可真正能扛后果的是生活本身，没退路准备好之前别急着拿人生碰运气。",
			"父母派稳是稳，可一直稳到没电也会错过；赌徒派冲是冲，可上头时连自己在逃什么都没看清。",
		},
		3: {
			"我支持先做副业验证，再决定要不要正式离场，让现实反馈替你筛掉幻想，而不是靠脑补下注。",
			"真要冲就别演热爱，先证明你不是想逃离眼下生活，不然表白和转身都会变成冲动续命。",
			"给自己定启动日、投入上限和止损线，别把野心一直拖成长期预热，最后只剩嘴上很敢。",
			"存够安全垫和 Plan B，再把计划摊到桌上谈执行，这叫负责，不叫保守，更不是替自己设限。",
			"结论：先睡够，先复原，再用清醒脑子决定翻不翻桌，不然你只是让疲惫代替你发号施令。",
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
			switch persona.Name {
			case "理性派":
				return "上一轮你已经站我了，那我就把话说得更实一点：别被热闹带跑，先看风险、成本和你能不能扛住后果。"
			case "毒舌派":
				return "上一轮你都站我了，我就继续戳穿到底：别把一时热血误认成真命题，先证明你不是在拿冲动作止痛药。"
			case "赌徒派":
				return "上一轮你敢站我，说明你也知道人生不能只靠防守，这一轮我就问一句，你真想把机会再让给更敢动的人吗。"
			case "父母派":
				return "上一轮你支持我，我就继续把现实账本摊开说：先稳住基本盘，不然再浪漫的决定都会被生活反噬。"
			case "摆烂派":
				return "上一轮你站我，说明你也感觉自己快被吵炸了，这一轮先别急着表态英勇，先把状态救回来再说。"
			}
			return fmt.Sprintf("上一轮你都站我了，那我继续说透：%s这次别被别人的噪音带跑。", persona.Name)
		}
		switch persona.Name {
		case "理性派":
			return "你前一轮已经押我，那我给你落地版：先做低成本验证，设退出线和观察期，再决定要不要真的跨出去。"
		case "毒舌派":
			return "你前一轮已经押我，那我最后再说狠一点：先确认你追的是人还是情绪，别把表白搞成自我感动发布会。"
		case "赌徒派":
			return "你前一轮已经押我，那就别只停在心动，给自己一个明确行动窗口和止损线，冲得漂亮比空想更重要。"
		case "父母派":
			return "你前一轮已经押我，那我最后帮你收束成一句：先稳住生活秩序和退路，再决定要不要把心意摆上桌。"
		case "摆烂派":
			return "你前一轮已经押我，那我给你最后建议：先让自己恢复正常，再做决定，清醒之后还想冲才是真的想冲。"
		}
		return fmt.Sprintf("你前一轮已经押我，这一轮我给你落地版：%s别只听热闹，照我这套执行。", persona.Name)
	}
	if round == 2 {
		switch persona.Name {
		case "理性派":
			return fmt.Sprintf("你上一轮站%s？我不服，因为你现在看到的是爽点，不是后果；我的问题是，代价谁来扛。", latest.PersonaName)
		case "毒舌派":
			return fmt.Sprintf("你上一轮站%s？行，但我得提醒你，那更像被气氛带跑了，还没真正戳到问题核心。", latest.PersonaName)
		case "赌徒派":
			return fmt.Sprintf("你上一轮站%s？那只能说明你还差最后一点胆量，我就问你，机会真来了你还想继续观望多久。", latest.PersonaName)
		case "父母派":
			return fmt.Sprintf("你上一轮站%s？我理解，但真到后面收残局的时候，现实只认准备，不认一时热血。", latest.PersonaName)
		case "摆烂派":
			return fmt.Sprintf("你上一轮站%s？没事，我只是提醒你，情绪一上来时最容易把别人的声音误听成自己的答案。", latest.PersonaName)
		}
		return fmt.Sprintf("你上一轮站%s？我不服，这恰好说明你还没听懂我的关键牌。", latest.PersonaName)
	}
	switch persona.Name {
	case "理性派":
		return fmt.Sprintf("你前一轮偏向%s没关系，我最后只补一句：让决定落地的不是热闹，而是你能不能承担之后的成本。", latest.PersonaName)
	case "毒舌派":
		return fmt.Sprintf("你前一轮偏向%s我认，但你最后最好先问问自己，是真喜欢，还是只是不想错过一个让你热血上头的瞬间。", latest.PersonaName)
	case "赌徒派":
		return fmt.Sprintf("你前一轮偏向%s没关系，我最后再拉你一把：心动这事拖太久，很多时候就会直接拖成错过。", latest.PersonaName)
	case "父母派":
		return fmt.Sprintf("你前一轮偏向%s也正常，但最后做决定时，别忘了真正陪你过后果的人，是未来每天的生活。", latest.PersonaName)
	case "摆烂派":
		return fmt.Sprintf("你前一轮偏向%s没事，我最后只提醒你一句：别在最疲惫的时候把一时冲动误认成终极答案。", latest.PersonaName)
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
		return "交锋与结盟"
	case 3:
		return "最终陈词"
	default:
		return "加时对决"
	}
}
