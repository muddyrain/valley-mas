package utils

import (
	"strings"
	"testing"
)

// TestGenerateCode 测试口令生成
func TestGenerateCode(t *testing.T) {
	code := GenerateCode()

	// 检查长度
	if len(code) != CodeLength {
		t.Errorf("Expected code length %d, got %d", CodeLength, len(code))
	}

	// 检查字符集
	for _, c := range code {
		if !strings.ContainsRune(CodeChars, c) {
			t.Errorf("Invalid character in code: %c", c)
		}
	}

	t.Logf("Generated code: %s", code)
}

// TestGenerateCodeUniqueness 测试口令唯一性（概率测试）
func TestGenerateCodeUniqueness(t *testing.T) {
	codeMap := make(map[string]bool)
	duplicates := 0

	// 生成 1000 个口令
	for i := 0; i < 1000; i++ {
		code := GenerateCode()
		if codeMap[code] {
			duplicates++
		}
		codeMap[code] = true
	}

	t.Logf("Generated 1000 codes, %d unique, %d duplicates", len(codeMap), duplicates)

	// 期望唯一率 > 95%（4位32进制有 32^4 = 1,048,576 种组合）
	if float64(len(codeMap))/1000.0 < 0.95 {
		t.Errorf("Uniqueness too low: %d/1000", len(codeMap))
	}
}

// TestValidateCodeFormat 测试口令格式验证
func TestValidateCodeFormat(t *testing.T) {
	testCases := []struct {
		code  string
		valid bool
	}{
		{"y2722", true},    // 正常5位
		{"ab3cd", true},    // 正常5位
		{"xm9k7", true},    // 正常5位
		{"y2722x", true},   // 6位也允许
		{"abc", false},     // 太短
		{"abcdefg", false}, // 太长
		{"ab0cd", false},   // 包含0（易混淆）
		{"ab1cd", false},   // 包含1（易混淆）
		{"abicd", false},   // 包含i（易混淆）
		{"abocd", false},   // 包含o（易混淆）
		{"ablcd", false},   // 包含l（易混淆）
		{"Y2722", true},    // 大写（会被标准化）
		{"ab 2cd", false},  // 包含空格
	}

	for _, tc := range testCases {
		result := ValidateCodeFormat(tc.code)
		if result != tc.valid {
			t.Errorf("ValidateCodeFormat(%s) = %v, want %v", tc.code, result, tc.valid)
		}
	}
}

// TestNormalizeCode 测试口令标准化
func TestNormalizeCode(t *testing.T) {
	testCases := []struct {
		input  string
		output string
	}{
		{"y2722", "y2722"},
		{"Y2722", "y2722"},
		{"  AB3CD  ", "ab3cd"},
		{"XM9K7", "xm9k7"},
		{" qr5pw ", "qr5pw"},
	}

	for _, tc := range testCases {
		result := NormalizeCode(tc.input)
		if result != tc.output {
			t.Errorf("NormalizeCode(%s) = %s, want %s", tc.input, result, tc.output)
		}
	}
}

// TestGetCodeStrength 测试口令强度信息
func TestGetCodeStrength(t *testing.T) {
	info := GetCodeStrength()

	t.Logf("Code Strength Info:")
	t.Logf("  Length: %v", info["length"])
	t.Logf("  Charset Size: %v", info["charsetSize"])
	t.Logf("  Total Combinations: %v", info["total"])
	t.Logf("  Description: %v", info["description"])
	t.Logf("  Examples: %v", info["examples"])
	t.Logf("  Note: %v", info["note"])

	// 验证总组合数
	expectedTotal := 1
	for i := 0; i < CodeLength; i++ {
		expectedTotal *= len(CodeChars)
	}

	if info["total"] != expectedTotal {
		t.Errorf("Expected total %d, got %v", expectedTotal, info["total"])
	}
}

// BenchmarkGenerateCode 性能测试
func BenchmarkGenerateCode(b *testing.B) {
	for i := 0; i < b.N; i++ {
		GenerateCode()
	}
}
