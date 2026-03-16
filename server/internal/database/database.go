package database

import (
	"fmt"
	"log"
	"os"
	"path/filepath"
	"valley-server/internal/config"
	"valley-server/internal/model"
	"valley-server/internal/utils"

	"github.com/glebarez/sqlite"
	mysqlDriver "gorm.io/driver/mysql"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

var DB *gorm.DB

// Init 初始化数据库连接
func Init(cfg *config.Config) error {
	var err error
	var dialector gorm.Dialector

	// 根据驱动类型选择数据库
	switch cfg.Database.Driver {
	case "sqlite":
		dialector, err = initSQLite(cfg)
	case "mysql":
		dialector, err = initMySQL(cfg)
	default:
		return fmt.Errorf("unsupported database driver: %s", cfg.Database.Driver)
	}

	if err != nil {
		return err
	}

	// 配置 GORM
	gormConfig := &gorm.Config{
		Logger: logger.Default.LogMode(logger.Info),
	}

	// 生产环境减少日志
	if cfg.Env == "production" {
		gormConfig.Logger = logger.Default.LogMode(logger.Warn)
	}

	// 连接数据库
	DB, err = gorm.Open(dialector, gormConfig)
	if err != nil {
		return fmt.Errorf("failed to connect database: %w", err)
	}

	// 自动迁移表结构
	if err := autoMigrate(); err != nil {
		return fmt.Errorf("failed to migrate database: %w", err)
	}

	log.Printf("✅ Database connected successfully (driver: %s)", cfg.Database.Driver)
	return nil
}

// initSQLite 初始化 SQLite
func initSQLite(cfg *config.Config) (gorm.Dialector, error) {
	dbPath := cfg.Database.SQLite

	// 确保目录存在
	dir := filepath.Dir(dbPath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create database directory: %w", err)
	}

	log.Printf("📂 Using SQLite database: %s", dbPath)
	return sqlite.Open(dbPath), nil
}

// initMySQL 初始化 MySQL
func initMySQL(cfg *config.Config) (gorm.Dialector, error) {
	dsn := fmt.Sprintf("%s:%s@tcp(%s:%s)/%s?charset=utf8mb4&parseTime=True&loc=Local",
		cfg.Database.User,
		cfg.Database.Password,
		cfg.Database.Host,
		cfg.Database.Port,
		cfg.Database.DBName,
	)
	log.Printf("🔗 Connecting to MySQL: %s:%s/%s", cfg.Database.Host, cfg.Database.Port, cfg.Database.DBName)
	return mysqlDriver.Open(dsn), nil
}

// autoMigrate 自动迁移表结构
func autoMigrate() error {
	if err := DB.AutoMigrate(
		&model.User{},
		&model.Creator{},
		&model.CreatorSpace{}, // 新增：创作者空间表
		&model.Resource{},
		&model.DownloadRecord{},
		&model.CodeAccessLog{},
		&model.CreatorApplication{}, // 创作者申请表
		&model.UserFavorite{},       // 用户收藏资源表
		&model.UserFollow{},         // 用户关注创作者表
		&model.UserAvatarHistory{},  // 用户头像历史记录表
		&model.Post{},               // 博客文章表
		&model.PostCategory{},       // 博客分类表
		&model.PostTag{},            // 博客标签表
		&model.PostTagRelation{},    // 博客标签关联表
	); err != nil {
		return err
	}

	// 初始化默认博客分类
	return initDefaultBlogData()
}

// initDefaultBlogData 初始化默认博客数据
func initDefaultBlogData() error {
	// 检查是否已有分类
	var count int64
	DB.Model(&model.PostCategory{}).Count(&count)
	if count > 0 {
		return nil // 已有数据，跳过
	}

	// 插入默认分类
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

	log.Println("✅ Default blog categories initialized")
	return nil
}

// Close 关闭数据库连接
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

// GetDB 获取数据库实例
func GetDB() *gorm.DB {
	return DB
}
