package dbmigration

import (
	"context"
	"database/sql"
	"errors"
	"reflect"
	"strings"
	"testing"

	"github.com/pressly/goose/v3"
)

func TestManagedDialectsHaveMatchingVersions(t *testing.T) {
	versionsByDriver := make(map[string][]int64)
	for _, driver := range []string{"postgres", "mysql"} {
		migrationProvider, err := newProvider(new(sql.DB), driver)
		if err != nil {
			t.Fatal(err)
		}
		for _, source := range migrationProvider.ListSources() {
			versionsByDriver[driver] = append(versionsByDriver[driver], source.Version)
		}
	}

	if !reflect.DeepEqual(versionsByDriver["postgres"], versionsByDriver["mysql"]) {
		t.Fatalf("managed migration versions differ: %+v", versionsByDriver)
	}
	if len(versionsByDriver["postgres"]) == 0 {
		t.Fatal("expected embedded managed migrations")
	}
	latestVersion := versionsByDriver["postgres"][len(versionsByDriver["postgres"])-1]
	if latestVersion != 202608050002 {
		t.Fatalf("unexpected latest managed migration version: %d", latestVersion)
	}
}

func TestApplyPendingSkipsUpWhenCurrent(t *testing.T) {
	migrationProvider := &fakeProvider{
		pending: false,
		version: 202607270001,
	}

	summary, err := applyPending(context.Background(), migrationProvider)
	if err != nil {
		t.Fatal(err)
	}
	if migrationProvider.upCalls != 0 {
		t.Fatalf("expected no Up call, got %d", migrationProvider.upCalls)
	}
	if summary.CurrentVersion != migrationProvider.version || len(summary.Applied) != 0 {
		t.Fatalf("unexpected summary: %+v", summary)
	}
}

func TestApplyPendingReturnsAppliedVersions(t *testing.T) {
	migrationProvider := &fakeProvider{
		pending: true,
		version: 202607270001,
		results: []*goose.MigrationResult{
			{Source: &goose.Source{Version: 202607260008, Path: "extend_workflow_triggers.sql"}},
			{Source: &goose.Source{Version: 202607260009, Path: "ensure_knowledge_embedding.sql"}},
		},
	}

	summary, err := applyPending(context.Background(), migrationProvider)
	if err != nil {
		t.Fatal(err)
	}
	if migrationProvider.upCalls != 1 || len(summary.Applied) != 2 {
		t.Fatalf("unexpected migration result: calls=%d summary=%+v", migrationProvider.upCalls, summary)
	}
}

func TestApplyPendingDoesNotHideMigrationFailure(t *testing.T) {
	migrationFailure := errors.New("migration failed")
	migrationProvider := &fakeProvider{
		pending: true,
		upErr:   migrationFailure,
	}

	_, err := applyPending(context.Background(), migrationProvider)
	if !errors.Is(err, migrationFailure) {
		t.Fatalf("got %v, want %v", err, migrationFailure)
	}
}

func TestMigrationDialectRejectsUnknownDriver(t *testing.T) {
	if _, _, err := migrationDialect("sqlite"); err == nil {
		t.Fatal("expected unsupported driver error")
	}
}

func TestEmptyDatabaseQueryUsesDriverPlaceholder(t *testing.T) {
	postgresQuery, err := emptyDatabaseQuery("postgres")
	if err != nil || !strings.Contains(postgresQuery, "$1") {
		t.Fatalf("unexpected postgres query: %q err=%v", postgresQuery, err)
	}
	mysqlQuery, err := emptyDatabaseQuery("mysql")
	if err != nil || !strings.Contains(mysqlQuery, "?") {
		t.Fatalf("unexpected mysql query: %q err=%v", mysqlQuery, err)
	}
}

func TestMySQLMigrationsUseManagedIdempotencyHelpers(t *testing.T) {
	sources, err := migrationFiles.ReadDir("mysql")
	if err != nil {
		t.Fatal(err)
	}
	for _, source := range sources {
		content, err := migrationFiles.ReadFile("mysql/" + source.Name())
		if err != nil {
			t.Fatal(err)
		}
		sqlText := string(content)
		if strings.Contains(strings.ToUpper(sqlText), "ADD COLUMN IF NOT EXISTS") {
			t.Fatalf("%s uses unsupported MySQL ADD COLUMN IF NOT EXISTS syntax", source.Name())
		}
		if strings.Count(sqlText, "-- +goose StatementBegin") != strings.Count(sqlText, "-- +goose StatementEnd") {
			t.Fatalf("%s has unbalanced Goose statement annotations", source.Name())
		}
	}
}

func TestPostgresDollarQuotedBlocksUseGooseStatementAnnotations(t *testing.T) {
	sources, err := migrationFiles.ReadDir("postgres")
	if err != nil {
		t.Fatal(err)
	}
	for _, source := range sources {
		content, err := migrationFiles.ReadFile("postgres/" + source.Name())
		if err != nil {
			t.Fatal(err)
		}
		sqlText := string(content)
		if !strings.Contains(sqlText, "DO $$") {
			continue
		}
		if strings.Count(sqlText, "-- +goose StatementBegin") != 1 ||
			strings.Count(sqlText, "-- +goose StatementEnd") != 1 {
			t.Fatalf("%s must wrap its dollar-quoted block in Goose statement annotations", source.Name())
		}
	}
}

type fakeProvider struct {
	pending bool
	version int64
	results []*goose.MigrationResult
	upErr   error
	upCalls int
}

func (provider *fakeProvider) HasPending(context.Context) (bool, error) {
	return provider.pending, nil
}

func (provider *fakeProvider) Up(context.Context) ([]*goose.MigrationResult, error) {
	provider.upCalls++
	return provider.results, provider.upErr
}

func (provider *fakeProvider) GetDBVersion(context.Context) (int64, error) {
	return provider.version, nil
}

func (provider *fakeProvider) Status(context.Context) ([]*goose.MigrationStatus, error) {
	return nil, nil
}

func (provider *fakeProvider) ListSources() []*goose.Source {
	return nil
}
