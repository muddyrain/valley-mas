package mail

import (
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
