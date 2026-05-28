package bootstrap

import (
	"os"
	"testing"
)

func TestApplyLocalEnvOverridesEnablesAutoMigrate(t *testing.T) {
	t.Setenv(localAutoMigrateFlagEnv, "true")
	t.Setenv("DB_AUTO_MIGRATE", "false")

	applyLocalEnvOverrides()

	if os.Getenv("DB_AUTO_MIGRATE") != "true" {
		t.Fatal("expected DB_AUTO_MIGRATE to be true")
	}
}

func TestApplyLocalEnvOverridesLeavesAutoMigrateUnchangedByDefault(t *testing.T) {
	t.Setenv(localAutoMigrateFlagEnv, "")
	t.Setenv("DB_AUTO_MIGRATE", "false")

	applyLocalEnvOverrides()

	if os.Getenv("DB_AUTO_MIGRATE") != "false" {
		t.Fatal("expected DB_AUTO_MIGRATE to stay false")
	}
}
