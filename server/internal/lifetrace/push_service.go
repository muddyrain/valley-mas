package lifetrace

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
	"valley-server/internal/config"
	"valley-server/internal/model"

	webpush "github.com/SherClockHolmes/webpush-go"
)

type PushService struct {
	config config.WebPushConfig
}

type PushPayload struct {
	Title  string `json:"title"`
	Body   string `json:"body"`
	URL    string `json:"url"`
	Tag    string `json:"tag,omitempty"`
	PlanID string `json:"planId,omitempty"`
}

func NewPushService(cfg config.WebPushConfig) *PushService {
	return &PushService{config: cfg}
}

func (s *PushService) Enabled() bool {
	return s != nil &&
		s.config.Enabled &&
		s.config.PublicKey != "" &&
		s.config.PrivateKey != ""
}

func (s *PushService) PublicKey() string {
	if s == nil {
		return ""
	}
	return s.config.PublicKey
}

func (s *PushService) Send(ctx context.Context, subscription model.LifeTracePushSubscription, payload PushPayload) (int, error) {
	if !s.Enabled() {
		return 0, fmt.Errorf("Web Push 未配置")
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return 0, err
	}

	resp, err := webpush.SendNotificationWithContext(
		ctx,
		body,
		&webpush.Subscription{
			Endpoint: subscription.Endpoint,
			Keys: webpush.Keys{
				Auth:   subscription.Auth,
				P256dh: subscription.P256DH,
			},
		},
		&webpush.Options{
			Subscriber:      s.config.Subject,
			TTL:             60 * 60,
			Topic:           truncatePushTopic(payload.Tag),
			Urgency:         webpush.UrgencyHigh,
			VAPIDPublicKey:  s.config.PublicKey,
			VAPIDPrivateKey: s.config.PrivateKey,
		},
	)
	if resp != nil {
		defer resp.Body.Close()
	}
	if err != nil {
		if resp != nil {
			return resp.StatusCode, withPushResponseDetail(resp, err)
		}
		return 0, err
	}
	if resp.StatusCode >= http.StatusBadRequest {
		return resp.StatusCode, withPushResponseDetail(
			resp,
			fmt.Errorf("push endpoint returned %d", resp.StatusCode),
		)
	}
	return resp.StatusCode, nil
}

func withPushResponseDetail(resp *http.Response, err error) error {
	if resp == nil || resp.Body == nil {
		return err
	}

	body, readErr := io.ReadAll(io.LimitReader(resp.Body, 500))
	if readErr != nil {
		return err
	}

	detail := strings.TrimSpace(string(body))
	if detail == "" {
		return err
	}
	return fmt.Errorf("%w: %s", err, detail)
}

func truncatePushTopic(topic string) string {
	topic = strings.TrimSpace(topic)
	if len(topic) <= 32 {
		return topic
	}
	return topic[:32]
}

func parsePlanDueAt(plan model.LifeTracePlan) (time.Time, bool) {
	if plan.ScheduledDate == "" || plan.ScheduledTime == "" {
		return time.Time{}, false
	}
	location := time.Local
	if plan.Timezone != "" {
		if loc, err := time.LoadLocation(plan.Timezone); err == nil {
			location = loc
		}
	}
	dueAt, err := time.ParseInLocation("2006-01-02 15:04", plan.ScheduledDate+" "+plan.ScheduledTime, location)
	return dueAt, err == nil
}
