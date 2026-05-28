package main

import (
	"os"
	"testing"
)

func TestApplyLocalStartupArgsEnablesAutoMigrateFlag(t *testing.T) {
	t.Setenv(localAutoMigrateFlagEnv, "")

	applyLocalStartupArgs([]string{"db=true"})

	if os.Getenv(localAutoMigrateFlagEnv) != "true" {
		t.Fatalf("expected %s to be true", localAutoMigrateFlagEnv)
	}
}

func TestApplyLocalStartupArgsLeavesAutoMigrateFlagOffByDefault(t *testing.T) {
	t.Setenv(localAutoMigrateFlagEnv, "")

	applyLocalStartupArgs(nil)

	if os.Getenv(localAutoMigrateFlagEnv) != "" {
		t.Fatalf("expected %s to stay empty", localAutoMigrateFlagEnv)
	}
}
