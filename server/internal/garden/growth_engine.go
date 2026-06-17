package garden

import (
	"context"
	"strings"
	"time"

	"valley-server/internal/model"
)

// AdvancePlant 是 AdvancePlantAt 的便捷入口，使用 Service.now() 作为当前时间。
func (s *Service) AdvancePlant(ctx context.Context, p *model.Plant) error {
	return s.AdvancePlantAt(ctx, p, s.now())
}

// AdvancePlantAt 在给定时间点 advance 一棵植物：
// 1. 若 status != growing，直接返回 nil
// 2. 当 now >= NextStageAt 且 Stage < StageMax，连续推进阶段，每推进一次写一条 grow 日志
// 3. 推进到 Stage == StageMax 时，状态切换为 mature
// 4. 任何字段变更后通过 store.UpdatePlant 持久化
func (s *Service) AdvancePlantAt(ctx context.Context, p *model.Plant, now time.Time) error {
	if p == nil || p.Status != StatusGrowing {
		return nil
	}
	changed := false
	for p.Stage < p.StageMax && !now.Before(p.NextStageAt) {
		recent, _ := s.store.ListGrowthLogs(ctx, p.ID)
		summary := summarizeRecentLogs(recent, 3)
		var text string
		if s.ai != nil {
			prompt := PromptStageLog(p.Name, p.Mood, p.WaterStyle, p.Stage+1, p.StageMax, summary)
			out, err := s.ai.GenerateText(ctx, prompt)
			if err != nil || strings.TrimSpace(out) == "" {
				text = "今天我又长了一点点。"
			} else {
				text = strings.TrimSpace(out)
			}
		} else {
			text = "今天我又长了一点点。"
		}
		p.Stage++
		p.NextStageAt = p.NextStageAt.Add(stageInterval(p.Rarity))
		_ = s.store.AppendGrowthLog(ctx, &model.GrowthLog{
			PlantID: p.ID,
			Stage:   p.Stage,
			Type:    LogTypeGrow,
			Content: text,
		})
		changed = true
	}
	if p.Stage >= p.StageMax && p.Status == StatusGrowing {
		p.Status = StatusMature
		var zero time.Time
		p.NextStageAt = zero
		changed = true
	}
	if changed {
		return s.store.UpdatePlant(ctx, p)
	}
	return nil
}

// summarizeRecentLogs 取最近 n 条日志的内容拼接为多行字符串。
func summarizeRecentLogs(logs []model.GrowthLog, n int) string {
	if len(logs) == 0 {
		return "（暂无日志）"
	}
	start := len(logs) - n
	if start < 0 {
		start = 0
	}
	parts := make([]string, 0, len(logs)-start)
	for _, l := range logs[start:] {
		parts = append(parts, "- "+l.Content)
	}
	return strings.Join(parts, "\n")
}
