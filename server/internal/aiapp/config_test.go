package aiapp

import (
	"strings"
	"testing"
)

func TestParseNormalizesAgentConfig(t *testing.T) {
	config, err := Parse(`{"systemPrompt":"  你是助手  ","openingMessage":" 你好 ","exampleQuestions":["问题一","问题一"," ","问题二"],"skillIds":["1","1"," 2 "]}`)
	if err != nil {
		t.Fatalf("Parse() error = %v", err)
	}
	if config.ModelProfile != ModelProfileARKTextDefault || config.Identity != "你是助手" || len(config.ExampleQuestions) != 2 || len(config.SkillIDs) != 2 || config.SkillIDs[1] != "2" {
		t.Fatalf("unexpected config: %#v", config)
	}
}

func TestParseProvidesFourDefaultProfileDocuments(t *testing.T) {
	config, err := Parse(`{}`)
	if err != nil {
		t.Fatalf("Parse() error = %v", err)
	}
	if config.Identity == "" || config.UserProfile == "" || config.Soul == "" || config.AgentInstructions == "" {
		t.Fatalf("profile defaults missing: %#v", config)
	}
	combined := config.SystemInstructions()
	for _, marker := range []string{"IDENTITY.md", "USER.md", "SOUL.md", "AGENTS.md"} {
		if !strings.Contains(combined, marker) {
			t.Fatalf("SystemInstructions() missing %s: %s", marker, combined)
		}
	}
}

func TestParseNormalizesVisionModel(t *testing.T) {
	config, err := Parse(`{"visionModelId":" 42 "}`)
	if err != nil {
		t.Fatalf("Parse() error = %v", err)
	}
	if config.VisionModelID != "42" {
		t.Fatalf("VisionModelID = %q", config.VisionModelID)
	}
}

func TestParseRejectsUnknownFieldsAndTooManyQuestions(t *testing.T) {
	if _, err := Parse(`{"systemPrompt":"ok","unexpected":true}`); err == nil {
		t.Fatal("Parse() accepted unknown field")
	}
	if _, err := Parse(`{"systemPrompt":"ok","exampleQuestions":["1","2","3","4","5"]}`); err == nil {
		t.Fatal("Parse() accepted more than four questions")
	}
	if _, err := Parse(`{"systemPrompt":"ok","skillIds":["bad"]}`); err == nil {
		t.Fatal("Parse() accepted invalid skill ID")
	}
}

func TestParseNormalizesImageGenerationConfig(t *testing.T) {
	config, err := Parse(`{"imageGeneration":{"modelId":" 17 ","aspectRatio":"3:4","quality":"2K"}}`)
	if err != nil {
		t.Fatalf("Parse() error = %v", err)
	}
	if config.ImageGeneration == nil || config.ImageGeneration.ModelID != "17" || config.ImageGeneration.AspectRatio != "3:4" || config.ImageGeneration.Quality != "2K" {
		t.Fatalf("image config = %#v", config.ImageGeneration)
	}
	if _, err := Parse(`{"imageGeneration":{"modelId":"17","aspectRatio":"2:3","quality":"2K"}}`); err == nil {
		t.Fatal("Parse() accepted an unsupported image aspect ratio")
	}
}

func TestValidateGeneratedAcceptsDefaultIdentity(t *testing.T) {
	if err := ValidateGenerated(DefaultConfig()); err != nil {
		t.Fatalf("ValidateGenerated() error = %v", err)
	}
}
