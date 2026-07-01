package lifetrace

import (
	lifeai "valley-server/internal/lifetrace/ai"
	prompts "valley-server/internal/lifetrace/ai/prompts"
	"valley-server/internal/model"
)

type lifeTraceAIAdvice = prompts.TodayAdviceItem

type todayAdviceAIResponse = prompts.TodayAdviceOutput

type weeklyReviewAIResponse = prompts.WeeklyReviewOutput

type lifeTraceAssistantMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type lifeTraceAssistantRequest struct {
	Message string                      `json:"message"`
	History []lifeTraceAssistantMessage `json:"history"`
}

type lifeTraceAssistantStreamChunk struct {
	Chunk  string                           `json:"chunk,omitempty"`
	Done   bool                             `json:"done,omitempty"`
	Error  string                           `json:"error,omitempty"`
	Source string                           `json:"source,omitempty"`
	Model  string                           `json:"model,omitempty"`
	Action *lifeTraceAssistantActionPayload `json:"action,omitempty"`
}

type lifeTraceAIConfig = lifeai.TextConfig

type lifeTraceAssistantPlanDraft struct {
	Title            string `json:"title"`
	Type             string `json:"type"`
	ScheduledDate    string `json:"scheduledDate"`
	ScheduledTime    string `json:"scheduledTime"`
	Timezone         string `json:"timezone"`
	NotePrefix       string `json:"notePrefix"`
	RelativeSchedule bool   `json:"-"`
}

type lifeTraceAssistantPantryDraft struct {
	Name      string `json:"name"`
	Category  string `json:"category"`
	Quantity  int    `json:"quantity"`
	Unit      string `json:"unit"`
	Location  string `json:"location"`
	ExpiresAt string `json:"expiresAt"`
	OpenedAt  string `json:"openedAt"`
	Note      string `json:"note"`
}

type lifeTraceAssistantLedgerDraft struct {
	Amount     float64 `json:"amount"`
	Currency   string  `json:"currency"`
	Direction  string  `json:"direction"`
	Category   string  `json:"category"`
	OccurredAt string  `json:"occurredAt"`
	Merchant   string  `json:"merchant"`
	Location   string  `json:"location"`
	Note       string  `json:"note"`
}

type lifeTraceAssistantActionPayload struct {
	Type               string                     `json:"type"`
	Status             string                     `json:"status"`
	Message            string                     `json:"message"`
	NeedMoreInfoFields []string                   `json:"needMoreInfoFields,omitempty"`
	HouseholdName      string                     `json:"householdName,omitempty"`
	Plan               *model.LifeTracePlan       `json:"plan,omitempty"`
	PantryItem         *model.LifeTracePantryItem `json:"pantryItem,omitempty"`
	LedgerEntry        *ledgerEntryResponse       `json:"ledgerEntry,omitempty"`
}

type lifeTraceAssistantStructuredAction struct {
	Type               string                         `json:"type"`
	Message            string                         `json:"message"`
	NeedMoreInfoFields []string                       `json:"needMoreInfoFields,omitempty"`
	Plan               *lifeTraceAssistantPlanDraft   `json:"plan,omitempty"`
	Pantry             *lifeTraceAssistantPantryDraft `json:"pantry,omitempty"`
	Ledger             *lifeTraceAssistantLedgerDraft `json:"ledger,omitempty"`
}

type lifeTraceAssistantStructuredResponse struct {
	Reply  string                              `json:"reply"`
	Action *lifeTraceAssistantStructuredAction `json:"action,omitempty"`
}

