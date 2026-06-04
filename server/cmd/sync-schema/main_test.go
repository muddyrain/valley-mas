package main

import (
	"bytes"
	"strings"
	"testing"
	"valley-server/internal/config"
)

func TestParseOptionsDefaultsToDryRun(t *testing.T) {
	options, err := parseOptions(nil, &bytes.Buffer{})
	if err != nil {
		t.Fatalf("parse options: %v", err)
	}

	if options.apply {
		t.Fatal("expected apply to default to false")
	}
	if options.allowProduction {
		t.Fatal("expected allow-production to default to false")
	}
}

func TestParseOptionsEnablesApplyAndProductionOverride(t *testing.T) {
	options, err := parseOptions([]string{"--apply", "--allow-production"}, &bytes.Buffer{})
	if err != nil {
		t.Fatalf("parse options: %v", err)
	}

	if !options.apply {
		t.Fatal("expected apply to be true")
	}
	if !options.allowProduction {
		t.Fatal("expected allow-production to be true")
	}
}

func TestValidateRunRequiresProductionOverride(t *testing.T) {
	cfg := &config.Config{Env: "production"}

	err := validateRun(cfg, syncOptions{apply: true})
	if err == nil {
		t.Fatal("expected production run to require override")
	}
	if !strings.Contains(err.Error(), "--allow-production") {
		t.Fatalf("expected override hint, got %q", err.Error())
	}
}

func TestValidateRunAllowsDevelopment(t *testing.T) {
	cfg := &config.Config{Env: "development"}

	if err := validateRun(cfg, syncOptions{apply: true}); err != nil {
		t.Fatalf("expected development run to be allowed: %v", err)
	}
}

func TestDescribeDatabaseTargetDoesNotExposeDSN(t *testing.T) {
	cfg := &config.Config{}
	cfg.Database.Driver = "postgres"
	cfg.Database.DSN = "postgres://user:secret@example.com/db"

	target := describeDatabaseTarget(cfg)
	if strings.Contains(target, "secret") || strings.Contains(target, "example.com") {
		t.Fatalf("target exposed DSN details: %q", target)
	}
	if !strings.Contains(target, "DSN configured") {
		t.Fatalf("expected DSN configured summary, got %q", target)
	}
}
