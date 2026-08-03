package aiapp

import (
	"encoding/json"
	"fmt"
	"io"
	"strconv"
	"strings"
	"unicode/utf8"
)

const (
	ModelProfileARKTextDefault = "ark-text-default"
	MaxSystemPromptRunes       = 12000
	MaxProfileRunes            = 12000
	MaxOpeningMessageRunes     = 1000
	MaxExampleQuestions        = 4
	MaxExampleQuestionRunes    = 120
	MaxSkillBindings           = 8
)

const (
	DefaultIdentity = "# IDENTITY.md\n\n你是一位可靠、友善、具备独立判断力的智能伙伴。请保持清晰、自然和有温度的表达。"
	DefaultUser     = "# USER.md\n\n尚未记录用户档案。请在交流中尊重用户的表达习惯、目标和沟通偏好。"
	DefaultSoul     = "# SOUL.md\n\n诚实说明能力边界；保护用户隐私；不伪造事实或执行结果；遇到高风险操作先确认。"
	DefaultAgents   = "# AGENTS.md\n\n优先理解用户真正想完成的目标；需要工具时说明正在做什么；完成后给出可验证的结果。"
)

var supportedImageAspectRatios = map[string]struct{}{
	"1:1": {}, "4:3": {}, "3:4": {}, "16:9": {}, "9:16": {},
}

var supportedImageQualities = map[string]struct{}{
	"1K": {}, "2K": {}, "3K": {}, "4K": {},
}

// ImageGenerationConfig keeps the agent's approved defaults for the image
// generation tool. The tool cannot arbitrarily switch to a different catalog
// model during a conversation.
type ImageGenerationConfig struct {
	ModelID     string `json:"modelId"`
	AspectRatio string `json:"aspectRatio"`
	Quality     string `json:"quality"`
}

type Config struct {
	ModelProfile string `json:"modelProfile"`
	ModelID      string `json:"modelId,omitempty"`
	// VisionModelID is retained only so existing version JSON remains readable.
	// Conversation image understanding always uses ModelID and its vision capability.
	VisionModelID     string                 `json:"visionModelId,omitempty"`
	Identity          string                 `json:"identity"`
	UserProfile       string                 `json:"userProfile"`
	Soul              string                 `json:"soul"`
	AgentInstructions string                 `json:"agentInstructions"`
	SystemPrompt      string                 `json:"systemPrompt,omitempty"`
	OpeningMessage    string                 `json:"openingMessage"`
	ExampleQuestions  []string               `json:"exampleQuestions"`
	SkillIDs          []string               `json:"skillIds"`
	ImageGeneration   *ImageGenerationConfig `json:"imageGeneration,omitempty"`
}

func DefaultConfig() Config {
	return Config{
		ModelProfile:      ModelProfileARKTextDefault,
		Identity:          DefaultIdentity,
		UserProfile:       DefaultUser,
		Soul:              DefaultSoul,
		AgentInstructions: DefaultAgents,
		ExampleQuestions:  []string{},
		SkillIDs:          []string{},
	}
}

func Parse(raw string) (Config, error) {
	if strings.TrimSpace(raw) == "" || strings.TrimSpace(raw) == "{}" {
		return DefaultConfig(), nil
	}
	config := Config{}
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
	config.ModelID = strings.TrimSpace(config.ModelID)
	config.VisionModelID = strings.TrimSpace(config.VisionModelID)
	config.SystemPrompt = strings.TrimSpace(config.SystemPrompt)
	config.Identity = strings.TrimSpace(config.Identity)
	config.UserProfile = strings.TrimSpace(config.UserProfile)
	config.Soul = strings.TrimSpace(config.Soul)
	config.AgentInstructions = strings.TrimSpace(config.AgentInstructions)
	if config.Identity == "" {
		if config.SystemPrompt != "" {
			config.Identity = config.SystemPrompt
		} else {
			config.Identity = DefaultIdentity
		}
	}
	if config.UserProfile == "" {
		config.UserProfile = DefaultUser
	}
	if config.Soul == "" {
		config.Soul = DefaultSoul
	}
	if config.AgentInstructions == "" {
		config.AgentInstructions = DefaultAgents
	}
	config.OpeningMessage = strings.TrimSpace(config.OpeningMessage)
	if config.ImageGeneration != nil {
		config.ImageGeneration.ModelID = strings.TrimSpace(config.ImageGeneration.ModelID)
		config.ImageGeneration.AspectRatio = strings.TrimSpace(config.ImageGeneration.AspectRatio)
		config.ImageGeneration.Quality = strings.TrimSpace(config.ImageGeneration.Quality)
	}
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
	seenSkillIDs := make(map[string]struct{}, len(config.SkillIDs))
	skillIDs := make([]string, 0, min(len(config.SkillIDs), MaxSkillBindings))
	for _, rawID := range config.SkillIDs {
		id := strings.TrimSpace(rawID)
		if _, exists := seenSkillIDs[id]; exists {
			continue
		}
		seenSkillIDs[id] = struct{}{}
		if id == "" {
			continue
		}
		skillIDs = append(skillIDs, id)
		if len(skillIDs) == MaxSkillBindings {
			break
		}
	}
	config.SkillIDs = skillIDs
	return config
}

func ValidateGenerated(config Config) error {
	if err := ValidateEditable(config); err != nil {
		return err
	}
	config = Normalize(config)
	if strings.TrimSpace(config.Identity) == "" && strings.TrimSpace(config.SystemPrompt) == "" {
		return fmt.Errorf("identity 不能为空")
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
	for label, value := range map[string]string{
		"IDENTITY.md": config.Identity,
		"USER.md":     config.UserProfile,
		"SOUL.md":     config.Soul,
		"AGENTS.md":   config.AgentInstructions,
	} {
		if utf8.RuneCountInString(value) > MaxProfileRunes {
			return fmt.Errorf("%s 不能超过 %d 个字符", label, MaxProfileRunes)
		}
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
	if len(config.SkillIDs) > MaxSkillBindings {
		return fmt.Errorf("技能不能超过 %d 个", MaxSkillBindings)
	}
	for _, rawID := range config.SkillIDs {
		id, err := strconv.ParseInt(strings.TrimSpace(rawID), 10, 64)
		if err != nil || id <= 0 {
			return fmt.Errorf("技能 ID 无效")
		}
	}
	if image := config.ImageGeneration; image != nil {
		if image.ModelID == "" {
			return fmt.Errorf("图片生成需要选择图片模型")
		}
		if _, ok := supportedImageAspectRatios[image.AspectRatio]; !ok {
			return fmt.Errorf("图片生成比例无效")
		}
		if _, ok := supportedImageQualities[image.Quality]; !ok {
			return fmt.Errorf("图片生成清晰度无效")
		}
	}
	return nil
}

// SystemInstructions composes the four editable agent profile documents into
// the single system instruction consumed by model providers.
func (config Config) SystemInstructions() string {
	config = Normalize(config)
	return strings.Join([]string{config.Identity, config.UserProfile, config.Soul, config.AgentInstructions}, "\n\n")
}

func Marshal(config Config) (json.RawMessage, error) {
	if err := ValidateEditable(config); err != nil {
		return nil, err
	}
	return json.Marshal(Normalize(config))
}
