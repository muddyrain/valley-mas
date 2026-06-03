package lifetrace

import "time"

func mockWeather(city string) WeatherResponse {
	now := time.Now()
	return WeatherResponse{
		Source:    "mock",
		City:      city,
		UpdatedAt: now.Format(time.RFC3339),
		Now: WeatherNow{
			Temp:       "22",
			FeelsLike:  "21",
			Text:       "多云",
			High:       "26",
			Low:        "17",
			Humidity:   "58%",
			WindScale:  "3级",
			Precip:     "20%",
			UVIndex:    "中等",
			AirQuality: "良",
		},
		Metrics: []WeatherMetric{
			{Label: "降水", Value: "20%", Tone: "weather"},
			{Label: "湿度", Value: "58%", Tone: "ai"},
			{Label: "空气", Value: "良", Tone: "trace"},
			{Label: "风力", Value: "3级", Tone: "muted"},
			{Label: "紫外线", Value: "中等", Tone: "health"},
			{Label: "体感", Value: "21°", Tone: "alert"},
		},
		Hourly: []WeatherHour{
			{Time: "现在", Temp: "22°", Text: "多云", Active: true},
			{Time: "14时", DateTime: now.Add(1 * time.Hour).Format(time.RFC3339), Temp: "24°", Text: "晴"},
			{Time: "15时", DateTime: now.Add(2 * time.Hour).Format(time.RFC3339), Temp: "25°", Text: "晴"},
			{Time: "16时", DateTime: now.Add(3 * time.Hour).Format(time.RFC3339), Temp: "26°", Text: "多云"},
			{Time: "17时", DateTime: now.Add(4 * time.Hour).Format(time.RFC3339), Temp: "24°", Text: "多云"},
			{Time: "18时", DateTime: now.Add(5 * time.Hour).Format(time.RFC3339), Temp: "22°", Text: "多云"},
			{Time: "19时", DateTime: now.Add(6 * time.Hour).Format(time.RFC3339), Temp: "20°", Text: "多云"},
			{Time: "20时", DateTime: now.Add(7 * time.Hour).Format(time.RFC3339), Temp: "19°", Text: "多云"},
			{Time: "21时", DateTime: now.Add(8 * time.Hour).Format(time.RFC3339), Temp: "18°", Text: "阴"},
			{Time: "22时", DateTime: now.Add(9 * time.Hour).Format(time.RFC3339), Temp: "18°", Text: "阴"},
			{Time: "23时", DateTime: now.Add(10 * time.Hour).Format(time.RFC3339), Temp: "17°", Text: "阴"},
			{Time: "00时", DateTime: now.Add(11 * time.Hour).Format(time.RFC3339), Temp: "17°", Text: "小雨"},
			{Time: "01时", DateTime: now.Add(12 * time.Hour).Format(time.RFC3339), Temp: "17°", Text: "小雨"},
			{Time: "06时", DateTime: now.Add(17 * time.Hour).Format(time.RFC3339), Temp: "18°", Text: "小雨"},
			{Time: "09时", DateTime: now.Add(20 * time.Hour).Format(time.RFC3339), Temp: "21°", Text: "小雨"},
			{Time: "12时", DateTime: now.Add(23 * time.Hour).Format(time.RFC3339), Temp: "24°", Text: "阴"},
		},
		Daily: []WeatherDay{
			{Date: now.Format("2006-01-02"), High: "26°", Low: "17°", TextDay: "多云"},
			{Date: now.AddDate(0, 0, 1).Format("2006-01-02"), High: "25°", Low: "18°", TextDay: "小雨"},
			{Date: now.AddDate(0, 0, 2).Format("2006-01-02"), High: "27°", Low: "19°", TextDay: "晴"},
		},
		Indices: []WeatherIndex{
			{Name: "穿衣", Category: "较舒适", Text: "早晚偏凉，建议薄外套。"},
			{Name: "紫外线", Category: "中等", Text: "基础防晒即可，午后注意补涂。"},
			{Name: "运动", Category: "适宜", Text: "空气质量良好，适合轻运动。"},
		},
	}
}
