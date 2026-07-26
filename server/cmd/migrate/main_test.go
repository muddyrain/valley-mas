package main

import (
	"bytes"
	"strings"
	"testing"

	"valley-server/internal/config"
)

func TestParseOptionsRequiresCommand(t *testing.T) {
	if _, err := parseOptions(nil, &bytes.Buffer{}); err == nil {
		t.Fatal("expected command error")
	}
}

func TestParseOptionsRejectsUnknownCommand(t *testing.T) {
	if _, err := parseOptions([]string{"reset"}, &bytes.Buffer{}); err == nil {
		t.Fatal("expected unsupported command error")
	}
}

func TestValidateRunProtectsProductionUp(t *testing.T) {
	cfg := &config.Config{Env: "production"}
	err := validateRun(cfg, options{command: "up"})
	if err == nil || !strings.Contains(err.Error(), "--allow-production") {
		t.Fatalf("expected production confirmation error, got %v", err)
	}
	if err := validateRun(cfg, options{command: "up", allowProduction: true}); err != nil {
		t.Fatal(err)
	}
}

func TestValidateRunKeepsBootstrapDevelopmentOnly(t *testing.T) {
	if err := validateRun(&config.Config{Env: "development"}, options{command: "bootstrap"}); err == nil {
		t.Fatal("expected explicit apply confirmation")
	}
	if err := validateRun(&config.Config{Env: "development"}, options{command: "bootstrap", apply: true}); err != nil {
		t.Fatal(err)
	}
	if err := validateRun(&config.Config{Env: "production"}, options{command: "bootstrap", apply: true}); err == nil {
		t.Fatal("expected production bootstrap refusal")
	}
}
