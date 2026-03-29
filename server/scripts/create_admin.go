package main

import (
	"bytes"
	"flag"
	"fmt"
	"log"
	"os"
	"valley-server/internal/config"
	"valley-server/internal/database"
	"valley-server/internal/model"
	"valley-server/internal/utils"

	"github.com/joho/godotenv"
	"gorm.io/gorm"
)

func main() {
	username := flag.String("u", "admin", "admin username")
	password := flag.String("p", "Admin@123456", "admin password")
	nickname := flag.String("n", "系统管理员", "admin nickname")
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
	var user model.User
	err := db.Where("username = ?", *username).First(&user).Error
	if err != nil {
		if err != gorm.ErrRecordNotFound {
			panic(err)
		}

		user = model.User{
			Username: *username,
			Password: utils.HashPassword(*password),
			Nickname: *nickname,
			Role:     "admin",
			IsActive: true,
			Platform: "web",
		}
		if err := db.Create(&user).Error; err != nil {
			panic(err)
		}
		fmt.Printf("created admin user: username=%s password=%s id=%s\n", *username, *password, user.ID.String())
		return
	}

	updates := map[string]any{
		"password":  utils.HashPassword(*password),
		"role":      "admin",
		"is_active": true,
		"platform":  "web",
		"nickname":  *nickname,
	}
	if err := db.Model(&user).Updates(updates).Error; err != nil {
		panic(err)
	}
	fmt.Printf("updated admin user: username=%s password=%s id=%s\n", *username, *password, user.ID.String())
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
