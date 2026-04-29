package ai

import (
	"context"
	"fmt"
	"strings"
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

	templates := []mindarena.Persona{
		{ID: "p1", Name: "理性派", Stance: "谨慎支持", Personality: "冷静、风险意识强", Style: "短句、数据化、理性分析", Catchphrase: "先算账，再谈梦想", Avatar: "👨‍💼", Color: "blue"},
		{ID: "p2", Name: "毒舌派", Stance: "强烈反对冲动决策", Personality: "嘴快、直球、拆幻想", Style: "犀利吐槽但不伤人", Catchphrase: "你不是勇敢，你是上头", Avatar: "😼", Color: "violet"},
		{ID: "p3", Name: "赌徒派", Stance: "支持大胆试一把", Personality: "冒险、热血、怕错过", Style: "节奏快、像现场煽风", Catchphrase: "人生不冲一次等于白来", Avatar: "🦸", Color: "red"},
		{ID: "p4", Name: "父母派", Stance: "先稳住基本盘", Personality: "保守、关心、爱问细节", Style: "生活化、连续追问", Catchphrase: "稳定才是第一生产力", Avatar: "👵", Color: "green"},
		{ID: "p5", Name: "摆烂派", Stance: "建议先休息再决定", Personality: "松弛、逃避、但偶尔清醒", Style: "懒洋洋、金句型", Catchphrase: "先睡一觉，明天再燃", Avatar: "😴", Color: "yellow"},
		{ID: "p6", Name: "情绪派", Stance: "先承认真实感受", Personality: "敏感、共情、会照顾人", Style: "温柔但会补刀", Catchphrase: "情绪不是答案，但它是线索", Avatar: "💗", Color: "pink"},
	}

	if count > len(templates) {
		count = len(templates)
	}
	personas := append([]mindarena.Persona(nil), templates[:count]...)
	if strings.Contains(mode, "workplace") || strings.Contains(topic, "工作") {
		personas[0].Stance = "建议先设计过渡方案"
	}
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
			"先把现金流、退路和试错周期列出来。",
			"听起来像梦想，其实可能只是讨厌周一。",
			"机会不会等你写完表格，先抢一个窗口。",
			"你有多少存款？能撑几个月？家里同意吗？",
			"先休息两天，别用辞职治疗疲惫。",
			"你真正想逃离的点，得先说清楚。",
		},
		2: {
			"赌徒派别只喊冲，风险不是背景音乐。",
			"理性派也别把人生算成 Excel 呀。",
			"市场早就开跑，犹豫才最贵。",
			"冲可以，但别拿房租当节目道具。",
			"你们吵这么热血，明早谁起床上班？",
			"如果只是被消耗，换环境比裸辞更稳。",
		},
		3: {
			"我支持准备创业，但反对裸辞。",
			"先做副业验证，别让热血替你签字。",
			"给自己一个倒计时，别无限准备。",
			"存够安全垫，再把计划摊到桌上。",
			"结论：先睡觉，再做表，再行动。",
			"你的感受是真的，方案也要是真的。",
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
	base := []int{88, 76, 72, 83, 69, 78}
	for i, persona := range personas {
		scores = append(scores, mindarena.DebateScore{
			Persona: persona.Name,
			Score:   base[i%len(base)],
		})
	}
	return &mindarena.DebateResult{
		Winner:      "理性派",
		FinalAdvice: "可以准备创业，但不建议裸辞。先用副业验证需求，存够安全垫，再给自己一个明确启动日。",
		Quote:       "你不是想创业，你只是想逃离周一。",
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
