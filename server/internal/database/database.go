package database

import (
	"fmt"
	"log"
	"os"
	"strings"
	"time"
	"valley-server/internal/config"
	"valley-server/internal/model"
	"valley-server/internal/utils"

	mysqlDriver "gorm.io/driver/mysql"
	postgresDriver "gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

var DB *gorm.DB

const (
	AutoMigrateScopeAll       = "all"
	AutoMigrateScopeCore      = "core"
	AutoMigrateScopeContent   = "content"
	AutoMigrateScopeLifeTrace = "lifetrace"
	legacyCopilotTargetIndex  = "uidx_workbench_copilot_target"
)

// Init initializes database connection and migrations.
func Init(cfg *config.Config) error {
	var err error
	var dialector gorm.Dialector

	switch cfg.Database.Driver {
	case "mysql":
		dialector, err = initMySQL(cfg)
	case "postgres":
		dialector, err = initPostgres(cfg)
	default:
		return fmt.Errorf("unsupported database driver: %s (supported: postgres, mysql)", cfg.Database.Driver)
	}
	if err != nil {
		return err
	}

	gormLogger := logger.New(
		log.New(os.Stdout, "\r\n", log.LstdFlags),
		logger.Config{
			SlowThreshold:             time.Duration(cfg.Database.SlowLogMs) * time.Millisecond,
			LogLevel:                  logger.Warn,
			IgnoreRecordNotFoundError: true,
			Colorful:                  cfg.Env != "production",
		},
	)

	DB, err = gorm.Open(dialector, &gorm.Config{
		Logger:                                   gormLogger,
		DisableForeignKeyConstraintWhenMigrating: true,
	})
	if err != nil {
		return fmt.Errorf("failed to connect database: %w", err)
	}

	sqlDB, err := DB.DB()
	if err != nil {
		return fmt.Errorf("failed to get sql db handle: %w", err)
	}

	// 对 Supabase / 远程 PostgreSQL 默认收紧连接池，避免 session pool 被单进程占满。
	sqlDB.SetMaxOpenConns(cfg.Database.MaxOpenConns)
	sqlDB.SetMaxIdleConns(cfg.Database.MaxIdleConns)
	sqlDB.SetConnMaxLifetime(time.Duration(cfg.Database.ConnMaxLifetimeMin) * time.Minute)
	sqlDB.SetConnMaxIdleTime(time.Duration(cfg.Database.ConnMaxIdleTimeMin) * time.Minute)

	if err := sqlDB.Ping(); err != nil {
		return fmt.Errorf("failed to ping database: %w", err)
	}

	if cfg.Database.AutoMigrate {
		if err := AutoMigrate(AutoMigrateScopeAll); err != nil {
			return fmt.Errorf("failed to migrate database: %w", err)
		}
	} else {
		log.Printf("Auto migrate skipped (DB_AUTO_MIGRATE=false)")
	}

	log.Printf(
		"Database connected successfully (driver: %s, max_open=%d, max_idle=%d, lifetime_min=%d, idle_min=%d)",
		cfg.Database.Driver,
		cfg.Database.MaxOpenConns,
		cfg.Database.MaxIdleConns,
		cfg.Database.ConnMaxLifetimeMin,
		cfg.Database.ConnMaxIdleTimeMin,
	)
	return nil
}

func initMySQL(cfg *config.Config) (gorm.Dialector, error) {
	if cfg.Database.DSN != "" {
		log.Printf("Connecting to MySQL by DSN")
		return mysqlDriver.Open(cfg.Database.DSN), nil
	}

	dsn := fmt.Sprintf(
		"%s:%s@tcp(%s:%s)/%s?charset=utf8mb4&parseTime=True&loc=Local",
		cfg.Database.User,
		cfg.Database.Password,
		cfg.Database.Host,
		cfg.Database.Port,
		cfg.Database.DBName,
	)
	log.Printf("Connecting to MySQL: %s:%s/%s", cfg.Database.Host, cfg.Database.Port, cfg.Database.DBName)
	return mysqlDriver.Open(dsn), nil
}

func initPostgres(cfg *config.Config) (gorm.Dialector, error) {
	if cfg.Database.DSN != "" {
		log.Printf("Connecting to PostgreSQL by DSN")
		return postgresDriver.Open(cfg.Database.DSN), nil
	}

	dsn := fmt.Sprintf(
		"host=%s port=%s user=%s password=%s dbname=%s sslmode=require",
		cfg.Database.Host,
		cfg.Database.Port,
		cfg.Database.User,
		cfg.Database.Password,
		cfg.Database.DBName,
	)
	log.Printf("Connecting to PostgreSQL: %s:%s/%s", cfg.Database.Host, cfg.Database.Port, cfg.Database.DBName)
	return postgresDriver.Open(dsn), nil
}

func AutoMigrate(scope string) error {
	plan, err := buildAutoMigratePlan(scope)
	if err != nil {
		return err
	}

	log.Printf("Auto migrate started (scope=%s, models=%d)", plan.scope, len(plan.models))
	if err := DB.AutoMigrate(plan.models...); err != nil {
		return err
	}
	if err := backfillLegacyPublishedWorkflowVersions(); err != nil {
		return err
	}
	if err := dropLegacyCopilotTargetUniqueness(); err != nil {
		return err
	}

	if plan.fixResourceForeignKey {
		if err := fixResourceForeignKeyConstraint(); err != nil {
			// Do not block startup because of historical dirty data.
			log.Printf("warn: fix resource foreign key skipped: %v", err)
		}
	}

	if plan.initDefaultBlogData {
		if err := initDefaultBlogData(); err != nil {
			return err
		}
	}

	log.Printf("Auto migrate completed (scope=%s)", plan.scope)
	return nil
}

func AutoMigrateModels(names []string) error {
	models, normalizedNames, err := migrationModelsByName(names)
	if err != nil {
		return err
	}

	log.Printf("Auto migrate started (models=%s)", strings.Join(normalizedNames, ","))
	if err := DB.AutoMigrate(models...); err != nil {
		return err
	}
	if err := backfillLegacyPublishedWorkflowVersions(); err != nil {
		return err
	}
	if err := dropLegacyCopilotTargetUniqueness(); err != nil {
		return err
	}

	log.Printf("Auto migrate completed (models=%s)", strings.Join(normalizedNames, ","))
	return nil
}

// backfillLegacyPublishedWorkflowVersions preserves existing subworkflow
// references created before AIAppVersion tracked publication per version. A
// legacy published workflow could have several historical snapshots but only
// one mutable app-level pointer, so every snapshot through that pointer is
// treated as a formerly published version. New drafts are always created after
// the pointer and therefore remain unpublishable until an explicit publish.
func backfillLegacyPublishedWorkflowVersions() error {
	if DB == nil || !DB.Migrator().HasTable(&model.AIApp{}) || !DB.Migrator().HasTable(&model.AIAppVersion{}) {
		return nil
	}
	var apps []model.AIApp
	if err := DB.Where("type = ? AND status = ? AND published_version_id <> ?", "workflow", "published", 0).Find(&apps).Error; err != nil {
		return fmt.Errorf("load legacy published workflows: %w", err)
	}
	for _, app := range apps {
		var published model.AIAppVersion
		if err := DB.Where("id = ? AND app_id = ?", app.PublishedVersionID, app.ID).First(&published).Error; err != nil {
			return fmt.Errorf("load legacy published workflow version: %w", err)
		}
		publishedAt := app.UpdatedAt
		if publishedAt.IsZero() {
			publishedAt = time.Now()
		}
		if err := DB.Model(&model.AIAppVersion{}).
			Where("app_id = ? AND number <= ? AND published_at IS NULL", app.ID, published.Number).
			Update("published_at", publishedAt).Error; err != nil {
			return fmt.Errorf("backfill legacy published workflow versions: %w", err)
		}
	}
	return nil
}

func dropLegacyCopilotTargetUniqueness() error {
	if DB == nil || !DB.Migrator().HasTable(&model.AIWorkbenchCopilotSession{}) {
		return nil
	}

	switch DB.Dialector.Name() {
	case "postgres":
		if err := DB.Exec(`ALTER TABLE ai_workbench_copilot_sessions DROP CONSTRAINT IF EXISTS uidx_workbench_copilot_target`).Error; err != nil {
			return fmt.Errorf("drop legacy copilot target constraint: %w", err)
		}
		if err := DB.Exec(`DROP INDEX IF EXISTS uidx_workbench_copilot_target`).Error; err != nil {
			return fmt.Errorf("drop legacy copilot target index: %w", err)
		}
		return nil
	default:
		if !DB.Migrator().HasIndex(&model.AIWorkbenchCopilotSession{}, legacyCopilotTargetIndex) {
			return nil
		}
		if err := DB.Migrator().DropIndex(&model.AIWorkbenchCopilotSession{}, legacyCopilotTargetIndex); err != nil {
			return fmt.Errorf("drop legacy copilot target index: %w", err)
		}
		return nil
	}
}

type autoMigratePlan struct {
	scope                 string
	models                []any
	fixResourceForeignKey bool
	initDefaultBlogData   bool
}

func buildAutoMigratePlan(scope string) (autoMigratePlan, error) {
	normalizedScope, err := NormalizeAutoMigrateScope(scope)
	if err != nil {
		return autoMigratePlan{}, err
	}

	switch normalizedScope {
	case AutoMigrateScopeAll:
		return autoMigratePlan{
			scope:                 normalizedScope,
			models:                allMigrationModels(),
			fixResourceForeignKey: true,
			initDefaultBlogData:   true,
		}, nil
	case AutoMigrateScopeCore:
		return autoMigratePlan{
			scope:  normalizedScope,
			models: coreMigrationModels(),
		}, nil
	case AutoMigrateScopeContent:
		return autoMigratePlan{
			scope:                 normalizedScope,
			models:                contentMigrationModels(),
			fixResourceForeignKey: true,
			initDefaultBlogData:   true,
		}, nil
	case AutoMigrateScopeLifeTrace:
		return autoMigratePlan{
			scope:  normalizedScope,
			models: lifeTraceMigrationModels(),
		}, nil
	}

	return autoMigratePlan{}, fmt.Errorf("unsupported auto migrate scope %q (supported: all, core, content, lifetrace)", scope)
}

func allMigrationModels() []any {
	models := make([]any, 0, len(coreMigrationModels())+len(contentDomainMigrationModels())+len(lifeTraceDomainMigrationModels()))
	models = append(models, coreMigrationModels()...)
	models = append(models, contentDomainMigrationModels()...)
	models = append(models, lifeTraceDomainMigrationModels()...)
	return models
}

func NormalizeAutoMigrateScope(scope string) (string, error) {
	normalizedScope := strings.ToLower(strings.TrimSpace(scope))
	if normalizedScope == "" {
		normalizedScope = AutoMigrateScopeLifeTrace
	}

	switch normalizedScope {
	case AutoMigrateScopeAll, AutoMigrateScopeCore, AutoMigrateScopeContent, AutoMigrateScopeLifeTrace:
		return normalizedScope, nil
	default:
		return "", fmt.Errorf("unsupported auto migrate scope %q (supported: all, core, content, lifetrace)", scope)
	}
}

func NormalizeAutoMigrateModelNames(names []string) ([]string, error) {
	_, normalizedNames, err := migrationModelsByName(names)
	return normalizedNames, err
}

func migrationModelsByName(names []string) ([]any, []string, error) {
	aliases := autoMigrateModelAliases()
	modelsByName := autoMigrateModelsByName()

	seen := make(map[string]struct{})
	models := make([]any, 0, len(names))
	normalizedNames := make([]string, 0, len(names))
	for _, rawName := range names {
		name := strings.ToLower(strings.TrimSpace(rawName))
		if name == "" {
			continue
		}
		if canonical, ok := aliases[name]; ok {
			name = canonical
		}
		model, ok := modelsByName[name]
		if !ok {
			return nil, nil, fmt.Errorf("unsupported auto migrate model %q", rawName)
		}
		if _, ok := seen[name]; ok {
			continue
		}
		seen[name] = struct{}{}
		models = append(models, model)
		normalizedNames = append(normalizedNames, name)
	}

	if len(models) == 0 {
		return nil, nil, fmt.Errorf("at least one auto migrate model is required")
	}
	return models, normalizedNames, nil
}

func autoMigrateModelsByName() map[string]any {
	return map[string]any{
		"user":                                 &model.User{},
		"user_preference":                      &model.UserPreference{},
		"mail_account":                         &model.MailAccount{},
		"mail_message":                         &model.MailMessage{},
		"household":                            &model.Household{},
		"household_member":                     &model.HouseholdMember{},
		"household_invite":                     &model.HouseholdInvite{},
		"operation_log":                        &model.OperationLog{},
		"ai_usage_log":                         &model.AIUsageLog{},
		"ai_agent":                             &model.AIAgent{},
		"ai_conversation":                      &model.AIConversation{},
		"ai_message":                           &model.AIMessage{},
		"ai_app":                               &model.AIApp{},
		"ai_app_version":                       &model.AIAppVersion{},
		"ai_app_version_knowledge_base":        &model.AIAppVersionKnowledgeBase{},
		"ai_app_version_tool_binding":          &model.AIAppVersionToolBinding{},
		"ai_app_run":                           &model.AIAppRun{},
		"ai_app_conversation":                  &model.AIAppConversation{},
		"ai_app_conversation_message":          &model.AIAppConversationMessage{},
		"ai_app_conversation_tool_trace":       &model.AIAppConversationToolTrace{},
		"ai_workbench_copilot_session":         &model.AIWorkbenchCopilotSession{},
		"ai_workbench_copilot_message":         &model.AIWorkbenchCopilotMessage{},
		"ai_workbench_copilot_run":             &model.AIWorkbenchCopilotRun{},
		"ai_workbench_change_proposal":         &model.AIWorkbenchChangeProposal{},
		"ai_knowledge_base":                    &model.AIKnowledgeBase{},
		"ai_knowledge_document":                &model.AIKnowledgeDocument{},
		"ai_app_knowledge_base":                &model.AIAppKnowledgeBase{},
		"ai_app_tool_binding":                  &model.AIAppToolBinding{},
		"ai_api_key":                           &model.AIAPIKey{},
		"ai_api_key_app_binding":               &model.AIAPIKeyAppBinding{},
		"ai_api_key_daily_usage":               &model.AIAPIKeyDailyUsage{},
		"ai_app_public_invocation":             &model.AIAppPublicInvocation{},
		"resource":                             &model.Resource{},
		"download_record":                      &model.DownloadRecord{},
		"user_favorite":                        &model.UserFavorite{},
		"user_follow":                          &model.UserFollow{},
		"user_avatar_history":                  &model.UserAvatarHistory{},
		"user_notification":                    &model.UserNotification{},
		"guestbook_message":                    &model.GuestbookMessage{},
		"user_album":                           &model.UserAlbum{},
		"post_group":                           &model.PostGroup{},
		"post":                                 &model.Post{},
		"post_category":                        &model.PostCategory{},
		"post_tag":                             &model.PostTag{},
		"post_tag_relation":                    &model.PostTagRelation{},
		"post_comment":                         &model.PostComment{},
		"lifetrace_plan":                       &model.LifeTracePlan{},
		"lifetrace_trace":                      &model.LifeTraceTrace{},
		"lifetrace_place":                      &model.LifeTracePlace{},
		"lifetrace_inbox_item":                 &model.LifeTraceInboxItem{},
		"lifetrace_media_diary_entry":          &model.LifeTraceMediaDiaryEntry{},
		"lifetrace_ledger_entry":               &model.LifeTraceLedgerEntry{},
		"lifetrace_closet_item":                &model.LifeTraceClosetItem{},
		"lifetrace_outfit":                     &model.LifeTraceOutfit{},
		"lifetrace_pantry_item":                &model.LifeTracePantryItem{},
		"lifetrace_recurring_payment":          &model.LifeTraceRecurringPayment{},
		"lifetrace_recurring_payment_delivery": &model.LifeTraceRecurringPaymentDelivery{},
		"lifetrace_photo_item_draft":           &model.LifeTracePhotoItemDraft{},
		"lifetrace_settings":                   &model.LifeTraceSettings{},
		"lifetrace_weekly_review":              &model.LifeTraceWeeklyReview{},
		"lifetrace_achievement":                &model.LifeTraceAchievement{},
		"lifetrace_feedback":                   &model.LifeTraceFeedback{},
		"lifetrace_ai_conversation":            &model.LifeTraceAIConversation{},
		"lifetrace_ai_message":                 &model.LifeTraceAIMessage{},
		"lifetrace_ai_action":                  &model.LifeTraceAIAction{},
		"lifetrace_push_subscription":          &model.LifeTracePushSubscription{},
		"lifetrace_push_delivery":              &model.LifeTracePushDelivery{},
		"lifetrace_daily_brief_delivery":       &model.LifeTraceDailyBriefDelivery{},
		"lifetrace_pantry_reminder_delivery":   &model.LifeTracePantryReminderDelivery{},
		"lifetrace_holiday_calendar":           &model.LifeTraceHolidayCalendar{},
		"workflow":                             &model.Workflow{},
		"workflow_run":                         &model.WorkflowRun{},
		"workflow_node_run":                    &model.WorkflowNodeRun{},
		"workflow_run_event":                   &model.WorkflowRunEvent{},
	}
}

func autoMigrateModelAliases() map[string]string {
	return map[string]string{
		"users":                      "user",
		"user_preferences":           "user_preference",
		"preferences":                "user_preference",
		"preference":                 "user_preference",
		"mail_accounts":              "mail_account",
		"mail_account":               "mail_account",
		"mail_messages":              "mail_message",
		"mail_message":               "mail_message",
		"ai_usage":                   "ai_usage_log",
		"ai_usage_logs":              "ai_usage_log",
		"ai_agents":                  "ai_agent",
		"ai_apps":                    "ai_app",
		"ai_app_versions":            "ai_app_version",
		"ai_app_runs":                "ai_app_run",
		"ai_knowledge_bases":         "ai_knowledge_base",
		"ai_knowledge_documents":     "ai_knowledge_document",
		"ai_api_keys":                "ai_api_key",
		"ai_api_key_app_bindings":    "ai_api_key_app_binding",
		"ai_api_key_daily_usages":    "ai_api_key_daily_usage",
		"ai_app_public_invocations":  "ai_app_public_invocation",
		"agents":                     "ai_agent",
		"ai_conversations":           "ai_conversation",
		"ai_messages":                "ai_message",
		"places":                     "lifetrace_place",
		"place":                      "lifetrace_place",
		"plans":                      "lifetrace_plan",
		"plan":                       "lifetrace_plan",
		"traces":                     "lifetrace_trace",
		"trace":                      "lifetrace_trace",
		"inbox":                      "lifetrace_inbox_item",
		"inbox_item":                 "lifetrace_inbox_item",
		"media_diary":                "lifetrace_media_diary_entry",
		"media_diary_entry":          "lifetrace_media_diary_entry",
		"ledger":                     "lifetrace_ledger_entry",
		"ledger_entry":               "lifetrace_ledger_entry",
		"closet":                     "lifetrace_closet_item",
		"closet_item":                "lifetrace_closet_item",
		"outfit":                     "lifetrace_outfit",
		"outfits":                    "lifetrace_outfit",
		"pantry":                     "lifetrace_pantry_item",
		"pantry_item":                "lifetrace_pantry_item",
		"recurring_payment":          "lifetrace_recurring_payment",
		"recurring_payments":         "lifetrace_recurring_payment",
		"recurring_payment_delivery": "lifetrace_recurring_payment_delivery",
		"photo_draft":                "lifetrace_photo_item_draft",
		"settings":                   "lifetrace_settings",
		"weekly_review":              "lifetrace_weekly_review",
		"achievement":                "lifetrace_achievement",
		"feedback":                   "lifetrace_feedback",
		"ai_conversation":            "lifetrace_ai_conversation",
		"ai_message":                 "lifetrace_ai_message",
		"ai_action":                  "lifetrace_ai_action",
		"push_subscription":          "lifetrace_push_subscription",
		"push_delivery":              "lifetrace_push_delivery",
		"daily_brief_delivery":       "lifetrace_daily_brief_delivery",
		"pantry_reminder_delivery":   "lifetrace_pantry_reminder_delivery",
		"holiday_calendar":           "lifetrace_holiday_calendar",
		"workflows":                  "workflow",
		"workflow_runs":              "workflow_run",
		"workflow_node_runs":         "workflow_node_run",
		"workflow_run_events":        "workflow_run_event",
	}
}

func coreMigrationModels() []any {
	return []any{
		&model.User{},
		&model.UserPreference{},
		&model.MailAccount{},
		&model.MailMessage{},
		&model.Household{},
		&model.HouseholdMember{},
		&model.HouseholdInvite{},
		&model.OperationLog{},
		&model.AIUsageLog{},
		&model.AIAgent{},
		&model.AIConversation{},
		&model.AIMessage{},
		&model.AIApp{},
		&model.AIAppVersion{},
		&model.AIAppVersionKnowledgeBase{},
		&model.AIAppVersionToolBinding{},
		&model.AIAppRun{},
		&model.AIAppConversation{},
		&model.AIAppConversationMessage{},
		&model.AIAppConversationToolTrace{},
		&model.AIWorkbenchCopilotSession{},
		&model.AIWorkbenchCopilotMessage{},
		&model.AIWorkbenchCopilotRun{},
		&model.AIWorkbenchChangeProposal{},
		&model.AIKnowledgeBase{},
		&model.AIKnowledgeDocument{},
		&model.AIKnowledgeChunk{},
		&model.AIAppKnowledgeBase{},
		&model.AIAppToolBinding{},
		&model.AIAPIKey{},
	}
}

func contentMigrationModels() []any {
	models := make([]any, 0, len(coreMigrationModels())+len(contentDomainMigrationModels()))
	models = append(models, coreMigrationModels()...)
	models = append(models, contentDomainMigrationModels()...)
	return models
}

func contentDomainMigrationModels() []any {
	return []any{
		&model.Resource{},
		&model.DownloadRecord{},
		&model.UserFavorite{},
		&model.UserFollow{},
		&model.UserAvatarHistory{},
		&model.UserNotification{},
		&model.GuestbookMessage{},
		&model.UserAlbum{},
		&model.PostGroup{},
		&model.Post{},
		&model.PostCategory{},
		&model.PostTag{},
		&model.PostTagRelation{},
		&model.PostComment{},
		&model.Workflow{},
		&model.WorkflowRun{},
		&model.WorkflowNodeRun{},
		&model.WorkflowRunEvent{},
	}
}

func lifeTraceMigrationModels() []any {
	models := make([]any, 0, len(coreMigrationModels())+len(lifeTraceDomainMigrationModels()))
	models = append(models, coreMigrationModels()...)
	models = append(models, lifeTraceDomainMigrationModels()...)
	return models
}

func lifeTraceDomainMigrationModels() []any {
	return []any{
		&model.LifeTracePlan{},
		&model.LifeTraceTrace{},
		&model.LifeTracePlace{},
		&model.LifeTraceInboxItem{},
		&model.LifeTraceMediaDiaryEntry{},
		&model.LifeTraceLedgerEntry{},
		&model.LifeTraceClosetItem{},
		&model.LifeTraceOutfit{},
		&model.LifeTracePantryItem{},
		&model.LifeTraceRecurringPayment{},
		&model.LifeTraceRecurringPaymentDelivery{},
		&model.LifeTraceShoppingListItem{},
		&model.LifeTracePhotoItemDraft{},
		&model.LifeTraceSettings{},
		&model.LifeTraceWeeklyReview{},
		&model.LifeTraceAchievement{},
		&model.LifeTraceFeedback{},
		&model.LifeTraceAIConversation{},
		&model.LifeTraceAIMessage{},
		&model.LifeTraceAIAction{},
		&model.LifeTracePushSubscription{},
		&model.LifeTracePushDelivery{},
		&model.LifeTraceDailyBriefDelivery{},
		&model.LifeTracePantryReminderDelivery{},
		&model.LifeTraceHolidayCalendar{},
	}
}

// fixResourceForeignKeyConstraint repairs historical wrong FK settings for
// resources.user_id and aligns it to users.id (uploader user).
func fixResourceForeignKeyConstraint() error {
	if DB == nil {
		return nil
	}

	dialect := DB.Dialector.Name()
	switch dialect {
	case "postgres":
		if err := DB.Exec(`ALTER TABLE resources DROP CONSTRAINT IF EXISTS fk_creators_resources`).Error; err != nil {
			return err
		}
		_ = DB.Exec(`ALTER TABLE resources DROP CONSTRAINT IF EXISTS fk_resources_user`).Error
		if err := DB.Exec(`
			ALTER TABLE resources
			ADD CONSTRAINT fk_resources_user
			FOREIGN KEY (user_id) REFERENCES users(id)
		`).Error; err != nil {
			return err
		}
		return nil
	case "mysql":
		_ = DB.Exec("ALTER TABLE resources DROP FOREIGN KEY fk_creators_resources").Error
		_ = DB.Exec("ALTER TABLE resources DROP FOREIGN KEY fk_resources_user").Error
		if err := DB.Exec(`
			ALTER TABLE resources
			ADD CONSTRAINT fk_resources_user
			FOREIGN KEY (user_id) REFERENCES users(id)
		`).Error; err != nil {
			return err
		}
		return nil
	default:
		return nil
	}
}

func initDefaultBlogData() error {
	var count int64
	DB.Model(&model.PostCategory{}).Count(&count)
	if count > 0 {
		return nil
	}

	defaultCategories := []model.PostCategory{
		{Name: "技术", Slug: "tech", Description: "技术相关文章", SortOrder: 1},
		{Name: "生活", Slug: "life", Description: "生活随笔", SortOrder: 2},
		{Name: "教程", Slug: "tutorial", Description: "教程文档", SortOrder: 3},
		{Name: "随笔", Slug: "notes", Description: "随手记录", SortOrder: 4},
	}

	for _, category := range defaultCategories {
		category.ID = model.Int64String(utils.GenerateID())
		if err := DB.Create(&category).Error; err != nil {
			log.Printf("Failed to create default category %s: %v", category.Name, err)
		}
	}

	log.Println("Default blog categories initialized")
	return nil
}

func Close() error {
	if DB != nil {
		sqlDB, err := DB.DB()
		if err != nil {
			return err
		}
		return sqlDB.Close()
	}
	return nil
}

func GetDB() *gorm.DB {
	return DB
}
