package main

import (
	"bytes"
	"flag"
	"fmt"
	"log"
	"os"
	"sort"
	"strconv"
	"strings"
	"time"
	"valley-server/internal/config"
	"valley-server/internal/database"
	"valley-server/internal/model"
	"valley-server/internal/utils"

	"github.com/joho/godotenv"
	"gorm.io/gorm"
)

type backfillTarget struct {
	Record model.DownloadRecord
	UserID model.Int64String
	Source string
}

func main() {
	apply := flag.Bool("apply", false, "apply updates instead of dry run")
	userID := flag.String("user-id", "", "manual user id for targeted repair")
	resourceID := flag.String("resource-id", "", "only inspect a specific resource id")
	creatorID := flag.String("creator-id", "", "only inspect a specific creator id")
	after := flag.String("after", "", "only inspect records created at or after this time")
	before := flag.String("before", "", "only inspect records created before this time")
	windowMinutes := flag.Int("window-minutes", 5, "time window for operation-log matching")
	limit := flag.Int("limit", 200, "max orphan records to inspect per run")
	flag.Parse()

	loadEnv()

	cfg := config.Load()
	if err := utils.InitSnowflake(1); err != nil {
		panic(err)
	}
	if err := database.Init(cfg); err != nil {
		panic(err)
	}
	defer database.Close()

	db := database.GetDB()
	if db == nil {
		panic("database is not initialized")
	}

	afterTime, err := parseOptionalTime(*after)
	if err != nil {
		panic(err)
	}
	beforeTime, err := parseOptionalTime(*before)
	if err != nil {
		panic(err)
	}

	if *userID != "" {
		runManualRepair(db, *apply, *userID, *resourceID, *creatorID, afterTime, beforeTime, *limit)
		return
	}

	runAutoRepair(db, *apply, *resourceID, *creatorID, afterTime, beforeTime, *windowMinutes, *limit)
}

func runManualRepair(
	db *gorm.DB,
	apply bool,
	userID string,
	resourceID string,
	creatorID string,
	afterTime *time.Time,
	beforeTime *time.Time,
	limit int,
) {
	targetUserID, err := strconv.ParseInt(strings.TrimSpace(userID), 10, 64)
	if err != nil {
		panic(fmt.Errorf("invalid --user-id: %w", err))
	}

	var user model.User
	if err := db.Where("id = ?", targetUserID).First(&user).Error; err != nil {
		panic(fmt.Errorf("target user not found: %w", err))
	}

	records := loadOrphanRecords(db, resourceID, creatorID, afterTime, beforeTime, limit)
	if len(records) == 0 {
		fmt.Println("no orphan download records matched the current filters")
		return
	}

	fmt.Printf(
		"manual repair target user=%s nickname=%s matched_orphans=%d apply=%v\n",
		user.ID.String(),
		user.Nickname,
		len(records),
		apply,
	)
	printRecordPreview(records)

	if !apply {
		fmt.Println("dry run only: rerun with --apply to write user_id")
		return
	}

	updated := 0
	for _, record := range records {
		if err := db.Model(&model.DownloadRecord{}).
			Where("id = ? AND user_id = ?", record.ID, 0).
			Update("user_id", model.Int64String(targetUserID)).Error; err != nil {
			panic(err)
		}
		updated++
	}

	fmt.Printf("manual repair complete: updated=%d user_id=%s\n", updated, user.ID.String())
}

func runAutoRepair(
	db *gorm.DB,
	apply bool,
	resourceID string,
	creatorID string,
	afterTime *time.Time,
	beforeTime *time.Time,
	windowMinutes int,
	limit int,
) {
	records := loadOrphanRecords(db, resourceID, creatorID, afterTime, beforeTime, limit)
	if len(records) == 0 {
		fmt.Println("no orphan download records matched the current filters")
		return
	}

	window := time.Duration(windowMinutes) * time.Minute
	targets := make([]backfillTarget, 0)
	ambiguous := 0
	unmatched := 0

	for _, record := range records {
		userID, source, ok := resolveUserIDFromOperationLogs(db, record, window)
		if !ok {
			if source == "ambiguous" {
				ambiguous++
			} else {
				unmatched++
			}
			continue
		}
		targets = append(targets, backfillTarget{
			Record: record,
			UserID: userID,
			Source: source,
		})
	}

	fmt.Printf(
		"auto repair scan: scanned=%d matched=%d ambiguous=%d unmatched=%d window=%dm apply=%v\n",
		len(records),
		len(targets),
		ambiguous,
		unmatched,
		windowMinutes,
		apply,
	)
	printTargetPreview(targets)

	if !apply {
		fmt.Println("dry run only: rerun with --apply to update matched records")
		return
	}

	updated := 0
	for _, target := range targets {
		if err := db.Model(&model.DownloadRecord{}).
			Where("id = ? AND user_id = ?", target.Record.ID, 0).
			Update("user_id", target.UserID).Error; err != nil {
			panic(err)
		}
		updated++
	}

	fmt.Printf("auto repair complete: updated=%d\n", updated)
}

func loadOrphanRecords(
	db *gorm.DB,
	resourceID string,
	creatorID string,
	afterTime *time.Time,
	beforeTime *time.Time,
	limit int,
) []model.DownloadRecord {
	query := db.Model(&model.DownloadRecord{}).
		Where("user_id = ?", 0).
		Order("created_at DESC")

	if resourceID != "" {
		query = query.Where("resource_id = ?", resourceID)
	}
	if creatorID != "" {
		query = query.Where("creator_id = ?", creatorID)
	}
	if afterTime != nil {
		query = query.Where("created_at >= ?", *afterTime)
	}
	if beforeTime != nil {
		query = query.Where("created_at < ?", *beforeTime)
	}
	if limit > 0 {
		query = query.Limit(limit)
	}

	var records []model.DownloadRecord
	if err := query.Find(&records).Error; err != nil {
		panic(err)
	}
	return records
}

func resolveUserIDFromOperationLogs(
	db *gorm.DB,
	record model.DownloadRecord,
	window time.Duration,
) (model.Int64String, string, bool) {
	path := fmt.Sprintf("/api/v1/public/resource/%s/download", record.ResourceID.String())
	start := record.CreatedAt.Add(-window)
	end := record.CreatedAt.Add(window)

	var logs []model.OperationLog
	if err := db.Where(
		"method = ? AND path = ? AND ip = ? AND user_agent = ? AND user_id <> '' AND created_at BETWEEN ? AND ?",
		"POST",
		path,
		record.IP,
		record.UserAgent,
		start,
		end,
	).Order("created_at ASC").Find(&logs).Error; err != nil {
		panic(err)
	}

	if len(logs) == 0 {
		return 0, "unmatched", false
	}

	distinct := map[string]struct{}{}
	for _, item := range logs {
		uid := strings.TrimSpace(item.UserID)
		if uid == "" || uid == "0" {
			continue
		}
		distinct[uid] = struct{}{}
	}

	if len(distinct) == 0 {
		return 0, "unmatched", false
	}
	if len(distinct) > 1 {
		return 0, "ambiguous", false
	}

	for uid := range distinct {
		value, err := strconv.ParseInt(uid, 10, 64)
		if err != nil {
			return 0, "unmatched", false
		}
		return model.Int64String(value), "operation_log", true
	}

	return 0, "unmatched", false
}

func printRecordPreview(records []model.DownloadRecord) {
	max := min(len(records), 10)
	for i := 0; i < max; i++ {
		record := records[i]
		fmt.Printf(
			"  record=%s resource=%s creator=%s created_at=%s ip=%s\n",
			record.ID.String(),
			record.ResourceID.String(),
			record.CreatorID.String(),
			record.CreatedAt.Format(time.RFC3339),
			record.IP,
		)
	}
	if len(records) > max {
		fmt.Printf("  ... %d more records omitted\n", len(records)-max)
	}
}

func printTargetPreview(targets []backfillTarget) {
	if len(targets) == 0 {
		return
	}

	sorted := append([]backfillTarget(nil), targets...)
	sort.Slice(sorted, func(i, j int) bool {
		return sorted[i].Record.CreatedAt.After(sorted[j].Record.CreatedAt)
	})

	max := min(len(sorted), 10)
	for i := 0; i < max; i++ {
		target := sorted[i]
		fmt.Printf(
			"  record=%s -> user=%s resource=%s created_at=%s source=%s\n",
			target.Record.ID.String(),
			target.UserID.String(),
			target.Record.ResourceID.String(),
			target.Record.CreatedAt.Format(time.RFC3339),
			target.Source,
		)
	}
	if len(sorted) > max {
		fmt.Printf("  ... %d more matched records omitted\n", len(sorted)-max)
	}
}

func parseOptionalTime(value string) (*time.Time, error) {
	value = strings.TrimSpace(value)
	if value == "" {
		return nil, nil
	}

	layouts := []string{
		time.RFC3339,
		"2006-01-02 15:04:05",
		"2006-01-02 15:04",
		"2006-01-02",
	}

	for _, layout := range layouts {
		if parsed, err := time.ParseInLocation(layout, value, time.Local); err == nil {
			return &parsed, nil
		}
	}

	return nil, fmt.Errorf("unsupported time format: %s", value)
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

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
