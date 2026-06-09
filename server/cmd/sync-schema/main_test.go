package main

import (
	"bytes"
	"strings"
	"testing"
	"valley-server/internal/config"
	"valley-server/internal/database"
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
	if options.scope != "" {
		t.Fatalf("expected scope to default to empty, got %q", options.scope)
	}
}

func TestParseOptionsEnablesApplyAndProductionOverride(t *testing.T) {
	options, err := parseOptions([]string{"--apply", "--allow-production", "--scope", "all"}, &bytes.Buffer{})
	if err != nil {
		t.Fatalf("parse options: %v", err)
	}

	if !options.apply {
		t.Fatal("expected apply to be true")
	}
	if !options.allowProduction {
		t.Fatal("expected allow-production to be true")
	}
	if options.scope != database.AutoMigrateScopeAll {
		t.Fatalf("expected scope to be %q, got %q", database.AutoMigrateScopeAll, options.scope)
	}
}

func TestParseOptionsNormalizesModelAliases(t *testing.T) {
	options, err := parseOptions([]string{"--models", "places, ledger,closet"}, &bytes.Buffer{})
	if err != nil {
		t.Fatalf("parse options: %v", err)
	}

	want := []string{"lifetrace_place", "lifetrace_ledger_entry", "lifetrace_closet_item"}
	if strings.Join(options.models, ",") != strings.Join(want, ",") {
		t.Fatalf("expected models %v, got %v", want, options.models)
	}
}

func TestValidateRunRequiresProductionOverride(t *testing.T) {
	cfg := &config.Config{Env: "production"}

	err := validateRun(cfg, syncOptions{apply: true, scope: database.AutoMigrateScopeLifeTrace})
	if err == nil {
		t.Fatal("expected production run to require override")
	}
	if !strings.Contains(err.Error(), "--allow-production") {
		t.Fatalf("expected override hint, got %q", err.Error())
	}
}

func TestValidateRunAllowsDevelopment(t *testing.T) {
	cfg := &config.Config{Env: "development"}

	if err := validateRun(cfg, syncOptions{apply: true, models: []string{"lifetrace_place"}}); err != nil {
		t.Fatalf("expected development run to be allowed: %v", err)
	}
}

func TestValidateRunRejectsUnsupportedScope(t *testing.T) {
	cfg := &config.Config{Env: "development"}

	err := validateRun(cfg, syncOptions{apply: true, scope: "everything"})
	if err == nil {
		t.Fatal("expected unsupported scope to be rejected")
	}
	if !strings.Contains(err.Error(), "unsupported auto migrate scope") {
		t.Fatalf("expected unsupported scope error, got %q", err.Error())
	}
}

func TestValidateRunRequiresExplicitTarget(t *testing.T) {
	cfg := &config.Config{Env: "development"}

	err := validateRun(cfg, syncOptions{apply: true})
	if err == nil {
		t.Fatal("expected explicit migration target to be required")
	}
	if !strings.Contains(err.Error(), "explicit migration target") {
		t.Fatalf("expected explicit target error, got %q", err.Error())
	}
}

func TestValidateRunRejectsScopeAndModelsTogether(t *testing.T) {
	cfg := &config.Config{Env: "development"}

	err := validateRun(cfg, syncOptions{
		apply:  true,
		scope:  database.AutoMigrateScopeLifeTrace,
		models: []string{"lifetrace_place"},
	})
	if err == nil {
		t.Fatal("expected mutually exclusive targets to be rejected")
	}
	if !strings.Contains(err.Error(), "either --models or --scope") {
		t.Fatalf("expected mutual exclusion error, got %q", err.Error())
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
