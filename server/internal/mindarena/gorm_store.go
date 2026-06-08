package mindarena

import (
	"encoding/json"
	"errors"
	"time"
	"valley-server/internal/model"

	"gorm.io/gorm"
)

type GormStore struct {
	db *gorm.DB
}

func NewGormStore(db *gorm.DB) *GormStore {
	return &GormStore{db: db}
}

func (s *GormStore) Create(session *DebateSession) error {
	copied := cloneSession(session)
	rebuildLiveScoreState(copied)
	return s.saveSession(copied, false)
}

func (s *GormStore) Get(id string) (*DebateSession, error) {
	return s.loadSession(id)
}

func (s *GormStore) Update(session *DebateSession) error {
	copied := cloneSession(session)
	copied.UpdatedAt = nowString()
	return s.saveSession(copied, true)
}

func (s *GormStore) UpdatePersonas(id string, personas []Persona) (*DebateSession, error) {
	session, err := s.loadSession(id)
	if err != nil {
		return nil, err
	}
	session.Personas = append([]Persona(nil), personas...)
	rebuildLiveScoreState(session)
	session.UpdatedAt = nowString()
	return session, s.saveSession(session, true)
}

func (s *GormStore) TryStartStreaming(id string) (*DebateSession, bool, error) {
	session, err := s.loadSession(id)
	if err != nil {
		return nil, false, err
	}
	if session.Status == DebateStatusDone || session.Status == DebateStatusFailed {
		return session, false, nil
	}
	if session.AwaitingSupport || session.StreamActive {
		return session, false, nil
	}
	if session.Status == DebateStatusCreated {
		session.Status = DebateStatusRunning
	}
	if session.CurrentRound <= 0 {
		session.CurrentRound = 1
	}
	session.StreamActive = true
	session.UpdatedAt = nowString()
	return session, true, s.saveSession(session, true)
}

func (s *GormStore) FinishStreaming(id string) (*DebateSession, error) {
	session, err := s.loadSession(id)
	if err != nil {
		return nil, err
	}
	session.StreamActive = false
	session.UpdatedAt = nowString()
	return session, s.saveSession(session, true)
}

func (s *GormStore) AppendMessages(id string, messages []DebateMessage) (*DebateSession, error) {
	session, err := s.loadSession(id)
	if err != nil {
		return nil, err
	}
	session.Messages = append(session.Messages, messages...)
	rebuildLiveScoreState(session)
	session.UpdatedAt = nowString()
	return session, s.saveSession(session, true)
}

func (s *GormStore) PauseAfterRound(id string, round int) (*DebateSession, error) {
	session, err := s.loadSession(id)
	if err != nil {
		return nil, err
	}
	session.LastCompletedRound = round
	session.CurrentRound = round + 1
	session.AwaitingSupport = true
	session.AwaitingSupportRound = round
	session.StreamActive = false
	session.UpdatedAt = nowString()
	return session, s.saveSession(session, true)
}

func (s *GormStore) SetOvertimeParticipants(id string, personaIDs []string, nextRound int) (*DebateSession, error) {
	session, err := s.loadSession(id)
	if err != nil {
		return nil, err
	}
	session.OvertimePersonaIDs = append([]string(nil), personaIDs...)
	if nextRound > session.CurrentRound {
		session.CurrentRound = nextRound
	}
	session.AwaitingSupport = false
	session.AwaitingSupportRound = 0
	session.UpdatedAt = nowString()
	return session, s.saveSession(session, true)
}

func (s *GormStore) SubmitRoundSupport(id string, choice RoundSupportChoice) (*DebateSession, error) {
	session, err := s.loadSession(id)
	if err != nil {
		return nil, err
	}
	replaced := false
	for i := range session.SupportHistory {
		if session.SupportHistory[i].Round == choice.Round {
			session.SupportHistory[i] = choice
			replaced = true
			break
		}
	}
	if !replaced {
		session.SupportHistory = append(session.SupportHistory, choice)
	}
	session.AwaitingSupport = false
	session.AwaitingSupportRound = 0
	if session.CurrentRound <= choice.Round {
		session.CurrentRound = choice.Round + 1
	}
	session.StreamActive = false
	rebuildLiveScoreState(session)
	session.UpdatedAt = nowString()
	return session, s.saveSession(session, true)
}

func (s *GormStore) Complete(id string, result *DebateResult) (*DebateSession, error) {
	session, err := s.loadSession(id)
	if err != nil {
		return nil, err
	}
	session.Result = result
	session.Status = DebateStatusDone
	session.StreamActive = false
	session.AwaitingSupport = false
	session.AwaitingSupportRound = 0
	session.OvertimePersonaIDs = nil
	if len(session.Messages) > 0 {
		session.LastCompletedRound = session.Messages[len(session.Messages)-1].Round
		if session.LastCompletedRound > 0 {
			session.CurrentRound = session.LastCompletedRound
		}
	}
	session.UpdatedAt = nowString()
	return session, s.saveSession(session, true)
}

func (s *GormStore) Fail(id string, message string) (*DebateSession, error) {
	session, err := s.loadSession(id)
	if err != nil {
		return nil, err
	}
	session.Error = message
	session.Status = DebateStatusFailed
	session.StreamActive = false
	session.AwaitingSupport = false
	session.AwaitingSupportRound = 0
	session.OvertimePersonaIDs = nil
	session.UpdatedAt = nowString()
	return session, s.saveSession(session, true)
}

func (s *GormStore) List(page int, pageSize int, keyword string, status string, mode string) ([]DebateSession, int64, error) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}
	query := s.db.Model(&model.MindArenaDebateSession{})
	if keyword != "" {
		query = query.Where("topic LIKE ? OR id LIKE ?", "%"+keyword+"%", "%"+keyword+"%")
	}
	if status != "" {
		query = query.Where("status = ?", status)
	}
	if mode != "" {
		query = query.Where("mode = ?", mode)
	}
	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var rows []model.MindArenaDebateSession
	if err := query.Order("updated_at DESC").Offset((page - 1) * pageSize).Limit(pageSize).Find(&rows).Error; err != nil {
		return nil, 0, err
	}
	list := make([]DebateSession, 0, len(rows))
	for _, row := range rows {
		session := sessionFromRow(row)
		list = append(list, *session)
	}
	return list, total, nil
}

func (s *GormStore) saveSession(session *DebateSession, replace bool) error {
	row := rowFromSession(session)
	return s.db.Transaction(func(tx *gorm.DB) error {
		if replace {
			if err := tx.Save(&row).Error; err != nil {
				return err
			}
		} else if err := tx.Create(&row).Error; err != nil {
			return err
		}
		if err := tx.Unscoped().Where("session_id = ?", session.ID).Delete(&model.MindArenaDebateMessage{}).Error; err != nil {
			return err
		}
		for _, message := range session.Messages {
			if err := tx.Create(messageRow(session.ID, message)).Error; err != nil {
				return err
			}
		}
		if err := tx.Unscoped().Where("session_id = ?", session.ID).Delete(&model.MindArenaDebateScore{}).Error; err != nil {
			return err
		}
		if session.Result != nil {
			for _, score := range session.Result.Scores {
				row := scoreRow(session.ID, score)
				if err := tx.Create(&row).Error; err != nil {
					return err
				}
			}
		}
		return nil
	})
}

func (s *GormStore) loadSession(id string) (*DebateSession, error) {
	var row model.MindArenaDebateSession
	if err := s.db.Where("id = ?", id).First(&row).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrDebateNotFound
		}
		return nil, err
	}
	session := sessionFromRow(row)

	var messages []model.MindArenaDebateMessage
	if err := s.db.Where("session_id = ?", id).Order("round ASC, created_at ASC").Find(&messages).Error; err != nil {
		return nil, err
	}
	session.Messages = make([]DebateMessage, 0, len(messages))
	for _, message := range messages {
		session.Messages = append(session.Messages, messageFromRow(message))
	}
	return session, nil
}

func rowFromSession(session *DebateSession) model.MindArenaDebateSession {
	return model.MindArenaDebateSession{
		ID:                   session.ID,
		Topic:                session.Topic,
		Mode:                 string(session.Mode),
		Status:               string(session.Status),
		PersonaCount:         session.PersonaCount,
		CurrentRound:         session.CurrentRound,
		LastCompletedRound:   session.LastCompletedRound,
		AwaitingSupport:      session.AwaitingSupport,
		AwaitingSupportRound: session.AwaitingSupportRound,
		PersonasJSON:         mustJSON(session.Personas),
		LiveScoresJSON:       mustJSON(session.LiveScores),
		NeutralJudgeJSON:     mustJSON(session.NeutralJudge),
		OvertimePersonaIDs:   mustJSON(session.OvertimePersonaIDs),
		SupportHistoryJSON:   mustJSON(session.SupportHistory),
		ResultJSON:           mustJSON(session.Result),
		Error:                session.Error,
		CreatedAt:            parseTimeOrNow(session.CreatedAt),
		UpdatedAt:            parseTimeOrNow(session.UpdatedAt),
	}
}

func sessionFromRow(row model.MindArenaDebateSession) *DebateSession {
	session := &DebateSession{
		ID:                   row.ID,
		Topic:                row.Topic,
		Mode:                 DebateMode(row.Mode),
		Status:               DebateStatus(row.Status),
		PersonaCount:         row.PersonaCount,
		CurrentRound:         row.CurrentRound,
		LastCompletedRound:   row.LastCompletedRound,
		AwaitingSupport:      row.AwaitingSupport,
		AwaitingSupportRound: row.AwaitingSupportRound,
		Error:                row.Error,
		CreatedAt:            row.CreatedAt.Format(time.RFC3339),
		UpdatedAt:            row.UpdatedAt.Format(time.RFC3339),
	}
	_ = json.Unmarshal([]byte(defaultJSON(row.PersonasJSON, "[]")), &session.Personas)
	_ = json.Unmarshal([]byte(defaultJSON(row.LiveScoresJSON, "[]")), &session.LiveScores)
	_ = json.Unmarshal([]byte(defaultJSON(row.OvertimePersonaIDs, "[]")), &session.OvertimePersonaIDs)
	_ = json.Unmarshal([]byte(defaultJSON(row.SupportHistoryJSON, "[]")), &session.SupportHistory)
	if row.NeutralJudgeJSON != "" && row.NeutralJudgeJSON != "null" {
		var judge NeutralJudgeState
		if err := json.Unmarshal([]byte(row.NeutralJudgeJSON), &judge); err == nil {
			session.NeutralJudge = &judge
		}
	}
	if row.ResultJSON != "" && row.ResultJSON != "null" {
		var result DebateResult
		if err := json.Unmarshal([]byte(row.ResultJSON), &result); err == nil {
			session.Result = &result
		}
	}
	return session
}

func messageRow(sessionID string, message DebateMessage) *model.MindArenaDebateMessage {
	return &model.MindArenaDebateMessage{
		ID:          message.ID,
		SessionID:   sessionID,
		Round:       message.Round,
		RoundTitle:  message.RoundTitle,
		PersonaID:   message.PersonaID,
		PersonaName: message.PersonaName,
		Content:     message.Content,
		CreatedAt:   parseTimeOrNow(message.CreatedAt),
	}
}

func messageFromRow(row model.MindArenaDebateMessage) DebateMessage {
	return DebateMessage{
		ID:          row.ID,
		Round:       row.Round,
		RoundTitle:  row.RoundTitle,
		PersonaID:   row.PersonaID,
		PersonaName: row.PersonaName,
		Content:     row.Content,
		CreatedAt:   row.CreatedAt.Format(time.RFC3339),
	}
}

func scoreRow(sessionID string, score DebateScore) model.MindArenaDebateScore {
	return model.MindArenaDebateScore{
		SessionID:     sessionID,
		Persona:       score.Persona,
		PersonaID:     score.PersonaID,
		Score:         score.Score,
		JudgeScore:    score.JudgeScore,
		AudienceScore: score.AudienceScore,
		JudgeNote:     score.JudgeNote,
	}
}

func mustJSON(value any) string {
	if value == nil {
		return "null"
	}
	data, err := json.Marshal(value)
	if err != nil {
		return "null"
	}
	return string(data)
}

func defaultJSON(value string, fallback string) string {
	if value == "" {
		return fallback
	}
	return value
}

func parseTimeOrNow(value string) time.Time {
	if value == "" {
		return time.Now()
	}
	parsed, err := time.Parse(time.RFC3339, value)
	if err != nil {
		return time.Now()
	}
	return parsed
}
