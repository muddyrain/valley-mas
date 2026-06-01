package lifetrace

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
	"valley-server/internal/config"
	"valley-server/internal/database"
	"valley-server/internal/model"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func mustParseChinaHolidayDate(t *testing.T, value string) time.Time {
	t.Helper()
	date, err := time.ParseInLocation("2006-01-02", value, time.Local)
	if err != nil {
		t.Fatalf("parse date %s: %v", value, err)
	}
	return date
}

func TestChinaHolidayCalendarLoadsOfficial2026Data(t *testing.T) {
	calendar, err := loadChinaHolidayCalendar2026()
	if err != nil {
		t.Fatalf("load calendar: %v", err)
	}
	if calendar.Country != "CN" || calendar.Year != 2026 {
		t.Fatalf("unexpected calendar metadata: %+v", calendar)
	}
	if len(calendar.Holidays) != 7 {
		t.Fatalf("expected 7 holidays, got %d", len(calendar.Holidays))
	}
	if len(calendar.AdjustedWorkdays) != 6 {
		t.Fatalf("expected 6 adjusted workdays, got %d", len(calendar.AdjustedWorkdays))
	}
}

func TestChinaHolidayStatusHandlesHolidayAndAdjustedWorkday(t *testing.T) {
	springFestival := getChinaHolidayStatus(mustParseChinaHolidayDate(t, "2026-02-16"))
	if !springFestival.IsHoliday || springFestival.IsLegalWorkday || springFestival.Name != "春节" {
		t.Fatalf("expected Spring Festival holiday, got %+v", springFestival)
	}

	adjustedWorkday := getChinaHolidayStatus(mustParseChinaHolidayDate(t, "2026-02-14"))
	if !adjustedWorkday.IsAdjustedWorkday || !adjustedWorkday.IsLegalWorkday {
		t.Fatalf("expected adjusted workday, got %+v", adjustedWorkday)
	}

	normalWorkday := getChinaHolidayStatus(mustParseChinaHolidayDate(t, "2026-06-01"))
	if normalWorkday.IsHoliday || !normalWorkday.IsLegalWorkday {
		t.Fatalf("expected normal legal workday, got %+v", normalWorkday)
	}
}

func setupHolidayCalendarTestDB(t *testing.T) {
	t.Helper()

	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite db: %v", err)
	}
	if err := db.AutoMigrate(&model.LifeTraceHolidayCalendar{}); err != nil {
		t.Fatalf("migrate holiday calendar: %v", err)
	}

	previousDB := database.DB
	database.DB = db
	t.Cleanup(func() {
		database.DB = previousDB
	})
}

func TestChinaHolidayStatusUsesSyncedCalendarFromDB(t *testing.T) {
	setupHolidayCalendarTestDB(t)

	calendar := ChinaHolidayCalendar{
		Country:    "CN",
		Year:       2027,
		SourceName: "test source",
		SourceURL:  "https://example.com/2027",
		Holidays: []ChinaHolidayRange{
			{
				Name:      "测试节",
				StartDate: "2027-01-01",
				EndDate:   "2027-01-02",
				Dates:     []string{"2027-01-01", "2027-01-02"},
			},
		},
		AdjustedWorkdays: []ChinaAdjustedWorkday{
			{Date: "2027-01-03", Name: "测试调休"},
		},
	}

	if err := saveChinaHolidayCalendar(calendar, time.Date(2026, 12, 1, 8, 0, 0, 0, time.UTC)); err != nil {
		t.Fatalf("save calendar: %v", err)
	}

	holiday := getChinaHolidayStatus(mustParseChinaHolidayDate(t, "2027-01-01"))
	if !holiday.IsHoliday || holiday.IsLegalWorkday || holiday.Name != "测试节" || holiday.SourceName != "test source" {
		t.Fatalf("expected synced holiday, got %+v", holiday)
	}

	workday := getChinaHolidayStatus(mustParseChinaHolidayDate(t, "2027-01-03"))
	if !workday.IsAdjustedWorkday || !workday.IsLegalWorkday || workday.Name != "测试调休" {
		t.Fatalf("expected synced adjusted workday, got %+v", workday)
	}
}

func TestSyncHolidayCalendarsFetchesAndStoresFutureYear(t *testing.T) {
	setupHolidayCalendarTestDB(t)

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{
			"code": 0,
			"holiday": {
				"01-01": {"holiday": true, "name": "元旦", "date": "2027-01-01"},
				"01-02": {"holiday": true, "name": "元旦", "date": "2027-01-02"},
				"01-03": {"holiday": false, "name": "元旦调休", "date": "2027-01-03"}
			}
		}`))
	}))
	defer server.Close()

	cfg := config.HolidaySyncConfig{
		Enabled:           true,
		APIURLTemplate:    server.URL + "/{year}",
		SyncIntervalHours: 168,
		FutureYears:       1,
		TimeoutSeconds:    2,
	}
	now := time.Date(2026, 12, 1, 8, 0, 0, 0, time.UTC)

	if err := syncHolidayCalendars(context.Background(), cfg, now); err != nil {
		t.Fatalf("sync calendars: %v", err)
	}

	status := getChinaHolidayStatus(mustParseChinaHolidayDate(t, "2027-01-01"))
	if !status.IsHoliday || status.Name != "元旦" || status.SourceURL != server.URL+"/2027" {
		t.Fatalf("expected synced 2027 holiday, got %+v", status)
	}

	adjusted := getChinaHolidayStatus(mustParseChinaHolidayDate(t, "2027-01-03"))
	if !adjusted.IsAdjustedWorkday || !adjusted.IsLegalWorkday {
		t.Fatalf("expected synced adjusted workday, got %+v", adjusted)
	}
}
