package lifetrace

import (
	"fmt"
	"strconv"
	"strings"
	"time"
)

type qWeatherGeoResponse struct {
	Code     string `json:"code"`
	Location []struct {
		ID   string `json:"id"`
		Name string `json:"name"`
		Adm2 string `json:"adm2"`
	} `json:"location"`
}

type qWeatherNowResponse struct {
	Code       string `json:"code"`
	UpdateTime string `json:"updateTime"`
	Now        struct {
		Temp      string `json:"temp"`
		FeelsLike string `json:"feelsLike"`
		Text      string `json:"text"`
		WindScale string `json:"windScale"`
		Humidity  string `json:"humidity"`
		Precip    string `json:"precip"`
	} `json:"now"`
}

type qWeatherHourlyResponse struct {
	Code   string `json:"code"`
	Hourly []struct {
		FxTime string `json:"fxTime"`
		Temp   string `json:"temp"`
		Text   string `json:"text"`
		Pop    string `json:"pop"`
	} `json:"hourly"`
}

type qWeatherDailyResponse struct {
	Code  string `json:"code"`
	Daily []struct {
		FxDate   string `json:"fxDate"`
		TempMax  string `json:"tempMax"`
		TempMin  string `json:"tempMin"`
		TextDay  string `json:"textDay"`
		UVIndex  string `json:"uvIndex"`
		Humidity string `json:"humidity"`
		Precip   string `json:"precip"`
	} `json:"daily"`
}

type qWeatherIndicesResponse struct {
	Code  string `json:"code"`
	Daily []struct {
		Name     string `json:"name"`
		Category string `json:"category"`
		Text     string `json:"text"`
	} `json:"daily"`
}

func normalizeQWeather(
	city string,
	now qWeatherNowResponse,
	hourly qWeatherHourlyResponse,
	daily qWeatherDailyResponse,
	indices qWeatherIndicesResponse,
) WeatherResponse {
	if now.Code != "200" {
		return mockWeather(city)
	}

	high, low := "", ""
	uv := "未知"
	if len(daily.Daily) > 0 {
		high = daily.Daily[0].TempMax
		low = daily.Daily[0].TempMin
		if daily.Daily[0].UVIndex != "" {
			uv = daily.Daily[0].UVIndex
		}
	}

	resp := WeatherResponse{
		Source:    "qweather",
		City:      city,
		UpdatedAt: now.UpdateTime,
		Now: WeatherNow{
			Temp:       now.Now.Temp,
			FeelsLike:  now.Now.FeelsLike,
			Text:       now.Now.Text,
			High:       high,
			Low:        low,
			Humidity:   percent(now.Now.Humidity),
			WindScale:  scale(now.Now.WindScale),
			Precip:     precip(now.Now.Precip),
			UVIndex:    uv,
			AirQuality: "良",
		},
		Indices: normalizeIndices(indices),
	}

	resp.Metrics = []WeatherMetric{
		{Label: "降水", Value: resp.Now.Precip, Tone: "weather"},
		{Label: "湿度", Value: resp.Now.Humidity, Tone: "ai"},
		{Label: "空气", Value: resp.Now.AirQuality, Tone: "trace"},
		{Label: "风力", Value: resp.Now.WindScale, Tone: "muted"},
		{Label: "紫外线", Value: resp.Now.UVIndex, Tone: "health"},
		{Label: "体感", Value: degree(resp.Now.FeelsLike), Tone: "alert"},
	}
	resp.Hourly = normalizeHourly(hourly, now.Now.Temp, now.Now.Text)
	resp.Daily = normalizeDaily(daily)
	resp.Hourly = ensureTomorrowHourly(resp.Hourly, resp.Daily)

	return resp
}

func normalizeHourly(resp qWeatherHourlyResponse, nowTemp string, nowText string) []WeatherHour {
	hours := []WeatherHour{{Time: "现在", Temp: degree(nowTemp), Text: nowText, Active: true}}
	for _, item := range resp.Hourly {
		hours = append(hours, WeatherHour{
			Time:     formatHour(item.FxTime),
			DateTime: item.FxTime,
			Temp:     degree(item.Temp),
			Text:     item.Text,
		})
	}
	return hours
}

func ensureTomorrowHourly(hours []WeatherHour, days []WeatherDay) []WeatherHour {
	if len(days) < 2 || len(hours) == 0 {
		return hours
	}

	todayDate := strings.TrimSpace(days[0].Date)
	tomorrowDate := strings.TrimSpace(days[1].Date)
	if todayDate == "" || tomorrowDate == "" || todayDate == tomorrowDate {
		return hours
	}

	for _, item := range hours {
		parsed, ok := parseWeatherDateTime(item.DateTime)
		if !ok {
			continue
		}
		if parsed.Format("2006-01-02") == tomorrowDate {
			return hours
		}
	}

	supplemented := append([]WeatherHour{}, hours...)
	supplemented = append(supplemented, synthesizeTomorrowHourly(days[1])...)
	return supplemented
}

func synthesizeTomorrowHourly(day WeatherDay) []WeatherHour {
	parsedDate, err := time.Parse("2006-01-02", strings.TrimSpace(day.Date))
	if err != nil {
		return nil
	}

	location := time.FixedZone("UTC+8", 8*60*60)
	hours := []int{6, 9, 12, 15, 18, 21}
	low := parseWeatherInteger(day.Low)
	high := parseWeatherInteger(day.High)
	if high < low {
		high = low
	}

	result := make([]WeatherHour, 0, len(hours))
	for index, hour := range hours {
		slotTime := time.Date(
			parsedDate.Year(),
			parsedDate.Month(),
			parsedDate.Day(),
			hour,
			0,
			0,
			0,
			location,
		)
		result = append(result, WeatherHour{
			Time:     fmt.Sprintf("%02d时", hour),
			DateTime: slotTime.Format(time.RFC3339),
			Temp:     degree(strconv.Itoa(interpolateHourlyTemp(low, high, index, len(hours)))),
			Text:     strings.TrimSpace(day.TextDay),
		})
	}
	return result
}

func interpolateHourlyTemp(low int, high int, index int, total int) int {
	if total <= 1 || high <= low {
		return low
	}
	ratio := float64(index) / float64(total-1)
	curve := []float64{0.08, 0.35, 0.88, 1, 0.72, 0.38}
	if total == len(curve) {
		ratio = curve[index]
	}
	return low + int(float64(high-low)*ratio+0.5)
}

func parseWeatherInteger(value string) int {
	value = strings.TrimSpace(strings.TrimSuffix(value, "°"))
	if value == "" {
		return 0
	}
	parsed, err := strconv.Atoi(value)
	if err != nil {
		return 0
	}
	return parsed
}

func parseWeatherDateTime(value string) (time.Time, bool) {
	value = strings.TrimSpace(value)
	if value == "" {
		return time.Time{}, false
	}
	for _, layout := range []string{time.RFC3339, "2006-01-02T15:04-07:00"} {
		parsed, err := time.Parse(layout, value)
		if err == nil {
			return parsed, true
		}
	}
	return time.Time{}, false
}

func normalizeDaily(resp qWeatherDailyResponse) []WeatherDay {
	days := make([]WeatherDay, 0, len(resp.Daily))
	for _, item := range resp.Daily {
		days = append(days, WeatherDay{
			Date:    item.FxDate,
			High:    degree(item.TempMax),
			Low:     degree(item.TempMin),
			TextDay: item.TextDay,
		})
	}
	return days
}

func normalizeIndices(resp qWeatherIndicesResponse) []WeatherIndex {
	indices := make([]WeatherIndex, 0, len(resp.Daily))
	for _, item := range resp.Daily {
		indices = append(indices, WeatherIndex{
			Name:     item.Name,
			Category: item.Category,
			Text:     item.Text,
		})
	}
	return indices
}

func formatHour(value string) string {
	for _, layout := range []string{time.RFC3339, "2006-01-02T15:04-07:00"} {
		parsed, err := time.Parse(layout, value)
		if err == nil {
			return parsed.Format("15时")
		}
	}
	return value
}

func degree(value string) string {
	value = strings.TrimSpace(value)
	if value == "" {
		return ""
	}
	if strings.HasSuffix(value, "°") {
		return value
	}
	return value + "°"
}

func percent(value string) string {
	value = strings.TrimSpace(value)
	if value == "" {
		return "0%"
	}
	if strings.HasSuffix(value, "%") {
		return value
	}
	return value + "%"
}

func scale(value string) string {
	value = strings.TrimSpace(value)
	if value == "" {
		return "0级"
	}
	if strings.HasSuffix(value, "级") {
		return value
	}
	return value + "级"
}

func precip(value string) string {
	value = strings.TrimSpace(value)
	if value == "" {
		return "0%"
	}
	if strings.HasSuffix(value, "%") {
		return value
	}
	parsed, err := strconv.ParseFloat(value, 64)
	if err != nil {
		return value
	}
	if parsed <= 1 {
		return fmt.Sprintf("%.0f%%", parsed*100)
	}
	return value + "mm"
}
