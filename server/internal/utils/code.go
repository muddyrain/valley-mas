package utils

import (
	"crypto/rand"
	"math/big"
	"strings"
)

// CodeChars 口令字符集（小写字母 + 数字，去除易混淆字符）
// 去除：i, l, o, 0, 1（容易混淆）
// 保留：小写字母 + 数字 2-9
const CodeChars = "abcdefghjkmnpqrstuvwxyz23456789"

// CodeLength 口令长度（5位短口令，易记易输入）
const CodeLength = 5

// GenerateCode 生成随机口令
// 返回：5位小写字母+数字组合，例如：y2722, ab3cd, xm9k7
func GenerateCode() string {
	code := make([]byte, CodeLength)
	charsLen := big.NewInt(int64(len(CodeChars)))

	for i := 0; i < CodeLength; i++ {
		// 使用加密安全的随机数生成器
		num, err := rand.Int(rand.Reader, charsLen)
		if err != nil {
			// 如果加密随机失败，使用时间戳作为后备方案
			return GenerateCodeFromTimestamp()
		}
		code[i] = CodeChars[num.Int64()]
	}

	return string(code)
}

// GenerateCodeFromTimestamp 基于时间戳生成口令（后备方案）
func GenerateCodeFromTimestamp() string {
	id := GenerateID() // 使用 Snowflake ID
	// 将 ID 转换为字符串再转换为 rune 切片
	idBytes := []byte{
		byte(id >> 56),
		byte(id >> 48),
		byte(id >> 40),
		byte(id >> 32),
	}
	code := make([]byte, CodeLength)

	for i := 0; i < CodeLength; i++ {
		idx := int(idBytes[i]) % len(CodeChars)
		code[i] = CodeChars[idx]
	}

	return string(code)
}

// ValidateCodeFormat 验证口令格式
func ValidateCodeFormat(code string) bool {
	// 长度检查（允许5-6位，因为可能有特殊情况）
	if len(code) < CodeLength || len(code) > CodeLength+1 {
		return false
	}

	// 字符检查（转小写后检查）
	code = strings.ToLower(code)
	for _, c := range code {
		if !strings.ContainsRune(CodeChars, c) {
			return false
		}
	}

	return true
}

// NormalizeCode 标准化口令（转小写，去空格）
func NormalizeCode(code string) string {
	code = strings.TrimSpace(code)
	code = strings.ToLower(code)
	return code
}

// CodeExamples 口令示例（用于前端展示）
var CodeExamples = []string{
	"y2722", "ab3cd", "xm9k7", "qr5pw", "we8dg",
	"fg2hj", "jk4mn", "st6vx", "bn9pq", "cd3fh",
}

// GetCodeStrength 获取口令强度说明
func GetCodeStrength() map[string]interface{} {
	totalCombinations := 1
	for i := 0; i < CodeLength; i++ {
		totalCombinations *= len(CodeChars)
	}

	return map[string]interface{}{
		"length":      CodeLength,
		"charset":     CodeChars,
		"charsetSize": len(CodeChars),
		"total":       totalCombinations,
		"description": "5位口令，包含小写字母和数字2-9，共29个字符",
		"examples":    CodeExamples[:5],
		"note":        "去除易混淆字符 i/l/o/0/1，易读易记",
	}
}
