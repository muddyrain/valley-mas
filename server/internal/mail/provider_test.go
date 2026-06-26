package mail

import (
	"encoding/base64"
	"strconv"
	"strings"
	"testing"
	"time"
)

func TestExtractGmailMessageMapsHeadersAndPlainText(t *testing.T) {
	message := gmailMessage{
		ID:         "gmail-1",
		ThreadID:   "thread-1",
		Snippet:    "Hello from Gmail",
		InternalMs: "1718592000000",
		Payload: gmailPayload{
			MimeType: "text/plain",
			Headers: []gmailHeader{
				{Name: "From", Value: "Alice <alice@example.com>"},
				{Name: "Subject", Value: "Project note"},
				{Name: "Date", Value: "Mon, 17 Jun 2024 08:00:00 +0000"},
			},
			Body: gmailBody{Data: "SGVsbG8gZnJvbSBib2R5"},
		},
	}

	result := extractGmailMessage(message, "account-1")

	if result.ProviderMessageID != "gmail-1" || result.ThreadID != "thread-1" {
		t.Fatalf("unexpected ids: %#v", result)
	}
	if result.FromAddress != "Alice <alice@example.com>" || result.Subject != "Project note" {
		t.Fatalf("unexpected headers: %#v", result)
	}
	if result.TextBody != "Hello from body" {
		t.Fatalf("unexpected body: %q", result.TextBody)
	}
	if !result.SentAt.Equal(time.UnixMilli(1718592000000).UTC()) {
		t.Fatalf("unexpected sent time: %s", result.SentAt)
	}
}

func TestParseIMAPEnvelopeMapsSummary(t *testing.T) {
	raw := `* 1 FETCH (UID 42 FLAGS (\Seen) ENVELOPE ("Mon, 17 Jun 2024 08:00:00 +0000" "QQ note" (("Bob" NIL "bob" "qq.com")) NIL NIL NIL NIL NIL NIL "<msg-42@qq.com>") BODY[TEXT] {12}` + "\r\nHello QQ mail"

	result, err := parseIMAPFetch(raw, "account-2")
	if err != nil {
		t.Fatalf("parse imap: %v", err)
	}

	if result.ProviderMessageID != "42" {
		t.Fatalf("unexpected uid: %q", result.ProviderMessageID)
	}
	if result.Subject != "QQ note" || result.FromAddress != "Bob <bob@qq.com>" {
		t.Fatalf("unexpected envelope: %#v", result)
	}
	if !result.IsRead {
		t.Fatal("expected seen flag to map to read state")
	}
	if !strings.Contains(result.TextBody, "Hello QQ mail") {
		t.Fatalf("unexpected body: %q", result.TextBody)
	}
}

func TestParseIMAPFetchDecodesMultipartQuotedPrintableBody(t *testing.T) {
	rawBody := strings.Join([]string{
		"From: Medium Daily Digest <noreply@medium.com>",
		"Subject: Forget Grid Frameworks",
		"Content-Type: multipart/alternative; boundary=\"reader-boundary\"",
		"",
		"--reader-boundary",
		"Content-Type: text/plain; charset=utf-8",
		"Content-Transfer-Encoding: quoted-printable",
		"",
		"Forget Grid Frameworks. These 6 Native CSS Patterns handle most real layouts.",
		"=E2=80=94 A short note from Medium.",
		"--reader-boundary",
		"Content-Type: text/html; charset=utf-8",
		"Content-Transfer-Encoding: quoted-printable",
		"",
		"<!doctype html><html><body><h1>Forget Grid Frameworks</h1></body></html>",
		"--reader-boundary--",
	}, "\r\n")
	raw := `* 2 FETCH (UID 77 FLAGS () ENVELOPE ("Mon, 17 Jun 2024 08:00:00 +0000" "Forget Grid Frameworks" (("Medium Daily Digest" NIL "noreply" "medium.com")) NIL NIL NIL NIL NIL NIL "<msg-77@medium.com>") BODY[] {` + strconv.Itoa(len(rawBody)) + "}\r\n" + rawBody + "\r\n)"

	result, err := parseIMAPFetch(raw, "account-3")
	if err != nil {
		t.Fatalf("parse imap: %v", err)
	}

	if !strings.Contains(result.TextBody, "Forget Grid Frameworks") {
		t.Fatalf("expected readable body, got %q", result.TextBody)
	}
	if strings.Contains(result.TextBody, "Content-Transfer-Encoding") ||
		strings.Contains(result.TextBody, "reader-boundary") ||
		strings.Contains(result.TextBody, "=E2=80") ||
		strings.Contains(result.TextBody, "<!doctype html>") {
		t.Fatalf("expected decoded text body, got %q", result.TextBody)
	}
}

func TestParseIMAPFetchKeepsReadablePartialBase64Body(t *testing.T) {
	encoded := base64.StdEncoding.EncodeToString([]byte("Welcome to LINUX DO.\nThis is a readable digest."))
	truncated := strings.TrimRight(encoded, "=")
	if len(truncated) > 4 {
		truncated = truncated[:len(truncated)-2]
	}
	rawBody := strings.Join([]string{
		"----=_mimepart_450512c387126b1",
		"Content-Type: text/plain; charset=UTF-8",
		"Content-Transfer-Encoding: base64",
		"",
		truncated,
	}, "\r\n")
	raw := `* 3 FETCH (UID 88 FLAGS () ENVELOPE ("Tue, 18 Jun 2024 11:29:00 +0800" "摘要" (("LINUX DO" NIL "noreply" "linux.do")) NIL NIL NIL NIL NIL NIL "<msg-88@linux.do>") BODY[] {` + strconv.Itoa(len(rawBody)) + "}\r\n" + rawBody + "\r\n)"

	result, err := parseIMAPFetch(raw, "account-4")
	if err != nil {
		t.Fatalf("parse imap: %v", err)
	}

	if !strings.Contains(result.TextBody, "Welcome to LINUX DO") {
		t.Fatalf("expected partial decoded base64 body, got %q", result.TextBody)
	}
	if strings.Contains(result.TextBody, "Content-Transfer-Encoding") ||
		strings.Contains(result.TextBody, "mimepart") {
		t.Fatalf("expected readable body without MIME headers, got %q", result.TextBody)
	}
}

func TestParseIMAPFetchExtractsHTMLAlternativeBody(t *testing.T) {
	rawBody := strings.Join([]string{
		"From: LINUX DO <noreply@linux.do>",
		"Subject: 摘要",
		"Content-Type: multipart/alternative; boundary=\"linuxdo-boundary\"",
		"",
		"--linuxdo-boundary",
		"Content-Type: text/plain; charset=UTF-8",
		"",
		"Plain digest fallback",
		"--linuxdo-boundary",
		"Content-Type: text/html; charset=UTF-8",
		"",
		`<!doctype html><html><body><h1>LINUX DO 摘要</h1><p><a href="https://linux.do/t/1">查看主题</a></p><script>alert(1)</script></body></html>`,
		"--linuxdo-boundary--",
	}, "\r\n")
	raw := `* 4 FETCH (UID 99 FLAGS () ENVELOPE ("Tue, 18 Jun 2024 11:29:00 +0800" "摘要" (("LINUX DO" NIL "noreply" "linux.do")) NIL NIL NIL NIL NIL NIL "<msg-99@linux.do>") BODY[] {` + strconv.Itoa(len(rawBody)) + "}\r\n" + rawBody + "\r\n)"

	result, err := parseIMAPFetch(raw, "account-5")
	if err != nil {
		t.Fatalf("parse imap: %v", err)
	}

	if !strings.Contains(result.TextBody, "Plain digest fallback") {
		t.Fatalf("expected plain fallback, got %q", result.TextBody)
	}
	if !strings.Contains(result.HTMLBody, "<h1>LINUX DO 摘要</h1>") ||
		!strings.Contains(result.HTMLBody, "<script>alert(1)</script>") {
		t.Fatalf("expected raw html body for frontend sanitizer, got %q", result.HTMLBody)
	}
}
