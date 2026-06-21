package mail

import (
	"bytes"
	"encoding/base64"
	"io"
	"mime"
	"mime/multipart"
	"mime/quotedprintable"
	stdmail "net/mail"
	"strings"

	"golang.org/x/net/html"
	"golang.org/x/net/html/charset"
)

const maxParsedMailBodyBytes = 1 << 20

type parsedMailBody struct {
	Text string
	HTML string
}

func parseReadableMailBody(raw string) string {
	return parseReadableMailBodies(raw).Text
}

func parseReadableMailBodies(raw string) parsedMailBody {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return parsedMailBody{}
	}

	if message, err := stdmail.ReadMessage(strings.NewReader(raw)); err == nil {
		body, _ := io.ReadAll(io.LimitReader(message.Body, maxParsedMailBodyBytes))
		if parsed := parseMIMEEntity(message.Header.Get("Content-Type"), message.Header.Get("Content-Transfer-Encoding"), body); parsed.Text != "" || parsed.HTML != "" {
			return parsed
		}
	}

	if boundary := leadingMIMEBoundary(raw); boundary != "" {
		if parsed := parseMIMEEntity(`multipart/mixed; boundary="`+boundary+`"`, "", []byte(raw)); parsed.Text != "" || parsed.HTML != "" {
			return parsed
		}
	}

	return parsedMailBody{Text: cleanMailText(raw)}
}

func parseMIMEEntity(contentType string, transferEncoding string, body []byte) parsedMailBody {
	mediaType, params, _ := mime.ParseMediaType(contentType)
	mediaType = strings.ToLower(strings.TrimSpace(mediaType))
	if mediaType == "" {
		mediaType = "text/plain"
	}

	if strings.HasPrefix(mediaType, "multipart/") {
		boundary := params["boundary"]
		if boundary == "" {
			return parsedMailBody{}
		}
		reader := multipart.NewReader(bytes.NewReader(body), boundary)
		var htmlParts []string
		var plainParts []string
		for {
			part, err := reader.NextPart()
			if err == io.EOF {
				break
			}
			if err != nil {
				break
			}
			partBody, _ := io.ReadAll(io.LimitReader(part, maxParsedMailBodyBytes))
			parsed := parseMIMEEntity(part.Header.Get("Content-Type"), part.Header.Get("Content-Transfer-Encoding"), partBody)
			partType, _, _ := mime.ParseMediaType(part.Header.Get("Content-Type"))
			if !strings.EqualFold(partType, "text/html") && strings.TrimSpace(parsed.Text) != "" {
				plainParts = append(plainParts, parsed.Text)
			}
			if strings.TrimSpace(parsed.HTML) != "" {
				htmlParts = append(htmlParts, parsed.HTML)
			}
		}
		parsed := parsedMailBody{
			Text: cleanMailText(strings.Join(plainParts, "\n\n")),
			HTML: strings.TrimSpace(strings.Join(htmlParts, "\n\n")),
		}
		if parsed.Text == "" && parsed.HTML != "" {
			parsed.Text = cleanMailText(htmlToText(parsed.HTML))
		}
		return parsed
	}

	decoded, err := decodeTransferBody(bytes.NewReader(body), transferEncoding)
	if err != nil {
		decoded = body
	}
	decoded, err = decodeCharset(decoded, params["charset"])
	if err != nil {
		return parsedMailBody{Text: cleanMailText(string(decoded))}
	}

	if mediaType == "text/html" {
		htmlBody := strings.TrimSpace(string(decoded))
		return parsedMailBody{Text: cleanMailText(htmlToText(htmlBody)), HTML: htmlBody}
	}
	if strings.HasPrefix(mediaType, "text/") {
		return parsedMailBody{Text: cleanMailText(string(decoded))}
	}
	return parsedMailBody{}
}

func decodeTransferBody(reader io.Reader, encoding string) ([]byte, error) {
	switch strings.ToLower(strings.TrimSpace(encoding)) {
	case "base64":
		decoded, err := io.ReadAll(base64.NewDecoder(base64.StdEncoding, reader))
		if err != nil && len(decoded) > 0 {
			return decoded, nil
		}
		return decoded, err
	case "quoted-printable":
		return io.ReadAll(quotedprintable.NewReader(reader))
	default:
		return io.ReadAll(reader)
	}
}

func decodeCharset(value []byte, charsetName string) ([]byte, error) {
	charsetName = strings.TrimSpace(charsetName)
	if charsetName == "" || strings.EqualFold(charsetName, "utf-8") || strings.EqualFold(charsetName, "us-ascii") {
		return value, nil
	}
	reader, err := charset.NewReaderLabel(charsetName, bytes.NewReader(value))
	if err != nil {
		return value, err
	}
	return io.ReadAll(io.LimitReader(reader, maxParsedMailBodyBytes))
}

func htmlToText(value string) string {
	tokenizer := html.NewTokenizer(strings.NewReader(value))
	var builder strings.Builder
	skipDepth := 0
	for {
		tokenType := tokenizer.Next()
		switch tokenType {
		case html.ErrorToken:
			return builder.String()
		case html.StartTagToken:
			name, _ := tokenizer.TagName()
			tag := strings.ToLower(string(name))
			if tag == "script" || tag == "style" {
				skipDepth++
				continue
			}
			if isMailBlockTag(tag) {
				builder.WriteByte('\n')
			}
		case html.EndTagToken:
			name, _ := tokenizer.TagName()
			tag := strings.ToLower(string(name))
			if skipDepth > 0 && (tag == "script" || tag == "style") {
				skipDepth--
				continue
			}
			if skipDepth == 0 && isMailBlockTag(tag) {
				builder.WriteByte('\n')
			}
		case html.TextToken:
			if skipDepth == 0 {
				builder.Write(tokenizer.Text())
				builder.WriteByte(' ')
			}
		}
	}
}

func isMailBlockTag(tag string) bool {
	switch tag {
	case "br", "p", "div", "section", "article", "header", "footer", "h1", "h2", "h3", "h4", "h5", "h6", "li", "tr", "table":
		return true
	default:
		return false
	}
}

func leadingMIMEBoundary(raw string) string {
	for _, line := range strings.Split(raw, "\n") {
		line = strings.TrimSpace(line)
		if strings.HasPrefix(line, "--") && len(line) > 2 {
			return strings.TrimSuffix(strings.TrimPrefix(line, "--"), "--")
		}
		if line != "" {
			return ""
		}
	}
	return ""
}
