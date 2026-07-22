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
	"valley-server/internal/model"
	"valley-server/internal/utils"

	"github.com/joho/godotenv"
	"gorm.io/gorm"
)

func main() {
	if err := run(os.Args[1:], os.Stdout); err != nil {
		log.Fatal(err)
	}
}

type bootstrapAdminOptions struct {
	username string
	password string
	nickname string
}

func parseOptions(args []string, out io.Writer) (bootstrapAdminOptions, error) {
	options := bootstrapAdminOptions{}
	flags := flag.NewFlagSet("bootstrap-admin", flag.ContinueOnError)
	flags.SetOutput(out)
	flags.StringVar(&options.username, "username", "admin", "admin username")
	flags.StringVar(&options.username, "u", "admin", "admin username (shorthand)")
	flags.StringVar(&options.password, "password", "", "required admin password")
	flags.StringVar(&options.password, "p", "", "required admin password (shorthand)")
	flags.StringVar(&options.nickname, "nickname", "系统管理员", "admin nickname")
	flags.StringVar(&options.nickname, "n", "系统管理员", "admin nickname (shorthand)")
	if err := flags.Parse(args); err != nil {
		return bootstrapAdminOptions{}, err
	}
	if strings.TrimSpace(options.password) == "" {
		return bootstrapAdminOptions{}, fmt.Errorf("--password is required")
	}
	return options, nil
}

func run(args []string, out io.Writer) error {
	options, err := parseOptions(args, out)
	if err != nil {
		return err
	}

	loadEnv()

	cfg := config.Load()
	if err := utils.InitSnowflake(1); err != nil {
		return err
	}
	if err := database.Init(cfg); err != nil {
		return err
	}
	defer database.Close()

	db := database.GetDB()
	var user model.User
	err = db.Where("username = ?", options.username).First(&user).Error
	if err != nil {
		if err != gorm.ErrRecordNotFound {
			return err
		}

		user = model.User{
			Username: options.username,
			Password: utils.HashPassword(options.password),
			Nickname: options.nickname,
			Role:     "admin",
			IsActive: true,
			Platform: "web",
		}
		if err := db.Create(&user).Error; err != nil {
			return err
		}
		fmt.Fprintf(out, "created admin user: username=%s id=%s\n", user.Username, user.ID.String())
		return nil
	}

	updates := map[string]any{
		"password":  utils.HashPassword(options.password),
		"role":      "admin",
		"is_active": true,
		"platform":  "web",
		"nickname":  options.nickname,
	}
	if err := db.Model(&user).Updates(updates).Error; err != nil {
		return err
	}
	fmt.Fprintf(out, "updated admin user: username=%s id=%s\n", user.Username, user.ID.String())
	return nil
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
