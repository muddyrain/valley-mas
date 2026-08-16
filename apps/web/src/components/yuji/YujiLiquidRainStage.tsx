import { ArrowDownRight } from 'lucide-react';
import { type CSSProperties, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import moonlitButterflyRuins from '@/assets/yuji-brand/moonlit-butterfly-ruins.webp';
import parasolWhisper from '@/assets/yuji-brand/parasol-whisper.webp';
import rainboundObservatory from '@/assets/yuji-brand/rainbound-observatory.webp';
import skyPetalMaiden from '@/assets/yuji-brand/sky-petal-maiden.webp';
import { useYujiPublicChrome } from '@/features/yuji-public/YujiPublicChromeContext';
import { useYujiMagicScroll } from '@/hooks/useYujiMagicScroll';

const BRAND_TEXTURES = [
  moonlitButterflyRuins,
  rainboundObservatory,
  skyPetalMaiden,
  parasolWhisper,
] as const;

function portalStyle(image: string) {
  return { '--yuji-portal-preview': `url(${image})` } as CSSProperties;
}

export default function YujiLiquidRainStage() {
  const sectionRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chrome = useYujiPublicChrome();
  const paperStyle = useMemo(
    () =>
      ({
        '--yuji-stage-paper-image': `url(${skyPetalMaiden})`,
      }) as CSSProperties,
    [],
  );

  useYujiMagicScroll({
    canvasRef,
    onHeaderSurfaceChange: chrome?.setHeaderSurface,
    sectionRef,
    textureUrls: BRAND_TEXTURES,
  });

  return (
    <section
      ref={sectionRef}
      className="yuji-liquid-rain-stage"
      data-rendering="static"
      data-scene="arrival"
      aria-labelledby="yuji-brand-stage-title"
    >
      <div className="yuji-liquid-rain-sticky">
        <div className="yuji-liquid-rain-paper" style={paperStyle} aria-hidden="true" />

        <nav className="yuji-liquid-rain-portals" aria-label="选择浏览内容">
          <Link
            className="yuji-liquid-portal"
            style={portalStyle(rainboundObservatory)}
            to="/articles"
          >
            <span>01 / WRITING</span>
            <strong>文章</strong>
            <small>技术、判断与持续思考</small>
            <ArrowDownRight aria-hidden="true" />
          </Link>
          <Link
            className="yuji-liquid-portal"
            style={portalStyle(moonlitButterflyRuins)}
            to="/gallery"
          >
            <span>02 / IMAGES</span>
            <strong>影像</strong>
            <small>观看、光线与世界切片</small>
            <ArrowDownRight aria-hidden="true" />
          </Link>
        </nav>

        <div className="yuji-liquid-rain-canvas-shell" aria-hidden="true">
          <canvas ref={canvasRef} className="yuji-liquid-rain-canvas" />
        </div>
        <div className="yuji-liquid-rain-grain" aria-hidden="true" />

        <div className="yuji-liquid-rain-signature">
          <p>RAIN / TRACE</p>
          <h1 id="yuji-brand-stage-title">雨迹</h1>
          <p className="yuji-liquid-rain-tagline">在技术与影像之间，留下思考的痕迹。</p>
        </div>

        <div className="yuji-liquid-rain-cue" aria-hidden="true">
          <span />
          SCROLL TO REFRACT
        </div>
      </div>
    </section>
  );
}
