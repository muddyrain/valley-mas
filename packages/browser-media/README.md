# `@valley/browser-media`

Browser-native file and image utilities with no runtime dependencies.

## Image transform interface

`transformImageFile(file, options)` performs a transform pipeline behind one interface:

- JPEG, PNG, and WebP output conversion and quality control
- compression and maximum-dimension resizing
- source-pixel cropping
- contain, cover, and fill resizing
- arbitrary rotation and horizontal or vertical flipping
- output corner radius and background color
- configurable text watermark

Crop is applied first, resize second, rotation and flip third, and output clipping and watermarking last. GIF input is intentionally rejected by the explicit transform interface because a static Canvas export would silently discard animation frames. The legacy `resizeImageFile` and `compressImageFile` helpers retain their fallback-to-original behavior.

```ts
import { transformImageFile } from '@valley/browser-media';

const output = await transformImageFile(file, {
  crop: { x: 80, y: 40, width: 1200, height: 800 },
  width: 960,
  height: 540,
  fit: 'cover',
  rotateDegrees: 90,
  flipHorizontal: true,
  cornerRadius: 24,
  watermark: { text: 'Valley MAS', position: 'bottom-right' },
  mimeType: 'image/webp',
  quality: 0.82,
});
```

## Tool-host integration

`getBrowserImageToolManifest()` returns a JSON-serializable `image.transform` description. `runBrowserImageTool()` provides a non-throwing runner for browser tool hosts.

The implementation requires browser Canvas and image decoding. A Node or Go agent runtime must supply its own binary image adapter at this seam; the package does not pretend browser Canvas is available server-side.
