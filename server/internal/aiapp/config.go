package aiapp

import (
	"encoding/json"
	"fmt"
	"io"
	"strings"
	"unicode/utf8"
)

const (
	ModelProfileARKTextDefault = "ark-text-default"
	MaxSystemPromptRunes       = 12000
	MaxOpeningMessageRunes     = 1000
	MaxExampleQuestions        = 4
	MaxExampleQuestionRunes    = 120
)

type Config struct {
	ModelProfile     string   `json:"modelProfile"`
	SystemPrompt     string   `json:"systemPrompt"`
	OpeningMessage   string   `json:"openingMessage"`
	ExampleQuestions []string `json:"exampleQuestions"`
}

func DefaultConfig() Config {
	return Config{ModelProfile: ModelProfileARKTextDefault, ExampleQuestions: []string{}}
}

func Parse(raw string) (Config, error) {
	config := DefaultConfig()
	if strings.TrimSpace(raw) == "" || strings.TrimSpace(raw) == "{}" {
		return config, nil
	}
	decoder := json.NewDecoder(strings.NewReader(raw))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&config); err != nil {
		return Config{}, fmt.Errorf("智能体配置无效: %w", err)
	}
	if err := decoder.Decode(&struct{}{}); err != io.EOF {
		return Config{}, fmt.Errorf("智能体配置无效: 只能包含一个 JSON 对象")
	}
	if err := ValidateEditable(config); err != nil {
		return Config{}, err
	}
	return Normalize(config), nil
}

func Normalize(config Config) Config {
	config.ModelProfile = strings.TrimSpace(config.ModelProfile)
	if config.ModelProfile == "" {
		config.ModelProfile = ModelProfileARKTextDefault
	}
	config.SystemPrompt = strings.TrimSpace(config.SystemPrompt)
	config.OpeningMessage = strings.TrimSpace(config.OpeningMessage)
	seen := make(map[string]struct{}, len(config.ExampleQuestions))
	questions := make([]string, 0, min(len(config.ExampleQuestions), MaxExampleQuestions))
	for _, item := range config.ExampleQuestions {
		question := strings.TrimSpace(item)
		if question == "" {
			continue
		}
		if _, exists := seen[question]; exists {
			continue
		}
		seen[question] = struct{}{}
		questions = append(questions, question)
		if len(questions) == MaxExampleQuestions {
			break
		}
	}
	config.ExampleQuestions = questions
	return config
}

func ValidateGenerated(config Config) error {
	if err := ValidateEditable(config); err != nil {
		return err
	}
	config = Normalize(config)
	if strings.TrimSpace(config.SystemPrompt) == "" {
		return fmt.Errorf("systemPrompt 不能为空")
	}
	return nil
}

func ValidateEditable(config Config) error {
	config.ModelProfile = strings.TrimSpace(config.ModelProfile)
	if config.ModelProfile == "" {
		config.ModelProfile = ModelProfileARKTextDefault
	}
	if config.ModelProfile != ModelProfileARKTextDefault {
		return fmt.Errorf("modelProfile 必须为 %s", ModelProfileARKTextDefault)
	}
	if utf8.RuneCountInString(config.SystemPrompt) > MaxSystemPromptRunes {
		return fmt.Errorf("systemPrompt 不能超过 %d 个字符", MaxSystemPromptRunes)
	}
	if utf8.RuneCountInString(config.OpeningMessage) > MaxOpeningMessageRunes {
		return fmt.Errorf("openingMessage 不能超过 %d 个字符", MaxOpeningMessageRunes)
	}
	if len(config.ExampleQuestions) > MaxExampleQuestions {
		return fmt.Errorf("示例问题不能超过 %d 条", MaxExampleQuestions)
	}
	for _, question := range config.ExampleQuestions {
		if utf8.RuneCountInString(question) > MaxExampleQuestionRunes {
			return fmt.Errorf("示例问题不能超过 %d 个字符", MaxExampleQuestionRunes)
		}
	}
	return nil
}

func Marshal(config Config) (json.RawMessage, error) {
	if err := ValidateEditable(config); err != nil {
		return nil, err
	}
	return json.Marshal(Normalize(config))
}
