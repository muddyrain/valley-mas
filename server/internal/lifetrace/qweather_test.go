package lifetrace

import "testing"

func TestNormalizeQWeatherSynthesizesTomorrowHourlyWhenMissing(t *testing.T) {
	now := qWeatherNowResponse{Code: "200"}
	now.Now.Temp = "24"
	now.Now.FeelsLike = "25"
	now.Now.Text = "多云"
	now.Now.Humidity = "61"
	now.Now.WindScale = "3"
	now.Now.Precip = "0.1"
	now.UpdateTime = "2026-06-03T20:00+08:00"

	daily := qWeatherDailyResponse{Code: "200"}
	daily.Daily = []struct {
		FxDate   string `json:"fxDate"`
		TempMax  string `json:"tempMax"`
		TempMin  string `json:"tempMin"`
		TextDay  string `json:"textDay"`
		UVIndex  string `json:"uvIndex"`
		Humidity string `json:"humidity"`
		Precip   string `json:"precip"`
	}{
		{FxDate: "2026-06-03", TempMax: "28", TempMin: "22", TextDay: "多云", UVIndex: "中等"},
		{FxDate: "2026-06-04", TempMax: "27", TempMin: "21", TextDay: "小雨", UVIndex: "弱"},
	}

	resp := normalizeQWeather("杭州", now, qWeatherHourlyResponse{Code: "500"}, daily, qWeatherIndicesResponse{})

	var tomorrowCount int
	for _, item := range resp.Hourly {
		if parsed, ok := parseWeatherDateTime(item.DateTime); ok && parsed.Format("2006-01-02") == "2026-06-04" {
			tomorrowCount++
		}
	}

	if tomorrowCount == 0 {
		t.Fatalf("expected synthesized tomorrow hourly data, got %+v", resp.Hourly)
	}
}

func TestNormalizeQWeatherKeepsUpstreamTomorrowHourly(t *testing.T) {
	now := qWeatherNowResponse{Code: "200"}
	now.Now.Temp = "24"
	now.Now.FeelsLike = "25"
	now.Now.Text = "多云"
	now.Now.Humidity = "61"
	now.Now.WindScale = "3"
	now.Now.Precip = "0.1"
	now.UpdateTime = "2026-06-03T20:00+08:00"

	hourly := qWeatherHourlyResponse{Code: "200"}
	hourly.Hourly = []struct {
		FxTime string `json:"fxTime"`
		Temp   string `json:"temp"`
		Text   string `json:"text"`
		Pop    string `json:"pop"`
	}{
		{FxTime: "2026-06-03T21:00+08:00", Temp: "24", Text: "多云"},
		{FxTime: "2026-06-04T06:00+08:00", Temp: "22", Text: "小雨"},
	}

	daily := qWeatherDailyResponse{Code: "200"}
	daily.Daily = []struct {
		FxDate   string `json:"fxDate"`
		TempMax  string `json:"tempMax"`
		TempMin  string `json:"tempMin"`
		TextDay  string `json:"textDay"`
		UVIndex  string `json:"uvIndex"`
		Humidity string `json:"humidity"`
		Precip   string `json:"precip"`
	}{
		{FxDate: "2026-06-03", TempMax: "28", TempMin: "22", TextDay: "多云", UVIndex: "中等"},
		{FxDate: "2026-06-04", TempMax: "27", TempMin: "21", TextDay: "小雨", UVIndex: "弱"},
	}

	resp := normalizeQWeather("杭州", now, hourly, daily, qWeatherIndicesResponse{})

	var tomorrowCount int
	for _, item := range resp.Hourly {
		if parsed, ok := parseWeatherDateTime(item.DateTime); ok && parsed.Format("2006-01-02") == "2026-06-04" {
			tomorrowCount++
		}
	}

	if tomorrowCount != 1 {
		t.Fatalf("expected to keep upstream tomorrow hourly data without duplication, got %+v", resp.Hourly)
	}
}
