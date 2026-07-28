package utils

import (
	"errors"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

// Claims JWT 声明
type Claims struct {
	UserID         string `json:"userId"` // 使用字符串避免JavaScript精度丢失
	Username       string `json:"username"`
	Role           string `json:"role"`
	SessionVersion int    `json:"sv,omitempty"`
	jwt.RegisteredClaims
}

// GenerateToken 生成 JWT token
func GenerateToken(userID string, username, role, secret string, expireHours int64) (string, error) {
	return GenerateTokenWithSessionVersion(userID, username, role, 1, secret, expireHours)
}

func GenerateTokenWithSessionVersion(userID string, username, role string, sessionVersion int, secret string, expireHours int64) (string, error) {
	if sessionVersion < 1 {
		sessionVersion = 1
	}
	claims := Claims{
		UserID:         userID, // 直接使用字符串
		Username:       username,
		Role:           role,
		SessionVersion: sessionVersion,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Hour * time.Duration(expireHours))),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			NotBefore: jwt.NewNumericDate(time.Now()),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(secret))
}

// ParseToken 解析 JWT token
func ParseToken(tokenString, secret string) (*Claims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &Claims{}, func(token *jwt.Token) (interface{}, error) {
		return []byte(secret), nil
	})

	if err != nil {
		return nil, err
	}

	if claims, ok := token.Claims.(*Claims); ok && token.Valid {
		return claims, nil
	}

	return nil, errors.New("invalid token")
}
