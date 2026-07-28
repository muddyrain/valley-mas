package utils

import (
	"crypto/md5"
	"crypto/sha256"
	"encoding/hex"
	"strings"

	"golang.org/x/crypto/bcrypt"
)

// HashPassword 使用 bcrypt 保存密码；先哈希输入以支持任意长度的密码。
func HashPassword(password string) string {
	digest := sha256.Sum256([]byte(password))
	hash, err := bcrypt.GenerateFromPassword(digest[:], bcrypt.DefaultCost)
	if err != nil {
		return ""
	}
	return string(hash)
}

// CheckPassword 同时兼容升级前的 MD5 密码哈希。
func CheckPassword(password, hash string) bool {
	if strings.HasPrefix(hash, "$2") {
		digest := sha256.Sum256([]byte(password))
		return bcrypt.CompareHashAndPassword([]byte(hash), digest[:]) == nil
	}
	legacyHash := md5.Sum([]byte(password))
	return hex.EncodeToString(legacyHash[:]) == hash
}

func IsLegacyPasswordHash(hash string) bool {
	return len(hash) == 32 && !strings.HasPrefix(hash, "$2")
}
