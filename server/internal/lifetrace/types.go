package lifetrace

type WeatherResponse struct {
	Source           string          `json:"source"`
	City             string          `json:"city"`
	UpdatedAt        string          `json:"updatedAt"`
	Now              WeatherNow      `json:"now"`
	Metrics          []WeatherMetric `json:"metrics"`
	Hourly           []WeatherHour   `json:"hourly"`
	Daily            []WeatherDay    `json:"daily"`
	Indices          []WeatherIndex  `json:"indices"`
	Cached           bool            `json:"cached"`
	RefreshLimited   bool            `json:"refreshLimited,omitempty"`
	RefreshAllowedAt string          `json:"refreshAllowedAt,omitempty"`
	Warning          string          `json:"warning,omitempty"`
}

type WeatherNow struct {
	Temp       string `json:"temp"`
	FeelsLike  string `json:"feelsLike"`
	Text       string `json:"text"`
	High       string `json:"high"`
	Low        string `json:"low"`
	Humidity   string `json:"humidity"`
	WindScale  string `json:"windScale"`
	Precip     string `json:"precip"`
	UVIndex    string `json:"uvIndex"`
	AirQuality string `json:"airQuality"`
}

type WeatherMetric struct {
	Label string `json:"label"`
	Value string `json:"value"`
	Tone  string `json:"tone"`
}

type WeatherHour struct {
	Time     string `json:"time"`
	DateTime string `json:"dateTime,omitempty"`
	Temp     string `json:"temp"`
	Text     string `json:"text"`
	Active   bool   `json:"active,omitempty"`
}

type WeatherDay struct {
	Date    string `json:"date"`
	High    string `json:"high"`
	Low     string `json:"low"`
	TextDay string `json:"textDay"`
}

type WeatherIndex struct {
	Name     string `json:"name"`
	Category string `json:"category"`
	Text     string `json:"text"`
}
