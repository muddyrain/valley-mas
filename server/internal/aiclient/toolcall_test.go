package aiclient

import (
	"errors"
	"testing"
)

func TestIsARKToolUnsupportedError(t *testing.T) {
	cases := []struct {
		name string
		err  error
		want bool
	}{
		{"nil error", nil, false},
		{"unrelated", errors.New("rate limit"), false},
		{"lower tools", errors.New("tools not supported by model"), true},
		{"mixed case tool_choice", errors.New("Invalid Tool_Choice payload"), true},
		{"tool_calls in body", errors.New("no tool_calls returned"), true},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := IsARKToolUnsupportedError(tc.err); got != tc.want {
				t.Fatalf("IsARKToolUnsupportedError(%v) = %v, want %v", tc.err, got, tc.want)
			}
		})
	}
}

func TestIsOpenAIToolUnsupported(t *testing.T) {
	cases := []struct {
		name       string
		statusCode int
		body       string
		want       bool
	}{
		{"200 ok", 200, `{"tools":"not supported"}`, false},
		{"400 without keyword", 400, `{"error":"rate limit"}`, false},
		{"400 tools not supported", 400, `{"error":"tools are not supported"}`, true},
		{"400 tool_choice invalid", 400, `{"message":"tool_choice invalid"}`, true},
		{"400 tool_calls not supported case insensitive", 400, `{"error":"TOOL_CALLS NOT SUPPORTED"}`, true},
		{"400 tools but neutral wording", 400, `{"error":"tools present"}`, false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := IsOpenAIToolUnsupported(tc.statusCode, []byte(tc.body)); got != tc.want {
				t.Fatalf("IsOpenAIToolUnsupported(%d, %q) = %v, want %v", tc.statusCode, tc.body, got, tc.want)
			}
		})
	}
}
