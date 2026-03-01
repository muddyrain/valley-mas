package utils

import (
	"crypto/md5"
	"encoding/hex"
)

// HashPassword 对密码进行 MD5 加密
func HashPassword(password string) string {
	hash := md5.Sum([]byte(password))
	return hex.EncodeToString(hash[:])
}

// CheckPassword 验证密码
func CheckPassword(password, hash string) bool {
	return HashPassword(password) == hash
}
