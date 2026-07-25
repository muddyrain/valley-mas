package workflow

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
)

type httpRoundTripFunc func(*http.Request) (*http.Response, error)

func (fn httpRoundTripFunc) RoundTrip(request *http.Request) (*http.Response, error) {
	return fn(request)
}

func TestHTTPRequestExecutorReturnsResponseOutputs(t *testing.T) {
	var receivedURL *url.URL
	var receivedHeader http.Header
	var receivedBody string
	executor := HTTPRequestExecutor{Client: &http.Client{Transport: httpRoundTripFunc(func(request *http.Request) (*http.Response, error) {
		receivedURL = request.URL
		receivedHeader = request.Header.Clone()
		body, _ := io.ReadAll(request.Body)
		receivedBody = string(body)
		return &http.Response{
			StatusCode: http.StatusCreated,
			Header:     http.Header{"X-Request-ID": []string{"req-1"}},
			Body:       io.NopCloser(strings.NewReader(`{"ok":true}`)),
		}, nil
	})}}

	result, err := executor.Execute(context.Background(), RunContext{}, NodeExecution{Input: map[string]any{
		"method": "POST", "url": "https://1.1.1.1/items", "params": []any{map[string]any{"name": "page", "value": "2"}},
		"headers": []any{map[string]any{"name": "X-Trace", "value": "trace-1"}}, "bodyType": "json", "body": `{"name":"Valley"}`,
		"timeoutSeconds": 30, "retryCount": 0,
	}})
	if err != nil {
		t.Fatalf("Execute() error = %v", err)
	}
	if receivedURL == nil || receivedURL.Query().Get("page") != "2" {
		t.Fatalf("request query = %#v, want page=2", receivedURL)
	}
	if receivedHeader.Get("X-Trace") != "trace-1" || receivedHeader.Get("Content-Type") != "application/json" {
		t.Fatalf("request headers = %#v", receivedHeader)
	}
	if receivedBody != `{"name":"Valley"}` {
		t.Fatalf("request body = %q", receivedBody)
	}
	if result.Output["body"] != `{"ok":true}` || result.Output["statusCode"] != http.StatusCreated {
		t.Fatalf("output = %#v", result.Output)
	}
	headers, ok := result.Output["headers"].(map[string]any)
	if !ok || headers["X-Request-ID"] != "req-1" {
		t.Fatalf("response headers = %#v", result.Output["headers"])
	}
}

func TestHTTPRequestExecutorCanIgnoreHTTPError(t *testing.T) {
	executor := HTTPRequestExecutor{Client: &http.Client{Transport: httpRoundTripFunc(func(*http.Request) (*http.Response, error) {
		return &http.Response{StatusCode: http.StatusBadGateway, Header: http.Header{}, Body: io.NopCloser(strings.NewReader("upstream unavailable"))}, nil
	})}}
	result, err := executor.Execute(context.Background(), RunContext{}, NodeExecution{Input: map[string]any{
		"method": "GET", "url": "https://1.1.1.1", "bodyType": "none", "timeoutSeconds": 30, "retryCount": 0, "ignoreError": true,
	}})
	if err != nil {
		t.Fatalf("Execute() error = %v", err)
	}
	if result.Output["statusCode"] != http.StatusBadGateway || !strings.Contains(stringFromValue(result.Output["error"]), "502") {
		t.Fatalf("output = %#v", result.Output)
	}
}

func TestHTTPNodeRejectsUnsafeConfiguration(t *testing.T) {
	if _, err := httpConfigFromMap(map[string]any{"method": "GET", "url": "https://example.com", "timeoutSeconds": 30, "retryCount": 0, "headers": []any{map[string]any{"name": "Authorization", "value": "secret"}}}); err == nil {
		t.Fatal("expected authorization header to be rejected")
	}
	privateURL, err := parseOutboundURL("http://127.0.0.1")
	if err != nil {
		t.Fatalf("parseOutboundURL() error = %v", err)
	}
	if err := validateSafeOutboundURL(context.Background(), privateURL, HTTPOutboundPolicy{}); err == nil {
		t.Fatal("expected private URL to be rejected")
	}
}

func TestHTTPRequestExecutorAllowsConfiguredLoopbackTarget(t *testing.T) {
	executor := HTTPRequestExecutor{
		OutboundPolicy: NewHTTPOutboundPolicy([]string{"localhost:8080"}),
		Client: &http.Client{Transport: httpRoundTripFunc(func(request *http.Request) (*http.Response, error) {
			if request.URL.String() != "http://localhost:8080/health" {
				t.Fatalf("request URL = %s", request.URL)
			}
			return &http.Response{StatusCode: http.StatusOK, Header: http.Header{}, Body: io.NopCloser(strings.NewReader("ok"))}, nil
		})},
	}
	result, err := executor.Execute(context.Background(), RunContext{}, NodeExecution{Input: map[string]any{
		"method": "GET", "url": "http://localhost:8080/health", "bodyType": "none", "timeoutSeconds": 30, "retryCount": 0,
	}})
	if err != nil {
		t.Fatalf("Execute() error = %v", err)
	}
	if result.Output["body"] != "ok" {
		t.Fatalf("output = %#v", result.Output)
	}
}

func TestHTTPRequestExecutorDialsConfiguredLoopbackTarget(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		if request.URL.Path != "/health" {
			t.Fatalf("request path = %s", request.URL.Path)
		}
		_, _ = writer.Write([]byte("healthy"))
	}))
	defer server.Close()

	localTarget := strings.TrimPrefix(server.URL, "http://")
	executor := HTTPRequestExecutor{OutboundPolicy: NewHTTPOutboundPolicy([]string{localTarget})}
	result, err := executor.Execute(context.Background(), RunContext{}, NodeExecution{Input: map[string]any{
		"method": "GET", "url": server.URL + "/health", "bodyType": "none", "timeoutSeconds": 30, "retryCount": 0,
	}})
	if err != nil {
		t.Fatalf("Execute() error = %v", err)
	}
	if result.Output["body"] != "healthy" {
		t.Fatalf("output = %#v", result.Output)
	}
}

func TestHTTPNodeDoesNotWhitelistNonLoopbackTarget(t *testing.T) {
	policy := NewHTTPOutboundPolicy([]string{"192.168.1.10:8080", "example.com:8080"})
	if _, err := parseOutboundURLWithPolicy("http://192.168.1.10:8080/health", policy); err == nil {
		t.Fatal("expected non-loopback target to remain blocked")
	}
}
