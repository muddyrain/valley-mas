package main

import (
	"bytes"
	"strings"
	"testing"
)

func TestParseOptionsRequiresPassword(t *testing.T) {
	_, err := parseOptions(nil, &bytes.Buffer{})
	if err == nil || !strings.Contains(err.Error(), "--password is required") {
		t.Fatalf("err=%v", err)
	}
}

func TestParseOptionsAcceptsExplicitCredentials(t *testing.T) {
	options, err := parseOptions(
		[]string{"--username", "operator", "--password", "secret", "--nickname", "运维管理员"},
		&bytes.Buffer{},
	)
	if err != nil {
		t.Fatal(err)
	}
	if options.username != "operator" || options.password != "secret" || options.nickname != "运维管理员" {
		t.Fatalf("unexpected options: %+v", options)
	}
}

func TestParseOptionsKeepsShortFlagCompatibility(t *testing.T) {
	options, err := parseOptions([]string{"-u", "operator", "-p", "secret", "-n", "运维管理员"}, &bytes.Buffer{})
	if err != nil {
		t.Fatal(err)
	}
	if options.username != "operator" || options.password != "secret" || options.nickname != "运维管理员" {
		t.Fatalf("unexpected options: %+v", options)
	}
}
