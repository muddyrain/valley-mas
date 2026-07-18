package main

import (
	"bytes"
	"strings"
	"testing"
)

func TestRunRejectsNonDevelopmentEnvironment(t *testing.T) {
	t.Setenv("ENV", "production")
	err := run([]string{"--dry-run"}, &bytes.Buffer{})
	if err == nil || !strings.Contains(err.Error(), "ENV must be development") {
		t.Fatalf("err=%v", err)
	}
}

func TestRunRejectsWrongConfirmation(t *testing.T) {
	t.Setenv("ENV", "development")
	err := run([]string{"--confirm", "wrong"}, &bytes.Buffer{})
	if err == nil || !strings.Contains(err.Error(), "confirmation token mismatch") {
		t.Fatalf("err=%v", err)
	}
}
