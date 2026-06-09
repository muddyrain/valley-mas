package database

import "testing"

func TestNormalizeAutoMigrateScopeDefaultsToLifeTrace(t *testing.T) {
	scope, err := NormalizeAutoMigrateScope("")
	if err != nil {
		t.Fatalf("normalize empty scope: %v", err)
	}
	if scope != AutoMigrateScopeLifeTrace {
		t.Fatalf("expected default scope %q, got %q", AutoMigrateScopeLifeTrace, scope)
	}
}

func TestNormalizeAutoMigrateScopeRejectsUnknownScope(t *testing.T) {
	if _, err := NormalizeAutoMigrateScope("unknown"); err == nil {
		t.Fatal("expected unknown scope to be rejected")
	}
}

func TestBuildAutoMigratePlanKeepsAllScopeLargest(t *testing.T) {
	allPlan, err := buildAutoMigratePlan(AutoMigrateScopeAll)
	if err != nil {
		t.Fatalf("build all plan: %v", err)
	}
	lifeTracePlan, err := buildAutoMigratePlan(AutoMigrateScopeLifeTrace)
	if err != nil {
		t.Fatalf("build lifetrace plan: %v", err)
	}

	if len(allPlan.models) <= len(lifeTracePlan.models) {
		t.Fatalf("expected all scope to include more models than lifetrace scope, got all=%d lifetrace=%d", len(allPlan.models), len(lifeTracePlan.models))
	}
	if !allPlan.fixResourceForeignKey || !allPlan.initDefaultBlogData {
		t.Fatal("expected all scope to keep historical post-migration hooks")
	}
	if lifeTracePlan.fixResourceForeignKey || lifeTracePlan.initDefaultBlogData {
		t.Fatal("expected lifetrace scope to skip content-specific post-migration hooks")
	}
}

func TestNormalizeAutoMigrateModelNamesResolvesAliases(t *testing.T) {
	names, err := NormalizeAutoMigrateModelNames([]string{"places", "ledger", "closet"})
	if err != nil {
		t.Fatalf("normalize model names: %v", err)
	}

	want := []string{"lifetrace_place", "lifetrace_ledger_entry", "lifetrace_closet_item"}
	for i := range want {
		if names[i] != want[i] {
			t.Fatalf("expected names %v, got %v", want, names)
		}
	}
}

func TestNormalizeAutoMigrateModelNamesRequiresAtLeastOneModel(t *testing.T) {
	if _, err := NormalizeAutoMigrateModelNames(nil); err == nil {
		t.Fatal("expected empty model list to be rejected")
	}
}
