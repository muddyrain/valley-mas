package main

import (
	"flag"
	"fmt"
	"io"
	"log"
	"os"
	"strings"

	"valley-server/internal/config"
	"valley-server/internal/database"
	"valley-server/internal/workflowpurge"

	"github.com/joho/godotenv"
)

const confirmation = "DELETE_LEGACY_WORKFLOWS"

func main() {
	if err := run(os.Args[1:], os.Stdout); err != nil {
		log.Fatal(err)
	}
}

func run(args []string, out io.Writer) error {
	flags := flag.NewFlagSet("purge-legacy-workflows", flag.ContinueOnError)
	flags.SetOutput(out)
	dryRun := flags.Bool("dry-run", false, "inspect only; this is also the default")
	confirm := flags.String("confirm", "", "must equal "+confirmation+" to hard-delete legacy workflow data")
	if err := flags.Parse(args); err != nil {
		return err
	}
	_ = godotenv.Load()
	cfg := config.Load()
	if !strings.EqualFold(strings.TrimSpace(cfg.Env), "development") {
		return fmt.Errorf("refusing to purge: ENV must be development")
	}
	if *confirm != "" && *confirm != confirmation {
		return fmt.Errorf("confirmation token mismatch")
	}
	apply := *confirm == confirmation
	if !apply && !*dryRun {
		fmt.Fprintln(out, "defaulting to dry-run")
	}
	cfg.Database.AutoMigrate = false
	if err := database.Init(cfg); err != nil {
		return err
	}
	defer database.Close()
	report, err := workflowpurge.Inspect(database.DB)
	if err != nil {
		return err
	}
	for _, key := range workflowpurge.SortedReportKeys(report) {
		fmt.Fprintf(out, "%s: %d\n", key, report[key])
	}
	if !apply {
		fmt.Fprintln(out, "dry-run complete; no rows changed")
		return nil
	}
	if _, err := workflowpurge.Purge(database.DB); err != nil {
		return err
	}
	fmt.Fprintln(out, "legacy workflow purge complete")
	return nil
}
