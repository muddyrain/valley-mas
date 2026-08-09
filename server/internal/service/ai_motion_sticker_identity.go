package service

import (
	"bytes"
	"errors"
	"fmt"
	"image"
	_ "image/jpeg"
	_ "image/png"
	"math"
	"sort"
)

const (
	motionStickerIdentityHueBins          = 24
	motionStickerIdentityMinColorFraction = 0.03
	motionStickerIdentityMinPaletteMatch  = 0.18
)

type motionStickerColorSignature struct {
	hues             [motionStickerIdentityHueBins]float64
	colorfulFraction float64
}

type motionStickerRGB struct {
	red   float64
	green float64
	blue  float64
}

// validateMotionStickerFrameIdentity is a deliberately conservative local
// guard. It only blocks a result when a colorful reference loses its salient
// palette across at least half of the generated frames. Monochrome references
// remain inconclusive instead of being rejected by a weak heuristic.
func validateMotionStickerFrameIdentity(reference motionStickerFrame, frames []motionStickerFrame) error {
	if len(frames) == 0 {
		return errors.New("角色一致性校验缺少生成帧")
	}
	referenceSignature, err := motionStickerFrameColorSignature(reference)
	if err != nil {
		return fmt.Errorf("角色参考图解析失败: %w", err)
	}
	if referenceSignature.colorfulFraction < motionStickerIdentityMinColorFraction {
		return nil
	}

	scores := make([]float64, 0, len(frames))
	for _, frame := range frames {
		frameSignature, err := motionStickerFrameColorSignature(frame)
		if err != nil {
			return fmt.Errorf("角色生成帧解析失败: %w", err)
		}
		scores = append(scores, motionStickerPaletteMatch(referenceSignature, frameSignature))
	}
	sort.Float64s(scores)
	lowerMedian := scores[(len(scores)-1)/2]
	if lowerMedian < motionStickerIdentityMinPaletteMatch {
		return errors.New("生成结果中的角色主色特征与参考图明显不一致")
	}
	return nil
}

func motionStickerFrameColorSignature(frame motionStickerFrame) (motionStickerColorSignature, error) {
	decoded, _, err := image.Decode(bytes.NewReader(frame.Content))
	if err != nil {
		return motionStickerColorSignature{}, err
	}
	bounds := decoded.Bounds()
	if bounds.Dx() <= 0 || bounds.Dy() <= 0 {
		return motionStickerColorSignature{}, errors.New("图片尺寸无效")
	}

	step := max(1, min(bounds.Dx(), bounds.Dy())/256)
	insetX := bounds.Dx() / 20
	insetY := bounds.Dy() / 20
	startX, endX := bounds.Min.X+insetX, bounds.Max.X-insetX
	startY, endY := bounds.Min.Y+insetY, bounds.Max.Y-insetY
	if startX >= endX || startY >= endY {
		startX, endX = bounds.Min.X, bounds.Max.X
		startY, endY = bounds.Min.Y, bounds.Max.Y
	}
	background, hasBackground := motionStickerFrameBackground(decoded)

	var signature motionStickerColorSignature
	var totalSamples, colorfulSamples int
	var totalWeight float64
	for y := startY; y < endY; y += step {
		for x := startX; x < endX; x += step {
			pixel := motionStickerPixelOverWhite(decoded, x, y)
			totalSamples++
			if hasBackground && motionStickerColorDistanceSquared(pixel, background) < 0.0256 {
				continue
			}
			hue, saturation, value := motionStickerRGBToHSV(pixel.red, pixel.green, pixel.blue)
			if saturation < 0.18 || value < 0.12 {
				continue
			}
			colorfulSamples++
			weight := saturation * (0.5 + 0.5*value)
			index := min(motionStickerIdentityHueBins-1, int(hue*motionStickerIdentityHueBins))
			signature.hues[index] += weight
			totalWeight += weight
		}
	}
	if totalSamples > 0 {
		signature.colorfulFraction = float64(colorfulSamples) / float64(totalSamples)
	}
	if totalWeight > 0 {
		for index := range signature.hues {
			signature.hues[index] /= totalWeight
		}
	}
	return signature, nil
}

func motionStickerFrameBackground(source image.Image) (motionStickerRGB, bool) {
	bounds := source.Bounds()
	insetX := max(1, bounds.Dx()/40)
	insetY := max(1, bounds.Dy()/40)
	points := [4]image.Point{
		{X: bounds.Min.X + insetX, Y: bounds.Min.Y + insetY},
		{X: bounds.Max.X - insetX - 1, Y: bounds.Min.Y + insetY},
		{X: bounds.Min.X + insetX, Y: bounds.Max.Y - insetY - 1},
		{X: bounds.Max.X - insetX - 1, Y: bounds.Max.Y - insetY - 1},
	}
	var average motionStickerRGB
	colors := make([]motionStickerRGB, 0, len(points))
	for _, point := range points {
		value := motionStickerPixelOverWhite(source, point.X, point.Y)
		colors = append(colors, value)
		average.red += value.red
		average.green += value.green
		average.blue += value.blue
	}
	average.red /= float64(len(colors))
	average.green /= float64(len(colors))
	average.blue /= float64(len(colors))
	for _, value := range colors {
		if motionStickerColorDistanceSquared(value, average) > 0.05 {
			return motionStickerRGB{}, false
		}
	}
	return average, true
}

func motionStickerPixelOverWhite(source image.Image, x, y int) motionStickerRGB {
	red16, green16, blue16, alpha16 := source.At(x, y).RGBA()
	return motionStickerRGB{
		red:   float64(red16+(0xffff-alpha16)) / 0xffff,
		green: float64(green16+(0xffff-alpha16)) / 0xffff,
		blue:  float64(blue16+(0xffff-alpha16)) / 0xffff,
	}
}

func motionStickerColorDistanceSquared(left, right motionStickerRGB) float64 {
	red := left.red - right.red
	green := left.green - right.green
	blue := left.blue - right.blue
	return red*red + green*green + blue*blue
}

func motionStickerPaletteMatch(reference, frame motionStickerColorSignature) float64 {
	var best float64
	for shift := -1; shift <= 1; shift++ {
		var score float64
		for index, referenceWeight := range reference.hues {
			frameIndex := (index + shift + motionStickerIdentityHueBins) % motionStickerIdentityHueBins
			score += min(referenceWeight, frame.hues[frameIndex])
		}
		best = max(best, score)
	}
	return min(1, best)
}

func motionStickerRGBToHSV(red, green, blue float64) (float64, float64, float64) {
	maximum := max(red, green, blue)
	minimum := min(red, green, blue)
	delta := maximum - minimum
	if maximum == 0 {
		return 0, 0, 0
	}
	saturation := delta / maximum
	if delta == 0 {
		return 0, saturation, maximum
	}
	var hue float64
	switch maximum {
	case red:
		hue = math.Mod((green-blue)/delta, 6)
	case green:
		hue = (blue-red)/delta + 2
	default:
		hue = (red-green)/delta + 4
	}
	hue /= 6
	if hue < 0 {
		hue++
	}
	return hue, saturation, maximum
}
