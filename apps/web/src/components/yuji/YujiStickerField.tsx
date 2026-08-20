export default function YujiStickerField() {
  return (
    <div className="yuji-sticker-field" aria-hidden="true">
      <svg className="yuji-sticker is-eye" viewBox="0 0 112 68">
        <defs>
          <linearGradient id="yuji-eye-paper" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0" stopColor="#fffde7" />
            <stop offset="1" stopColor="#dff4ff" />
          </linearGradient>
        </defs>
        <path
          d="M5 36C19 10 43 2 72 8c18 4 29 14 35 27-12 20-31 29-57 27C27 61 12 53 5 36Z"
          fill="url(#yuji-eye-paper)"
          stroke="#080b0f"
          strokeWidth="4"
        />
        <circle cx="58" cy="35" r="15" fill="#1739ff" stroke="#080b0f" strokeWidth="3" />
        <circle cx="58" cy="35" r="6" fill="#080b0f" />
        <circle cx="63" cy="29" r="3" fill="#fff" />
      </svg>

      <svg className="yuji-sticker is-orbit" viewBox="0 0 100 100">
        <defs>
          <radialGradient id="yuji-orbit-fill" cx="35%" cy="25%" r="75%">
            <stop offset="0" stopColor="#a8f7ff" />
            <stop offset="0.46" stopColor="#5d66ff" />
            <stop offset="1" stopColor="#2f1ae8" />
          </radialGradient>
        </defs>
        <circle
          cx="50"
          cy="50"
          r="43"
          fill="url(#yuji-orbit-fill)"
          stroke="#080b0f"
          strokeWidth="4"
        />
        <path d="M17 61c19-19 45-27 70-22" fill="none" stroke="#fff" strokeWidth="3" />
        <path d="m52 25 4 11 11 4-11 4-4 11-4-11-11-4 11-4 4-11Z" fill="#d4ff34" />
        <circle cx="24" cy="60" r="5" fill="#ff5ea9" />
      </svg>

      <svg className="yuji-sticker is-smile" viewBox="0 0 108 108">
        <defs>
          <pattern id="yuji-smile-dots" width="7" height="7" patternUnits="userSpaceOnUse">
            <circle cx="1.8" cy="1.8" r="1.4" fill="#0a1420" opacity="0.22" />
          </pattern>
          <filter id="yuji-smile-rough" x="-15%" y="-15%" width="130%" height="130%">
            <feTurbulence baseFrequency="0.018" numOctaves="2" seed="8" result="noise" />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="1.6" />
          </filter>
        </defs>
        <g filter="url(#yuji-smile-rough)">
          <path
            d="M54 5C75 4 95 18 101 38c7 23-1 46-19 59-18 12-45 9-61-6C7 78 2 56 10 36 18 16 34 7 54 5Z"
            fill="#ffd34e"
            stroke="#07111a"
            strokeWidth="5"
          />
          <path
            d="M54 5C75 4 95 18 101 38c7 23-1 46-19 59-18 12-45 9-61-6C7 78 2 56 10 36 18 16 34 7 54 5Z"
            fill="url(#yuji-smile-dots)"
          />
        </g>
        <path d="M27 43h16v10H27zm38 0h16v10H65z" fill="#07111a" />
        <path
          d="M30 67c13 15 34 17 49 0"
          fill="none"
          stroke="#07111a"
          strokeLinecap="round"
          strokeWidth="6"
        />
        <path d="m87 17 6 4-5 5" fill="none" stroke="#ff4f98" strokeWidth="4" />
      </svg>

      <svg className="yuji-sticker is-stamp" viewBox="0 0 112 112">
        <defs>
          <pattern id="yuji-stamp-hatch" width="6" height="6" patternUnits="userSpaceOnUse">
            <path d="M0 6 6 0" stroke="#15304d" strokeWidth="1.4" opacity="0.28" />
          </pattern>
        </defs>
        <circle cx="56" cy="56" r="49" fill="#dff5ef" stroke="#07111a" strokeWidth="5" />
        <circle
          cx="56"
          cy="56"
          r="40"
          fill="url(#yuji-stamp-hatch)"
          stroke="#15304d"
          strokeDasharray="5 4"
          strokeWidth="3"
        />
        <text
          x="56"
          y="51"
          fill="#07111a"
          fontFamily="Arial Black, sans-serif"
          fontSize="27"
          fontWeight="900"
          textAnchor="middle"
        >
          YJ
        </text>
        <path d="M30 61h52" stroke="#07111a" strokeWidth="4" />
        <text
          x="56"
          y="78"
          fill="#07111a"
          fontFamily="monospace"
          fontSize="13"
          fontWeight="800"
          textAnchor="middle"
        >
          2026
        </text>
      </svg>

      <svg className="yuji-sticker is-bloom" viewBox="0 0 110 110">
        <defs>
          <linearGradient id="yuji-bloom-metal" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0" stopColor="#fff" />
            <stop offset="0.35" stopColor="#9feaff" />
            <stop offset="0.7" stopColor="#7867ff" />
            <stop offset="1" stopColor="#fff" />
          </linearGradient>
        </defs>
        <path
          d="M55 4c8 0 11 24 15 27 5 3 25-10 30-4 6 6-10 25-7 31 2 5 14 16 11 24-4 8-27 0-32 5-5 4-7 19-17 19-9 0-12-20-17-23-5-3-24 8-30 1-6-7 11-24 9-30-2-6-15-18-11-26 4-8 27 2 32-2 5-4 8-22 17-22Z"
          fill="url(#yuji-bloom-metal)"
          stroke="#080b0f"
          strokeWidth="4"
        />
        <circle cx="55" cy="56" r="17" fill="#1739ff" stroke="#080b0f" strokeWidth="4" />
        <circle cx="55" cy="56" r="6" fill="#d9ff37" />
      </svg>

      <svg className="yuji-sticker is-ticket" viewBox="0 0 128 76">
        <path
          d="M7 8h114v17c-8 1-12 7-12 13s4 12 12 13v17H7V51c8-1 12-7 12-13S15 26 7 25V8Z"
          fill="#ff7048"
          stroke="#080b0f"
          strokeWidth="4"
        />
        <path
          d="M31 17v42M96 17v42"
          fill="none"
          stroke="#080b0f"
          strokeDasharray="4 5"
          strokeWidth="2"
        />
        <text
          x="64"
          y="36"
          fill="#080b0f"
          fontFamily="monospace"
          fontSize="10"
          fontWeight="800"
          textAnchor="middle"
        >
          YUJI / TRACE
        </text>
        <text x="64" y="51" fill="#080b0f" fontFamily="monospace" fontSize="8" textAnchor="middle">
          31.2304 N
        </text>
      </svg>
    </div>
  );
}
