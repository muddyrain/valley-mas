package main

import (
	"context"
	"flag"
	"fmt"
	"io"
	"log"
	"os"
	"strings"
	"time"

	"valley-server/internal/config"
	"valley-server/internal/database"
	"valley-server/internal/dbmigration"
	"valley-server/internal/envfile"
	"valley-server/internal/utils"
)

func main() {
	if err := run(os.Args[1:], os.Stdout); err != nil {
		log.Fatal(err)
	}
}

type options struct {
	command         string
	apply           bool
	allowProduction bool
}

func run(args []string, out io.Writer) error {
	options, err := parseOptions(args, out)
	if err != nil {
		return err
	}

	if path, err := envfile.Load(); err != nil {
		return fmt.Errorf("load environment file: %w", err)
	} else if path != "" {
		fmt.Fprintf(out, "loaded environment: %s\n", path)
	}
	cfg := config.Load()
	if err := validateRun(cfg, options); err != nil {
		return err
	}

	if err := database.Init(cfg); err != nil {
		return err
	}
	defer database.Close()
	sqlDB, err := database.SQLDB()
	if err != nil {
		return err
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Minute)
	defer cancel()

	switch options.command {
	case "up":
		summary, err := dbmigration.Up(ctx, sqlDB, cfg.Database.Driver)
		if err != nil {
			return err
		}
		printSummary(out, summary)
	case "status":
		statuses, err := dbmigration.Status(ctx, sqlDB, cfg.Database.Driver)
		if err != nil {
			return err
		}
		for _, status := range statuses {
			appliedAt := "-"
			if !status.AppliedAt.IsZero() {
				appliedAt = status.AppliedAt.Format(time.RFC3339)
			}
			fmt.Fprintf(out, "%d\t%s\t%s\t%s\n", status.Version, status.State, appliedAt, status.Path)
		}
	case "version":
		version, err := dbmigration.Version(ctx, sqlDB, cfg.Database.Driver)
		if err != nil {
			return err
		}
		fmt.Fprintf(out, "database migration version: %d\n", version)
	case "bootstrap":
		if err := dbmigration.RequireEmpty(ctx, sqlDB, cfg.Database.Driver); err != nil {
			return err
		}
		if err := utils.InitSnowflake(1); err != nil {
			return err
		}
		fmt.Fprintln(out, "bootstrapping empty development database via one-time GORM AutoMigrate")
		if err := database.AutoMigrate(database.AutoMigrateScopeAll); err != nil {
			return fmt.Errorf("bootstrap database schema: %w", err)
		}
		summary, err := dbmigration.Up(ctx, sqlDB, cfg.Database.Driver)
		if err != nil {
			return err
		}
		printSummary(out, summary)
	}
	return nil
}

func parseOptions(args []string, out io.Writer) (options, error) {
	if len(args) == 0 {
		return options{}, fmt.Errorf("migration command required: up, status, version, or bootstrap")
	}

	parsed := options{command: strings.ToLower(strings.TrimSpace(args[0]))}
	flags := flag.NewFlagSet("migrate "+parsed.command, flag.ContinueOnError)
	flags.SetOutput(out)
	flags.BoolVar(&parsed.apply, "apply", false, "confirm the one-time empty database bootstrap")
	flags.BoolVar(&parsed.allowProduction, "allow-production", false, "allow applying pending migrations when ENV=production")
	if err := flags.Parse(args[1:]); err != nil {
		return options{}, err
	}
	switch parsed.command {
	case "up", "status", "version", "bootstrap":
		return parsed, nil
	default:
		return options{}, fmt.Errorf("unsupported migration command %q", parsed.command)
	}
}

func validateRun(cfg *config.Config, options options) error {
	production := strings.EqualFold(strings.TrimSpace(cfg.Env), "production")
	switch options.command {
	case "up":
		if production && !options.allowProduction {
			return fmt.Errorf("refusing to apply production migrations without --allow-production")
		}
	case "bootstrap":
		if !options.apply {
			return fmt.Errorf("refusing to bootstrap without --apply")
		}
		if production {
			return fmt.Errorf("refusing to bootstrap a production database")
		}
	}
	return nil
}

func printSummary(out io.Writer, summary dbmigration.Summary) {
	for _, migration := range summary.Applied {
		fmt.Fprintf(out, "applied %d %s (%s)\n", migration.Version, migration.Path, migration.Duration.Round(time.Millisecond))
	}
	fmt.Fprintf(out, "migrations ready: applied=%d version=%d\n", len(summary.Applied), summary.CurrentVersion)
}
