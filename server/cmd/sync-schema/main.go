package main

import (
	"bytes"
	"flag"
	"fmt"
	"io"
	"log"
	"os"
	"strings"
	"valley-server/internal/config"
	"valley-server/internal/database"
	"valley-server/internal/utils"

	"github.com/joho/godotenv"
)

func main() {
	if err := run(os.Args[1:], os.Stdout); err != nil {
		log.Fatal(err)
	}
}

func run(args []string, out io.Writer) error {
	options, err := parseOptions(args, out)
	if err != nil {
		return err
	}

	loadEnv()

	cfg := config.Load()
	if !options.apply {
		fmt.Fprintf(out, "dry run only: no database changes will be applied\n")
		fmt.Fprintf(out, "target: %s\n", describeDatabaseTarget(cfg))
		fmt.Fprintf(out, "scope: %s\n", describeSyncSelection(options))
		fmt.Fprintf(out, "rerun with --apply plus --models or --scope to run GORM AutoMigrate against the configured database\n")
		return nil
	}

	if err := validateRun(cfg, options); err != nil {
		return err
	}

	if err := utils.InitSnowflake(1); err != nil {
		return err
	}

	cfg.Database.AutoMigrate = false
	fmt.Fprintf(out, "syncing database schema via scoped GORM AutoMigrate\n")
	fmt.Fprintf(out, "target: %s\n", describeDatabaseTarget(cfg))
	fmt.Fprintf(out, "scope: %s\n", describeSyncSelection(options))

	if err := database.Init(cfg); err != nil {
		return err
	}
	defer database.Close()

	if len(options.models) > 0 {
		if err := database.AutoMigrateModels(options.models); err != nil {
			return err
		}
	} else if err := database.AutoMigrate(options.scope); err != nil {
		return err
	}

	fmt.Fprintln(out, "schema sync complete")
	return nil
}

type syncOptions struct {
	apply           bool
	allowProduction bool
	scope           string
	models          []string
}

func parseOptions(args []string, out io.Writer) (syncOptions, error) {
	var options syncOptions
	flags := flag.NewFlagSet("sync-schema", flag.ContinueOnError)
	flags.SetOutput(out)
	flags.BoolVar(&options.apply, "apply", false, "apply GORM AutoMigrate to the configured database")
	flags.BoolVar(&options.allowProduction, "allow-production", false, "allow running when ENV=production")
	flags.StringVar(&options.scope, "scope", "", "migration scope: lifetrace, content, core, or all")
	modelNames := flags.String("models", "", "comma-separated model aliases, for example: places,ledger,closet")
	if err := flags.Parse(args); err != nil {
		return options, err
	}
	options.models = splitCommaList(*modelNames)
	if options.scope != "" {
		scope, err := database.NormalizeAutoMigrateScope(options.scope)
		if err != nil {
			return options, err
		}
		options.scope = scope
	}
	if len(options.models) > 0 {
		models, err := database.NormalizeAutoMigrateModelNames(options.models)
		if err != nil {
			return options, err
		}
		options.models = models
	}
	return options, nil
}

func validateRun(cfg *config.Config, options syncOptions) error {
	if strings.EqualFold(strings.TrimSpace(cfg.Env), "production") && !options.allowProduction {
		return fmt.Errorf("refusing to sync schema in production without --allow-production")
	}
	if options.scope != "" && len(options.models) > 0 {
		return fmt.Errorf("choose either --models or --scope, not both")
	}
	if options.scope == "" && len(options.models) == 0 {
		return fmt.Errorf("refusing to run without an explicit migration target; pass --models places,ledger or --scope lifetrace")
	}
	if options.scope != "" {
		if _, err := database.NormalizeAutoMigrateScope(options.scope); err != nil {
			return err
		}
	}
	if len(options.models) > 0 {
		if _, err := database.NormalizeAutoMigrateModelNames(options.models); err != nil {
			return err
		}
	}
	return nil
}

func describeSyncSelection(options syncOptions) string {
	if len(options.models) > 0 {
		return fmt.Sprintf("models:%s", strings.Join(options.models, ","))
	}
	if options.scope != "" {
		return options.scope
	}
	return "none"
}

func splitCommaList(value string) []string {
	parts := strings.Split(value, ",")
	items := make([]string, 0, len(parts))
	for _, part := range parts {
		part = strings.TrimSpace(part)
		if part != "" {
			items = append(items, part)
		}
	}
	return items
}

func describeDatabaseTarget(cfg *config.Config) string {
	if cfg.Database.DSN != "" {
		return fmt.Sprintf("%s DSN configured", cfg.Database.Driver)
	}
	return fmt.Sprintf(
		"%s %s:%s/%s",
		cfg.Database.Driver,
		cfg.Database.Host,
		cfg.Database.Port,
		cfg.Database.DBName,
	)
}

func loadEnv() {
	envCandidates := []string{".env", "server/.env", "./server/.env", "../server/.env"}
	for _, p := range envCandidates {
		if _, err := os.Stat(p); err != nil {
			continue
		}
		if err := loadEnvFileCompat(p); err == nil {
			log.Printf("Loaded env file: %s", p)
			return
		}
	}
	log.Println("No .env file found, using system environment variables")
}

func loadEnvFileCompat(path string) error {
	content, err := os.ReadFile(path)
	if err != nil {
		return err
	}
	content = bytes.TrimPrefix(content, []byte{0xEF, 0xBB, 0xBF})

	values, err := godotenv.Unmarshal(string(content))
	if err != nil {
		return err
	}
	for key, value := range values {
		if err := os.Setenv(key, value); err != nil {
			return err
		}
	}
	return nil
}
