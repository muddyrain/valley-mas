package mail

import (
	"bufio"
	"context"
	"crypto/tls"
	"errors"
	"fmt"
	"net"
	"net/textproto"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"
)

type QQIMAPProvider struct {
	addr string
}

func NewQQIMAPProvider() *QQIMAPProvider {
	return &QQIMAPProvider{addr: "imap.qq.com:993"}
}

func (p *QQIMAPProvider) FetchInbox(ctx context.Context, accountID string, email string, authorizationCode string, limit int) ([]FetchedMessage, error) {
	if limit <= 0 || limit > 50 {
		limit = 20
	}

	dialer := &net.Dialer{Timeout: 12 * time.Second}
	conn, err := tls.DialWithDialer(dialer, "tcp", p.addr, &tls.Config{ServerName: "imap.qq.com", MinVersion: tls.VersionTLS12})
	if err != nil {
		return nil, err
	}
	defer conn.Close()

	_ = conn.SetDeadline(time.Now().Add(25 * time.Second))
	client := newIMAPSession(conn)
	if _, err := client.readUntil(""); err != nil {
		return nil, err
	}
	if _, err := client.command("LOGIN %s %s", quoteIMAP(email), quoteIMAP(authorizationCode)); err != nil {
		return nil, err
	}
	if _, err := client.command("SELECT INBOX"); err != nil {
		return nil, err
	}
	search, err := client.command("UID SEARCH ALL")
	if err != nil {
		return nil, err
	}
	uids := parseIMAPSearchUIDs(search)
	if len(uids) == 0 {
		return []FetchedMessage{}, nil
	}
	sort.Ints(uids)
	if len(uids) > limit {
		uids = uids[len(uids)-limit:]
	}
	uidParts := make([]string, 0, len(uids))
	for _, uid := range uids {
		uidParts = append(uidParts, strconv.Itoa(uid))
	}
	fetchRaw, err := client.command("UID FETCH %s (UID FLAGS ENVELOPE BODY.PEEK[TEXT]<0.8192>)", strings.Join(uidParts, ","))
	if err != nil {
		return nil, err
	}

	blocks := splitIMAPFetchBlocks(fetchRaw)
	messages := make([]FetchedMessage, 0, len(blocks))
	for _, block := range blocks {
		message, err := parseIMAPFetch(block, accountID)
		if err == nil && message.ProviderMessageID != "" {
			messages = append(messages, message)
		}
	}
	return messages, nil
}

type imapSession struct {
	reader  *textproto.Reader
	writer  *bufio.Writer
	nextTag int
}

func newIMAPSession(conn net.Conn) *imapSession {
	return &imapSession{
		reader: textproto.NewReader(bufio.NewReader(conn)),
		writer: bufio.NewWriter(conn),
	}
}

func (s *imapSession) command(format string, args ...any) (string, error) {
	s.nextTag++
	tag := fmt.Sprintf("A%04d", s.nextTag)
	line := tag + " " + fmt.Sprintf(format, args...) + "\r\n"
	if _, err := s.writer.WriteString(line); err != nil {
		return "", err
	}
	if err := s.writer.Flush(); err != nil {
		return "", err
	}
	return s.readUntil(tag)
}

func (s *imapSession) readUntil(tag string) (string, error) {
	var builder strings.Builder
	for {
		line, err := s.reader.ReadLine()
		if err != nil {
			return builder.String(), err
		}
		builder.WriteString(line)
		builder.WriteString("\r\n")
		if tag != "" && strings.HasPrefix(line, tag+" ") {
			if strings.Contains(line, " OK") {
				return builder.String(), nil
			}
			return builder.String(), errors.New(line)
		}
		if tag == "" {
			return builder.String(), nil
		}
	}
}

func quoteIMAP(value string) string {
	value = strings.ReplaceAll(value, `\`, `\\`)
	value = strings.ReplaceAll(value, `"`, `\"`)
	return `"` + value + `"`
}

func parseIMAPSearchUIDs(raw string) []int {
	re := regexp.MustCompile(`\* SEARCH ([0-9 ]+)`)
	match := re.FindStringSubmatch(raw)
	if len(match) < 2 {
		return nil
	}
	parts := strings.Fields(match[1])
	uids := make([]int, 0, len(parts))
	for _, part := range parts {
		if uid, err := strconv.Atoi(part); err == nil {
			uids = append(uids, uid)
		}
	}
	return uids
}

func splitIMAPFetchBlocks(raw string) []string {
	lines := strings.Split(raw, "\r\n")
	blocks := []string{}
	var current strings.Builder
	for _, line := range lines {
		if strings.HasPrefix(line, "* ") && strings.Contains(line, " FETCH ") {
			if current.Len() > 0 {
				blocks = append(blocks, current.String())
				current.Reset()
			}
		}
		if current.Len() > 0 {
			current.WriteString("\r\n")
		}
		current.WriteString(line)
	}
	if current.Len() > 0 {
		blocks = append(blocks, current.String())
	}
	return blocks
}

func parseIMAPFetch(raw string, accountID string) (FetchedMessage, error) {
	uid := firstRegex(raw, `UID ([0-9]+)`)
	if uid == "" {
		return FetchedMessage{}, errors.New("missing IMAP UID")
	}

	subject := decodeMIMEHeader(firstRegex(raw, `ENVELOPE \("[^"]*" "([^"]*)"`))
	dateValue := firstRegex(raw, `ENVELOPE \("([^"]*)"`)
	fromName := decodeMIMEHeader(firstRegex(raw, `\(\("([^"]*)" NIL "[^"]*" "[^"]*"\)\)`))
	fromMailbox := firstRegex(raw, `\(\("[^"]*" NIL "([^"]*)" "[^"]*"\)\)`)
	fromHost := firstRegex(raw, `\(\("[^"]*" NIL "[^"]*" "([^"]*)"\)\)`)
	from := strings.TrimSpace(fromMailbox + "@" + fromHost)
	if fromName != "" && from != "@" {
		from = fmt.Sprintf("%s <%s>", fromName, from)
	}

	body := raw
	if marker := "BODY[TEXT]"; strings.Contains(raw, marker) {
		body = raw[strings.Index(raw, marker)+len(marker):]
		if idx := strings.Index(body, "\r\n"); idx >= 0 {
			body = body[idx+2:]
		}
	}
	body = stripIMAPTaggedTail(body)
	body = strings.TrimSpace(body)

	sentAt := time.Now().UTC()
	if parsed, err := parseMailTime(dateValue); err == nil {
		sentAt = parsed.UTC()
	}

	return FetchedMessage{
		AccountID:         accountID,
		Provider:          ProviderQQIMAP,
		ProviderMessageID: uid,
		FromAddress:       from,
		Subject:           subject,
		Snippet:           trimText(body, 240),
		TextBody:          trimText(body, 8000),
		IsRead:            strings.Contains(raw, `\Seen`),
		SentAt:            sentAt,
	}, nil
}

func firstRegex(raw string, pattern string) string {
	re := regexp.MustCompile(pattern)
	match := re.FindStringSubmatch(raw)
	if len(match) < 2 {
		return ""
	}
	return match[1]
}

func stripIMAPTaggedTail(value string) string {
	lines := strings.Split(value, "\r\n")
	kept := make([]string, 0, len(lines))
	for _, line := range lines {
		if strings.HasPrefix(line, "A") && strings.Contains(line, " OK") {
			break
		}
		if strings.HasSuffix(line, ")") && strings.Contains(line, " FETCH ") {
			continue
		}
		kept = append(kept, line)
	}
	return strings.Join(kept, "\n")
}
