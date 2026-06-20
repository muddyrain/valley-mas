package lifetrace

import (
	"embed"
	"encoding/json"
	"fmt"
	"sync"
	"time"
	"valley-server/internal/database"
	"valley-server/internal/model"

	"gorm.io/gorm"
)

//go:embed data/china_holidays_2026.json
var holidayCalendarFS embed.FS

type ChinaHolidayCalendar struct {
	Country          string                 `json:"country"`
	Year             int                    `json:"year"`
	SourceName       string                 `json:"sourceName"`
	SourceURL        string                 `json:"sourceUrl"`
	PublishedDate    string                 `json:"publishedDate"`
	Holidays         []ChinaHolidayRange    `json:"holidays"`
	AdjustedWorkdays []ChinaAdjustedWorkday `json:"adjustedWorkdays"`
}

type ChinaHolidayRange struct {
	Name      string   `json:"name"`
	StartDate string   `json:"startDate"`
	EndDate   string   `json:"endDate"`
	Dates     []string `json:"dates"`
}

type ChinaAdjustedWorkday struct {
	Date string `json:"date"`
	Name string `json:"name"`
}

type ChinaHolidayStatus struct {
	Date              string
	IsHoliday         bool
	IsAdjustedWorkday bool
	IsLegalWorkday    bool
	Name              string
	SourceName        string
	SourceURL         string
}

var (
	chinaHolidayCalendarOnce sync.Once
	chinaHolidayCalendar     ChinaHolidayCalendar
	chinaHolidayCalendarErr  error
)

func loadChinaHolidayCalendar2026() (ChinaHolidayCalendar, error) {
	chinaHolidayCalendarOnce.Do(func() {
		data, err := holidayCalendarFS.ReadFile("data/china_holidays_2026.json")
		if err != nil {
			chinaHolidayCalendarErr = err
			return
		}
		if err := json.Unmarshal(data, &chinaHolidayCalendar); err != nil {
			chinaHolidayCalendarErr = err
			return
		}
		if chinaHolidayCalendar.Country != "CN" || chinaHolidayCalendar.Year != 2026 {
			chinaHolidayCalendarErr = fmt.Errorf("unexpected China holiday calendar metadata")
		}
	})
	return chinaHolidayCalendar, chinaHolidayCalendarErr
}

func getChinaHolidayStatus(date time.Time) ChinaHolidayStatus {
	dateText := date.Format("2006-01-02")
	status := ChinaHolidayStatus{
		Date:           dateText,
		IsLegalWorkday: isWeekday(date),
	}

	calendar, ok := loadChinaHolidayCalendarForYear(date.Year())
	if !ok {
		return status
	}

	status.SourceName = calendar.SourceName
	status.SourceURL = calendar.SourceURL

	for _, workday := range calendar.AdjustedWorkdays {
		if workday.Date == dateText {
			status.IsAdjustedWorkday = true
			status.IsLegalWorkday = true
			status.Name = workday.Name
			return status
		}
	}

	for _, holiday := range calendar.Holidays {
		for _, holidayDate := range holiday.Dates {
			if holidayDate == dateText {
				status.IsHoliday = true
				status.IsLegalWorkday = false
				status.Name = holiday.Name
				return status
			}
		}
	}

	return status
}

func isChinaLegalWorkday(date time.Time) bool {
	return getChinaHolidayStatus(date).IsLegalWorkday
}

func GetChinaHolidayCalendar(year int) (ChinaHolidayCalendar, bool) {
	return loadChinaHolidayCalendarForYear(year)
}

func loadChinaHolidayCalendarForYear(year int) (ChinaHolidayCalendar, bool) {
	if calendar, ok := loadChinaHolidayCalendarFromDB(year); ok {
		return calendar, true
	}

	if year == 2026 {
		calendar, err := loadChinaHolidayCalendar2026()
		return calendar, err == nil
	}

	return ChinaHolidayCalendar{}, false
}

func loadChinaHolidayCalendarFromDB(year int) (ChinaHolidayCalendar, bool) {
	db := database.GetDB()
	if db == nil {
		return ChinaHolidayCalendar{}, false
	}

	var record model.LifeTraceHolidayCalendar
	if err := db.
		Where("country = ? AND year = ?", "CN", year).
		First(&record).Error; err != nil {
		if err != gorm.ErrRecordNotFound {
			// 节假日只影响提醒精度，读取失败时保持工作日兜底，避免阻塞主流程。
			return ChinaHolidayCalendar{}, false
		}
		return ChinaHolidayCalendar{}, false
	}

	var calendar ChinaHolidayCalendar
	if err := json.Unmarshal([]byte(record.Payload), &calendar); err != nil {
		return ChinaHolidayCalendar{}, false
	}
	if calendar.Country != "CN" || calendar.Year != year {
		return ChinaHolidayCalendar{}, false
	}
	return calendar, true
}

func isWeekday(date time.Time) bool {
	weekday := date.Weekday()
	return weekday >= time.Monday && weekday <= time.Friday
}
