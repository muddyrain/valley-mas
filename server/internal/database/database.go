package database

import (
	"fmt"
	"log"
	"os"
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
		if err := autoMigrate(); err != nil {
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

func autoMigrate() error {
	if err := DB.AutoMigrate(
		&model.User{},
		&model.Creator{},
		&model.CreatorSpace{},
		&model.Resource{},
		&model.ResourceTag{},
		&model.ResourceTagRelation{},
		&model.DownloadRecord{},
		&model.CodeAccessLog{},
		&model.CreatorApplication{},
		&model.CreatorAuditConfig{},
		&model.UserFavorite{},
		&model.UserFollow{},
		&model.UserAvatarHistory{},
		&model.UserNotification{},
		&model.CreatorAlbum{},
		&model.PostGroup{},
		&model.Post{},
		&model.PostCategory{},
		&model.PostTag{},
		&model.PostTagRelation{},
		&model.PostComment{},
		&model.OperationLog{},
	); err != nil {
		return err
	}

	if err := fixResourceForeignKeyConstraint(); err != nil {
		// Do not block startup because of historical dirty data.
		log.Printf("warn: fix resource foreign key skipped: %v", err)
	}

	return initDefaultBlogData()
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
