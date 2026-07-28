package aiapp

import "testing"

func TestParseNormalizesAgentConfig(t *testing.T) {
	config, err := Parse(`{"systemPrompt":"  你是助手  ","openingMessage":" 你好 ","exampleQuestions":["问题一","问题一"," ","问题二"],"skillIds":["1","1"," 2 "]}`)
	if err != nil {
		t.Fatalf("Parse() error = %v", err)
	}
	if config.ModelProfile != ModelProfileARKTextDefault || config.SystemPrompt != "你是助手" || len(config.ExampleQuestions) != 2 || len(config.SkillIDs) != 2 || config.SkillIDs[1] != "2" {
		t.Fatalf("unexpected config: %#v", config)
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

func TestValidateGeneratedRejectsEmptyPrompt(t *testing.T) {
	if err := ValidateGenerated(DefaultConfig()); err == nil {
		t.Fatal("ValidateGenerated() error = nil")
	}
}
