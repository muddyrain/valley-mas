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

func (s *MockAIService) GenerateDebateRound(ctx context.Context, topic string, mode string, personas []mindarena.Persona, round int, history []mindarena.DebateMessage) ([]mindarena.DebateMessage, error) {
	select {
	case <-ctx.Done():
		return nil, ctx.Err()
	default:
	}

	lines := map[int][]string{
		1: {
			"我先亮牌，所有决定都得先把风险和回报算清。",
			"我先泼冷水，别把一时上头误认成命运召唤。",
			"我支持先冲一次，机会错过了可不会排队重来。",
			"我先站稳字当头，基本盘没护住就别急着变。",
			"我建议先缓一口气，别在崩溃时替人生签字。",
		},
		2: {
			"赌徒派别只喊冲，风险不是背景音乐。",
			"理性派也别把人生算成 Excel 呀。",
			"市场早就开跑，犹豫才最贵。",
			"冲可以，但别拿房租当节目道具。",
			"你们吵这么热血，明早谁起床上班？",
		},
		3: {
			"我支持准备创业，但反对裸辞。",
			"先做副业验证，别让热血替你签字。",
			"给自己一个倒计时，别无限准备。",
			"存够安全垫，再把计划摊到桌上。",
			"结论：先睡觉，再做表，再行动。",
		},
	}

	if mode == "sharp" {
		lines[1][1] = "别把逃避包装成远大理想，观众都看见了。"
		lines[2][4] = "醒醒，离职邮件不是许愿池。"
	}
	if mode == "wild" {
		lines[1][2] = "开麦！人生副本不点开始怎么掉装备？"
		lines[3][4] = "先躺平十分钟，再垂直起飞。"
	}

	messages := make([]mindarena.DebateMessage, 0, len(personas))
	for i, persona := range personas {
		content := lines[round][i%len(lines[round])]
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
