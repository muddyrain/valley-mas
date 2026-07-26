package dbmigration

import (
	"context"
	"database/sql"
	"embed"
	"errors"
	"fmt"
	"io/fs"
	"strings"
	"time"

	"github.com/pressly/goose/v3"
	goosedatabase "github.com/pressly/goose/v3/database"
	"github.com/pressly/goose/v3/lock"
)

const VersionTable = "schema_migrations"

var ErrBootstrapRequired = errors.New("database bootstrap required")
var ErrDatabaseNotEmpty = errors.New("database is not empty")

//go:embed postgres/*.sql mysql/*.sql
var migrationFiles embed.FS

type AppliedMigration struct {
	Version  int64
	Path     string
	Duration time.Duration
}

type Summary struct {
	Applied        []AppliedMigration
	CurrentVersion int64
}

type MigrationStatus struct {
	Version   int64
	Path      string
	State     string
	AppliedAt time.Time
}

type provider interface {
	HasPending(ctx context.Context) (bool, error)
	Up(ctx context.Context) ([]*goose.MigrationResult, error)
	GetDBVersion(ctx context.Context) (int64, error)
	Status(ctx context.Context) ([]*goose.MigrationStatus, error)
	ListSources() []*goose.Source
}

// Up applies only pending, reviewed migrations. It refuses an empty database
// because the historical SQL directory is intentionally not replayable.
func Up(ctx context.Context, db *sql.DB, driver string) (Summary, error) {
	ready, err := applicationSchemaExists(ctx, db, driver)
	if err != nil {
		return Summary{}, err
	}
	if !ready {
		return Summary{}, fmt.Errorf(
			"%w: run `go run ./cmd/migrate bootstrap --apply` once from the server directory",
			ErrBootstrapRequired,
		)
	}

	migrationProvider, err := newProvider(db, driver)
	if err != nil {
		return Summary{}, err
	}
	return applyPending(ctx, migrationProvider)
}

// RequireEmpty protects the one-time GORM bootstrap from being used as a
// general schema repair command. The managed version table itself is ignored
// because status/version checks may create it before bootstrap.
func RequireEmpty(ctx context.Context, db *sql.DB, driver string) error {
	query, err := emptyDatabaseQuery(driver)
	if err != nil {
		return err
	}

	var empty bool
	if err := db.QueryRowContext(ctx, query, VersionTable).Scan(&empty); err != nil {
		return fmt.Errorf("check empty database: %w", err)
	}
	if !empty {
		return fmt.Errorf("%w: use `go run ./cmd/migrate up` for an existing database", ErrDatabaseNotEmpty)
	}
	return nil
}

func emptyDatabaseQuery(driver string) (string, error) {
	switch strings.ToLower(strings.TrimSpace(driver)) {
	case "postgres", "pgx":
		return `
			SELECT COUNT(*) = 0
			FROM information_schema.tables
			WHERE table_schema = current_schema()
			  AND table_type = 'BASE TABLE'
			  AND table_name <> $1`, nil
	case "mysql":
		return `
			SELECT COUNT(*) = 0
			FROM information_schema.tables
			WHERE table_schema = DATABASE()
			  AND table_type = 'BASE TABLE'
			  AND table_name <> ?`, nil
	default:
		return "", fmt.Errorf("unsupported migration driver %q", driver)
	}
}

func Status(ctx context.Context, db *sql.DB, driver string) ([]MigrationStatus, error) {
	migrationProvider, err := newProvider(db, driver)
	if err != nil {
		return nil, err
	}
	statuses, err := migrationProvider.Status(ctx)
	if err != nil {
		return nil, fmt.Errorf("load migration status: %w", err)
	}

	result := make([]MigrationStatus, 0, len(statuses))
	for _, status := range statuses {
		result = append(result, MigrationStatus{
			Version:   status.Source.Version,
			Path:      status.Source.Path,
			State:     string(status.State),
			AppliedAt: status.AppliedAt,
		})
	}
	return result, nil
}

func Version(ctx context.Context, db *sql.DB, driver string) (int64, error) {
	migrationProvider, err := newProvider(db, driver)
	if err != nil {
		return 0, err
	}
	version, err := migrationProvider.GetDBVersion(ctx)
	if err != nil {
		return 0, fmt.Errorf("load migration version: %w", err)
	}
	return version, nil
}

func applyPending(ctx context.Context, migrationProvider provider) (Summary, error) {
	pending, err := migrationProvider.HasPending(ctx)
	if err != nil {
		return Summary{}, fmt.Errorf("check pending migrations: %w", err)
	}

	var results []*goose.MigrationResult
	if pending {
		results, err = migrationProvider.Up(ctx)
		if err != nil {
			return Summary{}, fmt.Errorf("apply pending migrations: %w", err)
		}
	}

	version, err := migrationProvider.GetDBVersion(ctx)
	if err != nil {
		return Summary{}, fmt.Errorf("load migration version: %w", err)
	}

	summary := Summary{
		Applied:        make([]AppliedMigration, 0, len(results)),
		CurrentVersion: version,
	}
	for _, result := range results {
		summary.Applied = append(summary.Applied, AppliedMigration{
			Version:  result.Source.Version,
			Path:     result.Source.Path,
			Duration: result.Duration,
		})
	}
	return summary, nil
}

func newProvider(db *sql.DB, driver string) (provider, error) {
	dialect, directory, err := migrationDialect(driver)
	if err != nil {
		return nil, err
	}
	subFS, err := fs.Sub(migrationFiles, directory)
	if err != nil {
		return nil, fmt.Errorf("open embedded %s migrations: %w", directory, err)
	}

	store, err := goosedatabase.NewStore(dialect, VersionTable)
	if err != nil {
		return nil, fmt.Errorf("create migration version store: %w", err)
	}
	options := []goose.ProviderOption{
		goose.WithStore(store),
		goose.WithDisableGlobalRegistry(true),
	}
	if dialect == goosedatabase.DialectPostgres {
		sessionLocker, err := lock.NewPostgresSessionLocker(
			lock.WithLockTimeout(1, 30),
			lock.WithUnlockTimeout(1, 10),
		)
		if err != nil {
			return nil, fmt.Errorf("create postgres migration lock: %w", err)
		}
		options = append(options, goose.WithSessionLocker(sessionLocker))
	}

	migrationProvider, err := goose.NewProvider("", db, subFS, options...)
	if err != nil {
		return nil, fmt.Errorf("create migration provider: %w", err)
	}
	return migrationProvider, nil
}

func migrationDialect(driver string) (goosedatabase.Dialect, string, error) {
	switch strings.ToLower(strings.TrimSpace(driver)) {
	case "postgres", "pgx":
		return goosedatabase.DialectPostgres, "postgres", nil
	case "mysql":
		return goosedatabase.DialectMySQL, "mysql", nil
	default:
		return "", "", fmt.Errorf("unsupported migration driver %q", driver)
	}
}

func applicationSchemaExists(ctx context.Context, db *sql.DB, driver string) (bool, error) {
	var query string
	switch strings.ToLower(strings.TrimSpace(driver)) {
	case "postgres", "pgx":
		query = `
			SELECT EXISTS (
				SELECT 1
				FROM information_schema.tables
				WHERE table_schema = current_schema()
				  AND table_name = 'users'
			)`
	case "mysql":
		query = `
			SELECT EXISTS (
				SELECT 1
				FROM information_schema.tables
				WHERE table_schema = DATABASE()
				  AND table_name = 'users'
			)`
	default:
		return false, fmt.Errorf("unsupported migration driver %q", driver)
	}

	var exists bool
	if err := db.QueryRowContext(ctx, query).Scan(&exists); err != nil {
		return false, fmt.Errorf("check application schema: %w", err)
	}
	return exists, nil
}
