package service

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"testing"

	"valley-server/internal/model"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func newAICanvasDocumentTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open("file:"+t.Name()+"?mode=memory&cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	if err := db.AutoMigrate(&model.AICanvasDocument{}); err != nil {
		t.Fatal(err)
	}
	return db
}

func validAICanvasDocument() json.RawMessage {
	return json.RawMessage(`{
		"version":1,
		"aspectRatio":"1:1",
		"background":"#ffffff",
		"baseGenerationId":"123",
		"elements":[{
			"id":"shape-1","type":"shape","name":"区域","points":[{"x":0.1,"y":0.1},{"x":0.8,"y":0.1},{"x":0.5,"y":0.8}],
			"fill":"#ffffff","stroke":"#111827","strokeWidth":0.01,"texture":"solid","opacity":1,"visible":true,"locked":false
		}]
	}`)
}

func TestAICanvasDocumentServiceSavesOneOwnerPrivateDocument(t *testing.T) {
	db := newAICanvasDocumentTestDB(t)
	documentService := NewAICanvasDocumentService(db)

	created, err := documentService.Save(context.Background(), AICanvasDocumentInput{
		UserID: 11, ExpectedRevision: 0, Document: validAICanvasDocument(),
	})
	if err != nil {
		t.Fatal(err)
	}
	if created.Revision != 1 || created.AspectRatio != "1:1" {
		t.Fatalf("unexpected created document: %+v", created)
	}

	loaded, found, err := documentService.Get(context.Background(), 11)
	if err != nil || !found || loaded.ID != created.ID {
		t.Fatalf("expected saved document, found=%v err=%v document=%+v", found, err, loaded)
	}
	if _, found, err := documentService.Get(context.Background(), 12); err != nil || found {
		t.Fatalf("another owner must not read the document, found=%v err=%v", found, err)
	}

	updated, err := documentService.Save(context.Background(), AICanvasDocumentInput{
		UserID: 11, ExpectedRevision: created.Revision, Document: validAICanvasDocument(),
	})
	if err != nil || updated.Revision != 2 {
		t.Fatalf("expected revision 2 after save, got %+v err=%v", updated, err)
	}
}

func TestAICanvasDocumentServiceRejectsStaleRevision(t *testing.T) {
	documentService := NewAICanvasDocumentService(newAICanvasDocumentTestDB(t))
	created, err := documentService.Save(context.Background(), AICanvasDocumentInput{
		UserID: 21, ExpectedRevision: 0, Document: validAICanvasDocument(),
	})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := documentService.Save(context.Background(), AICanvasDocumentInput{
		UserID: 21, ExpectedRevision: created.Revision - 1, Document: validAICanvasDocument(),
	}); !errors.Is(err, ErrAICanvasDocumentConflict) {
		t.Fatalf("expected revision conflict, got %v", err)
	}
}

func TestValidateAICanvasDocumentRejectsUnsafeImageData(t *testing.T) {
	raw := json.RawMessage(`{
		"version":1,"aspectRatio":"1:1","background":"#ffffff",
		"elements":[{"id":"image-1","type":"image","name":"素材","dataUrl":"data:text/html;base64,PGgxPng8L2gxPg==","sourceAspect":1,"x":0,"y":0,"width":1,"height":1,"opacity":1,"visible":true,"locked":false}]
	}`)
	if _, err := ValidateAICanvasDocument(raw); err == nil {
		t.Fatal("expected unsafe image data URL to be rejected")
	}
}

func TestValidateAICanvasDocumentAcceptsWideImageAndRejectsOffCanvasPosition(t *testing.T) {
	pngData := "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="
	valid := json.RawMessage(`{
		"version":1,"aspectRatio":"16:9","background":"#ffffff",
		"elements":[{"id":"image-1","type":"image","name":"宽幅素材","dataUrl":"` + pngData + `","sourceAspect":4,"x":0,"y":0.25,"width":1,"height":0.25,"opacity":1,"visible":true,"locked":false}]
	}`)
	if _, err := ValidateAICanvasDocument(valid); err != nil {
		t.Fatalf("expected a safe panoramic image to be accepted: %v", err)
	}

	offCanvas := json.RawMessage(strings.Replace(string(valid), `"x":0`, `"x":-0.1`, 1))
	if _, err := ValidateAICanvasDocument(offCanvas); err == nil {
		t.Fatal("expected an off-canvas image position to be rejected")
	}

	invalidSource := json.RawMessage(strings.Replace(string(valid), `"sourceAspect":4`, `"sourceGenerationId":"other-user","sourceAspect":4`, 1))
	if _, err := ValidateAICanvasDocument(invalidSource); err == nil {
		t.Fatal("expected an invalid source generation ID to be rejected")
	}
}
