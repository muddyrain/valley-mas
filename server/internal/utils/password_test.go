package utils

import (
	"crypto/md5"
	"encoding/hex"
	"strings"
	"testing"
)

func TestPasswordHashUsesBcrypt(t *testing.T) {
	hash := HashPassword("correct horse battery staple")
	if !strings.HasPrefix(hash, "$2") {
		t.Fatalf("password hash should use bcrypt, got %q", hash)
	}
	if !CheckPassword("correct horse battery staple", hash) {
		t.Fatal("bcrypt password should verify")
	}
	if CheckPassword("wrong password", hash) {
		t.Fatal("wrong password should not verify")
	}
}

func TestPasswordHashAcceptsLegacyMD5(t *testing.T) {
	legacy := md5.Sum([]byte("legacy password"))
	hash := hex.EncodeToString(legacy[:])
	if !IsLegacyPasswordHash(hash) {
		t.Fatal("legacy MD5 hash should be detected")
	}
	if !CheckPassword("legacy password", hash) {
		t.Fatal("legacy password should verify during migration")
	}
}
