package lifetrace

import "time"

func mockWeather(city string) WeatherResponse {
	return WeatherResponse{
		Source:    "mock",
		City:      city,
		UpdatedAt: time.Now().Format(time.RFC3339),
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
			{Time: "14时", Temp: "24°", Text: "晴"},
			{Time: "15时", Temp: "25°", Text: "晴"},
			{Time: "16时", Temp: "26°", Text: "多云"},
			{Time: "17时", Temp: "24°", Text: "多云"},
			{Time: "18时", Temp: "22°", Text: "多云"},
			{Time: "19时", Temp: "20°", Text: "多云"},
		},
		Daily: []WeatherDay{
			{Date: "今天", High: "26°", Low: "17°", TextDay: "多云"},
			{Date: "明天", High: "25°", Low: "18°", TextDay: "小雨"},
			{Date: "后天", High: "27°", Low: "19°", TextDay: "晴"},
		},
		Indices: []WeatherIndex{
			{Name: "穿衣", Category: "较舒适", Text: "早晚偏凉，建议薄外套。"},
			{Name: "紫外线", Category: "中等", Text: "基础防晒即可，午后注意补涂。"},
			{Name: "运动", Category: "适宜", Text: "空气质量良好，适合轻运动。"},
		},
	}
}
