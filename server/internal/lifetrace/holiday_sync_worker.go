package lifetrace

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"time"
	"valley-server/internal/config"
	"valley-server/internal/database"
	"valley-server/internal/logger"
	"valley-server/internal/model"

	"gorm.io/gorm/clause"
)

const defaultHolidayCountry = "CN"

type timorHolidayYearResponse struct {
	Code    int                          `json:"code"`
	Holiday map[string]timorHolidayEntry `json:"holiday"`
}

type timorHolidayEntry struct {
	Holiday bool   `json:"holiday"`
	Name    string `json:"name"`
	Date    string `json:"date"`
}

type normalizedHolidayDate struct {
	Date string
	Name string
}

func StartHolidayCalendarSyncWorker(ctx context.Context, cfg config.HolidaySyncConfig) {
	if !cfg.Enabled {
		logger.Log.Info("LifeTrace holiday sync worker disabled")
		return
	}
	if strings.TrimSpace(cfg.APIURLTemplate) == "" {
		logger.Log.Warn("LifeTrace holiday sync worker disabled: API URL template is empty")
		return
	}

	interval := time.Duration(cfg.SyncIntervalHours) * time.Hour
	if interval < time.Hour {
		interval = 24 * time.Hour
	}

	go func() {
		ticker := time.NewTicker(interval)
		defer ticker.Stop()

		if err := syncHolidayCalendars(ctx, cfg, time.Now()); err != nil {
			logger.Log.WithField("error", err).Warn("LifeTrace holiday initial sync failed")
		}

		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				if err := syncHolidayCalendars(ctx, cfg, time.Now()); err != nil {
					logger.Log.WithField("error", err).Warn("LifeTrace holiday sync failed")
				}
			}
		}
	}()
}

func syncHolidayCalendars(ctx context.Context, cfg config.HolidaySyncConfig, now time.Time) error {
	if database.GetDB() == nil {
		return errors.New("database is not initialized")
	}
	if cfg.FutureYears < 0 {
		cfg.FutureYears = 0
	}

	var errs []error
	for year := now.Year(); year <= now.Year()+cfg.FutureYears; year++ {
		calendar, err := fetchHolidayCalendar(ctx, cfg, year)
		if err != nil {
			errs = append(errs, fmt.Errorf("%d: %w", year, err))
			markHolidayCalendarChecked(year, now)
			continue
		}
		if err := saveChinaHolidayCalendar(calendar, now); err != nil {
			errs = append(errs, fmt.Errorf("%d: %w", year, err))
		}
	}
	return errors.Join(errs...)
}

func fetchHolidayCalendar(ctx context.Context, cfg config.HolidaySyncConfig, year int) (ChinaHolidayCalendar, error) {
	url := holidaySyncURL(cfg.APIURLTemplate, year)
	timeout := time.Duration(cfg.TimeoutSeconds) * time.Second
	if timeout <= 0 {
		timeout = 8 * time.Second
	}

	requestCtx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	req, err := http.NewRequestWithContext(requestCtx, http.MethodGet, url, nil)
	if err != nil {
		return ChinaHolidayCalendar{}, err
	}
	req.Header.Set("Accept", "application/json")
	req.Header.Set("User-Agent", "LifeTrace-HolidaySync/1.0")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return ChinaHolidayCalendar{}, err
	}
	defer resp.Body.Close()

	if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices {
		return ChinaHolidayCalendar{}, fmt.Errorf("holiday api returned %s", resp.Status)
	}

	var payload timorHolidayYearResponse
	if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
		return ChinaHolidayCalendar{}, err
	}
	if payload.Code != 0 {
		return ChinaHolidayCalendar{}, fmt.Errorf("holiday api returned code %d", payload.Code)
	}

	calendar := normalizeTimorHolidayCalendar(year, url, payload)
	if len(calendar.Holidays) == 0 && len(calendar.AdjustedWorkdays) == 0 {
		return ChinaHolidayCalendar{}, errors.New("holiday api returned empty calendar")
	}
	return calendar, nil
}

func holidaySyncURL(template string, year int) string {
	yearText := strconv.Itoa(year)
	if strings.Contains(template, "{year}") {
		return strings.ReplaceAll(template, "{year}", yearText)
	}
	if strings.Contains(template, "%d") {
		return fmt.Sprintf(template, year)
	}
	return strings.TrimRight(template, "/") + "/" + yearText
}

func normalizeTimorHolidayCalendar(year int, sourceURL string, payload timorHolidayYearResponse) ChinaHolidayCalendar {
	holidays := make([]normalizedHolidayDate, 0)
	workdays := make([]ChinaAdjustedWorkday, 0)

	for key, item := range payload.Holiday {
		dateText := strings.TrimSpace(item.Date)
		if dateText == "" {
			dateText = fmt.Sprintf("%d-%s", year, key)
		}
		if _, err := time.Parse("2006-01-02", dateText); err != nil {
			continue
		}

		name := strings.TrimSpace(item.Name)
		if name == "" {
			name = "法定节假日"
		}

		if item.Holiday {
			holidays = append(holidays, normalizedHolidayDate{Date: dateText, Name: name})
			continue
		}
		workdays = append(workdays, ChinaAdjustedWorkday{Date: dateText, Name: name})
	}

	sort.Slice(holidays, func(i, j int) bool {
		return holidays[i].Date < holidays[j].Date
	})
	sort.Slice(workdays, func(i, j int) bool {
		return workdays[i].Date < workdays[j].Date
	})

	return ChinaHolidayCalendar{
		Country:          defaultHolidayCountry,
		Year:             year,
		SourceName:       "节假日同步接口",
		SourceURL:        sourceURL,
		Holidays:         groupHolidayDates(holidays),
		AdjustedWorkdays: workdays,
	}
}

func groupHolidayDates(dates []normalizedHolidayDate) []ChinaHolidayRange {
	if len(dates) == 0 {
		return []ChinaHolidayRange{}
	}

	ranges := make([]ChinaHolidayRange, 0)
	current := ChinaHolidayRange{
		Name:      dates[0].Name,
		StartDate: dates[0].Date,
		EndDate:   dates[0].Date,
		Dates:     []string{dates[0].Date},
	}
	previousDate := mustParseHolidayDate(dates[0].Date)

	for _, item := range dates[1:] {
		itemDate := mustParseHolidayDate(item.Date)
		contiguous := item.Name == current.Name && itemDate.Sub(previousDate) == 24*time.Hour
		if !contiguous {
			ranges = append(ranges, current)
			current = ChinaHolidayRange{
				Name:      item.Name,
				StartDate: item.Date,
				EndDate:   item.Date,
				Dates:     []string{item.Date},
			}
		} else {
			current.EndDate = item.Date
			current.Dates = append(current.Dates, item.Date)
		}
		previousDate = itemDate
	}
	ranges = append(ranges, current)
	return ranges
}

func mustParseHolidayDate(value string) time.Time {
	date, err := time.Parse("2006-01-02", value)
	if err != nil {
		return time.Time{}
	}
	return date
}

func saveChinaHolidayCalendar(calendar ChinaHolidayCalendar, syncedAt time.Time) error {
	if calendar.Country == "" {
		calendar.Country = defaultHolidayCountry
	}
	payload, err := json.Marshal(calendar)
	if err != nil {
		return err
	}

	record := model.LifeTraceHolidayCalendar{
		Country:       calendar.Country,
		Year:          calendar.Year,
		SourceName:    calendar.SourceName,
		SourceURL:     calendar.SourceURL,
		Payload:       string(payload),
		SyncedAt:      syncedAt,
		LastCheckedAt: syncedAt,
	}

	return database.GetDB().Clauses(clause.OnConflict{
		Columns: []clause.Column{{Name: "country"}, {Name: "year"}},
		DoUpdates: clause.AssignmentColumns([]string{
			"source_name",
			"source_url",
			"payload",
			"synced_at",
			"last_checked_at",
			"updated_at",
			"deleted_at",
		}),
	}).Create(&record).Error
}

func markHolidayCalendarChecked(year int, checkedAt time.Time) {
	db := database.GetDB()
	if db == nil {
		return
	}
	_ = db.Model(&model.LifeTraceHolidayCalendar{}).
		Where("country = ? AND year = ?", defaultHolidayCountry, year).
		Update("last_checked_at", checkedAt).Error
}
