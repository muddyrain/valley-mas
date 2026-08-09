package image

import (
	"bytes"
	"context"
	"encoding/json"
	"image"
	"image/color"
	"image/png"
	"testing"

	"valley-server/internal/ai/tools"
	"valley-server/internal/ai/tools/artifact"
	"valley-server/internal/model"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

type recordingArtifactWriter struct {
	file artifact.File
}

func (writer *recordingArtifactWriter) Write(_ context.Context, _ artifact.RequestContext, file artifact.File) (model.AIAppArtifact, error) {
	writer.file = file
	return model.AIAppArtifact{ID: 901, FileName: file.Name, ContentType: file.ContentType, SizeBytes: int64(len(file.Content)), URL: "https://example.invalid/output"}, nil
}

func TestConvertToolContractUsesConversionCardWithoutConfirmation(t *testing.T) {
	contract := tools.ContractFor(NewConvertTool(nil))
	if contract.ResultCard != tools.ResultCardConversion || contract.Confirmation != tools.ConfirmationNever {
		t.Fatalf("unexpected contract: %#v", contract)
	}
}

func TestConvertImageBytesRoundTripsPNGAndWebP(t *testing.T) {
	source := image.NewNRGBA(image.Rect(0, 0, 2, 1))
	source.SetNRGBA(0, 0, color.NRGBA{R: 255, A: 255})
	source.SetNRGBA(1, 0, color.NRGBA{B: 255, A: 96})
	var input bytes.Buffer
	if err := png.Encode(&input, source); err != nil {
		t.Fatalf("encode source png: %v", err)
	}

	webpBytes, contentType, err := convertImageBytes(input.Bytes(), "png", "webp", 85)
	if err != nil {
		t.Fatalf("convert png to webp: %v", err)
	}
	if contentType != "image/webp" || !bytes.HasPrefix(webpBytes, []byte("RIFF")) {
		t.Fatalf("unexpected webp output: type=%q bytes=%q", contentType, webpBytes[:min(len(webpBytes), 12)])
	}

	pngBytes, contentType, err := convertImageBytes(webpBytes, "webp", "png", 0)
	if err != nil {
		t.Fatalf("convert webp to png: %v", err)
	}
	if contentType != "image/png" {
		t.Fatalf("png content type = %q", contentType)
	}
	decoded, _, err := image.Decode(bytes.NewReader(pngBytes))
	if err != nil || decoded.Bounds() != source.Bounds() {
		t.Fatalf("decode converted png: bounds=%v err=%v", decoded.Bounds(), err)
	}
	_, _, _, alpha := decoded.At(1, 0).RGBA()
	if alpha == 0 || alpha == 0xffff {
		t.Fatalf("transparent pixel alpha = %d, want preserved partial transparency", alpha)
	}
}

func TestConvertToolRejectsForeignAttachment(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	if err := db.AutoMigrate(&model.AIAppConversationAttachment{}); err != nil {
		t.Fatalf("migrate attachment: %v", err)
	}
	foreign := model.AIAppConversationAttachment{UserID: 202, AppID: 11, ConversationID: 12, Name: "foreign.png", MimeType: "image/png", SizeBytes: 3, SourceContent: []byte("png")}
	if err := db.Create(&foreign).Error; err != nil {
		t.Fatalf("create foreign attachment: %v", err)
	}

	writer := &recordingArtifactWriter{}
	tool := newConvertTool(db, writer)
	ctx := artifact.WithRequestContext(context.Background(), artifact.RequestContext{
		UserID: 101, AppID: 11, ConversationID: 12, RunID: 13,
		AttachmentIDs: []model.Int64String{foreign.ID},
	})
	raw, _ := json.Marshal(map[string]any{"attachmentId": foreign.ID.String(), "targetFormat": "webp"})
	if _, err := tool.Run(ctx, raw); err == nil {
		t.Fatal("expected foreign attachment to be rejected")
	}
	if len(writer.file.Content) != 0 {
		t.Fatal("foreign attachment reached the artifact writer")
	}
}
