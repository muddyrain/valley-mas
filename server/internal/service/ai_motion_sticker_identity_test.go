package service

import (
	"bytes"
	"image"
	"image/color"
	"image/png"
	"strings"
	"testing"
)

func motionStickerTestCharacterFrame(t *testing.T, background, subject color.RGBA, subjectSize int) motionStickerFrame {
	t.Helper()
	canvas := image.NewRGBA(image.Rect(0, 0, 128, 128))
	for y := 0; y < 128; y++ {
		for x := 0; x < 128; x++ {
			canvas.SetRGBA(x, y, background)
		}
	}
	start, end := (128-subjectSize)/2, (128+subjectSize)/2
	for y := start; y < end; y++ {
		for x := start; x < end; x++ {
			canvas.SetRGBA(x, y, subject)
		}
	}
	var output bytes.Buffer
	if err := png.Encode(&output, canvas); err != nil {
		t.Fatal(err)
	}
	return motionStickerFrame{Content: output.Bytes(), MIMEType: "image/png"}
}

func TestValidateMotionStickerFrameIdentityAcceptsPreservedCharacterPalette(t *testing.T) {
	white := color.RGBA{R: 245, G: 245, B: 245, A: 255}
	reference := motionStickerTestCharacterFrame(t, white, color.RGBA{R: 220, G: 45, B: 55, A: 255}, 72)
	frames := []motionStickerFrame{
		motionStickerTestCharacterFrame(t, white, color.RGBA{R: 210, G: 50, B: 60, A: 255}, 64),
		motionStickerTestCharacterFrame(t, white, color.RGBA{R: 225, G: 55, B: 65, A: 255}, 68),
		motionStickerTestCharacterFrame(t, white, color.RGBA{R: 215, G: 40, B: 50, A: 255}, 60),
	}
	if err := validateMotionStickerFrameIdentity(reference, frames); err != nil {
		t.Fatalf("preserved character rejected: %v", err)
	}
}

func TestValidateMotionStickerFrameIdentityIgnoresNewSceneBackgroundColor(t *testing.T) {
	white := color.RGBA{R: 245, G: 245, B: 245, A: 255}
	blue := color.RGBA{R: 25, G: 85, B: 205, A: 255}
	red := color.RGBA{R: 220, G: 45, B: 55, A: 255}
	reference := motionStickerTestCharacterFrame(t, white, red, 72)
	frames := []motionStickerFrame{
		motionStickerTestCharacterFrame(t, blue, red, 28),
		motionStickerTestCharacterFrame(t, blue, red, 30),
		motionStickerTestCharacterFrame(t, blue, red, 26),
	}
	if err := validateMotionStickerFrameIdentity(reference, frames); err != nil {
		t.Fatalf("scene background must not replace the character palette: %v", err)
	}
}

func TestValidateMotionStickerFrameIdentityRejectsGrossCharacterPaletteDrift(t *testing.T) {
	white := color.RGBA{R: 245, G: 245, B: 245, A: 255}
	reference := motionStickerTestCharacterFrame(t, white, color.RGBA{R: 220, G: 45, B: 55, A: 255}, 72)
	frames := []motionStickerFrame{
		motionStickerTestCharacterFrame(t, white, color.RGBA{R: 30, G: 90, B: 210, A: 255}, 72),
		motionStickerTestCharacterFrame(t, white, color.RGBA{R: 35, G: 95, B: 220, A: 255}, 72),
		motionStickerTestCharacterFrame(t, white, color.RGBA{R: 25, G: 85, B: 205, A: 255}, 72),
	}
	err := validateMotionStickerFrameIdentity(reference, frames)
	if err == nil || !strings.Contains(err.Error(), "角色") {
		t.Fatalf("expected character identity drift, got %v", err)
	}
}

func TestValidateMotionStickerFrameIdentityKeepsMonochromeReferencesInconclusive(t *testing.T) {
	white := color.RGBA{R: 245, G: 245, B: 245, A: 255}
	reference := motionStickerTestCharacterFrame(t, white, color.RGBA{R: 80, G: 80, B: 80, A: 255}, 72)
	frames := []motionStickerFrame{motionStickerTestCharacterFrame(t, white, color.RGBA{R: 40, G: 40, B: 40, A: 255}, 72)}
	if err := validateMotionStickerFrameIdentity(reference, frames); err != nil {
		t.Fatalf("inconclusive monochrome reference must not be rejected: %v", err)
	}
}
