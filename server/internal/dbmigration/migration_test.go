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
	if latestVersion != 202608140001 {
		t.Fatalf("unexpected latest managed migration version: %d", latestVersion)
	}
}

func TestResourceProvenancePolicyMigrationKeepsDownloadClosedByDefault(t *testing.T) {
	for _, driver := range []string{"postgres", "mysql"} {
		content, err := migrationFiles.ReadFile(driver + "/202608140001_add_resource_provenance_policy.sql")
		if err != nil {
			t.Fatal(err)
		}
		sqlText := string(content)
		for _, expected := range []string{"source_kind", "source_url", "license", "download_allowed"} {
			if !strings.Contains(sqlText, expected) {
				t.Fatalf("%s resource provenance migration does not contain %s", driver, expected)
			}
		}
		if !strings.Contains(strings.ToUpper(sqlText), "DEFAULT FALSE") {
			t.Fatalf("%s resource download permission must default to false", driver)
		}
	}
}

func TestAIAppRunKnowledgeStatusMigrationAddsDegradationObservability(t *testing.T) {
	for _, driver := range []string{"postgres", "mysql"} {
		content, err := migrationFiles.ReadFile(driver + "/202608090003_add_ai_app_run_knowledge_status.sql")
		if err != nil {
			t.Fatal(err)
		}
		for _, expected := range []string{"knowledge_status", "knowledge_error_code"} {
			if !strings.Contains(string(content), expected) {
				t.Fatalf("%s AI app run knowledge migration does not contain %s", driver, expected)
			}
		}
	}
}

func TestAIMotionStickerImageModeMigrationAddsDualModeContract(t *testing.T) {
	for _, driver := range []string{"postgres", "mysql"} {
		content, err := migrationFiles.ReadFile(driver + "/202608090002_add_ai_motion_sticker_image_mode.sql")
		if err != nil {
			t.Fatal(err)
		}
		for _, expected := range []string{"generation_mode", "image_protocol", "frame_count"} {
			if !strings.Contains(string(content), expected) {
				t.Fatalf("%s motion sticker image migration does not contain %s", driver, expected)
			}
		}
	}
}

func TestAIKnowledgeEmbeddingIdentityMigrationInvalidatesLegacyVectors(t *testing.T) {
	for _, driver := range []string{"postgres", "mysql"} {
		content, err := migrationFiles.ReadFile(driver + "/202608090001_add_ai_knowledge_embedding_identity.sql")
		if err != nil {
			t.Fatal(err)
		}
		sqlText := string(content)
		for _, expected := range []string{"embedding_model_id", "embedding_dimension"} {
			if !strings.Contains(sqlText, expected) {
				t.Fatalf("%s knowledge embedding identity migration does not contain %s", driver, expected)
			}
		}
	}
	postgres, err := migrationFiles.ReadFile("postgres/202608090001_add_ai_knowledge_embedding_identity.sql")
	if err != nil {
		t.Fatal(err)
	}
	for _, expected := range []string{"RAG_EMBEDDING_REINDEX_REQUIRED", "ai_knowledge_chunks"} {
		if !strings.Contains(string(postgres), expected) {
			t.Fatalf("postgres knowledge embedding identity migration does not contain %s", expected)
		}
	}
}

func TestAIMotionStickerMigrationCreatesDurableJobSchema(t *testing.T) {
	for _, driver := range []string{"postgres", "mysql"} {
		content, err := migrationFiles.ReadFile(driver + "/202608080005_add_ai_motion_stickers.sql")
		if err != nil {
			t.Fatal(err)
		}
		sqlText := string(content)
		for _, expected := range []string{"video_protocol", "ai_motion_sticker_generations", "provider_task_id", "gif_storage_key"} {
			if !strings.Contains(sqlText, expected) {
				t.Fatalf("%s motion sticker migration does not contain %s", driver, expected)
			}
		}
	}
}

func TestAIAppTaskInteractionMigrationPersistsClarificationsAndToolErrors(t *testing.T) {
	for _, driver := range []string{"postgres", "mysql"} {
		content, err := migrationFiles.ReadFile(driver + "/202608080006_add_ai_app_task_interactions.sql")
		if err != nil {
			t.Fatal(err)
		}
		sqlText := string(content)
		for _, expected := range []string{"ai_app_task_clarifications", "request_id", "error_code", "error_message", "retryable"} {
			if !strings.Contains(sqlText, expected) {
				t.Fatalf("%s task interaction migration does not contain %s", driver, expected)
			}
		}
	}
}

func TestAICanvasDocumentMigrationPersistsOneRevisionedWorkspacePerOwner(t *testing.T) {
	for _, driver := range []string{"postgres", "mysql"} {
		content, err := migrationFiles.ReadFile(driver + "/202608080007_add_ai_canvas_documents.sql")
		if err != nil {
			t.Fatal(err)
		}
		sqlText := string(content)
		for _, expected := range []string{"ai_canvas_documents", "document_json", "revision", "uidx_ai_canvas_documents_user"} {
			if !strings.Contains(sqlText, expected) {
				t.Fatalf("%s AI canvas migration does not contain %s", driver, expected)
			}
		}
	}
}

func TestAIImageVariationRepairMigrationRestoresEveryManagedColumn(t *testing.T) {
	for _, driver := range []string{"postgres", "mysql"} {
		content, err := migrationFiles.ReadFile(driver + "/202608080003_repair_ai_image_variation_columns.sql")
		if err != nil {
			t.Fatal(err)
		}
		sqlText := string(content)
		for _, column := range []string{"variation_mode", "variation_seed", "variation_prompt", "subject_context"} {
			if !strings.Contains(sqlText, column) {
				t.Fatalf("%s repair migration does not restore %s", driver, column)
			}
		}
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
