package workflowtrigger

import (
	"fmt"
	"strings"
	"time"

	"github.com/robfig/cron/v3"
)

const DefaultTimezone = "Asia/Shanghai"

// Schedule is the validated, timezone-aware representation persisted by a
// workflow trigger. Execution ownership remains in the database worker; this
// type only validates a cron expression and derives its next fire time.
type Schedule struct {
	Expression string
	Timezone   string
	location   *time.Location
	parsed     cron.Schedule
}

func Parse(expression, timezone string) (Schedule, error) {
	expression = strings.TrimSpace(expression)
	if expression == "" || len(expression) > 120 {
		return Schedule{}, fmt.Errorf("invalid cron expression")
	}
	if strings.Contains(strings.ToUpper(expression), "CRON_TZ=") || strings.Contains(strings.ToUpper(expression), "TZ=") {
		return Schedule{}, fmt.Errorf("timezone must be configured separately")
	}
	if timezone = strings.TrimSpace(timezone); timezone == "" {
		timezone = DefaultTimezone
	}
	location, err := time.LoadLocation(timezone)
	if err != nil {
		return Schedule{}, fmt.Errorf("invalid timezone")
	}
	parsed, err := cron.ParseStandard(expression)
	if err != nil {
		return Schedule{}, fmt.Errorf("invalid cron expression")
	}
	return Schedule{Expression: expression, Timezone: timezone, location: location, parsed: parsed}, nil
}

func (schedule Schedule) Next(after time.Time) time.Time {
	return schedule.parsed.Next(after.In(schedule.location)).UTC()
}
