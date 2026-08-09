package service

import (
	"slices"
	"strings"
	"testing"
)

func TestCompileAIMotionStickerPromptPreservesActionAndLoopContract(t *testing.T) {
	prompt := CompileAIMotionStickerPrompt("坐在沙发上玩手机")
	for _, expected := range []string{"坐在沙发上玩手机", "保持角色一致", "回到初始姿势", "不要添加文字"} {
		if !strings.Contains(prompt, expected) {
			t.Fatalf("prompt missing %q: %s", expected, prompt)
		}
	}
}

func TestCompileAIMotionStickerImagePromptRequestsOrderedLoopFrames(t *testing.T) {
	prompt := CompileAIMotionStickerImagePrompt("坐在沙发上玩手机", 6)
	for _, expected := range []string{"坐在沙发上玩手机", "6 张", "角色一致", "第一张", "最后一张", "不要添加文字"} {
		if !strings.Contains(prompt, expected) {
			t.Fatalf("image prompt missing %q: %s", expected, prompt)
		}
	}
}

func TestMotionStickerFrameFFmpegArgsUseInfiniteLoop(t *testing.T) {
	args := motionStickerFrameFFmpegArgs("frames.txt", "output.gif")
	joined := strings.Join(args, " ")
	for _, expected := range []string{"-f concat", "frames.txt", "scale=320:320", "palettegen", "paletteuse", "-loop 0", "output.gif"} {
		if !strings.Contains(joined, expected) {
			t.Fatalf("frame args missing %q: %s", expected, joined)
		}
	}
}

func TestMotionStickerFFmpegArgsUseBoundedPalettePipeline(t *testing.T) {
	args := motionStickerFFmpegArgs("input.mp4", "output.gif")
	joined := strings.Join(args, " ")
	for _, expected := range []string{"-i input.mp4", "fps=12", "scale=320:320", "palettegen", "paletteuse", "-loop 0", "output.gif"} {
		if !strings.Contains(joined, expected) {
			t.Fatalf("args missing %q: %s", expected, joined)
		}
	}
	if slices.Contains(args, "-y") {
		t.Fatalf("transcoder must not overwrite an existing output: %v", args)
	}
}
