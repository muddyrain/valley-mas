package utils

import (
	"strings"
	"testing"
	"time"

	"github.com/volcengine/ve-tos-golang-sdk/v2/tos"
)

func TestPresignPrivatePutOnlyReturnsBrowserSettableHeaders(t *testing.T) {
	client, err := tos.NewClientV2(
		"tos-cn-beijing.volces.com",
		tos.WithRegion("cn-beijing"),
		tos.WithCredentials(tos.NewStaticCredentials("AKIDEXAMPLE", "SECRETEXAMPLE")),
	)
	if err != nil {
		t.Fatal(err)
	}
	uploader := &TOSUploader{client: client, bucket: "test-bucket"}

	ticket, err := uploader.PresignPrivatePut("article-packages/temp/test.zip", 15*time.Minute)
	if err != nil {
		t.Fatal(err)
	}

	headers := make(map[string]string, len(ticket.Headers))
	for name, value := range ticket.Headers {
		headers[strings.ToLower(name)] = value
	}
	if len(headers) != 2 || headers["content-type"] != "application/zip" || headers["x-tos-acl"] != "private" {
		t.Fatalf("browser upload headers = %#v", headers)
	}
}
