/**
 * PesoWise Logo — A peso sign (₱) growing from a leaf,
 * symbolizing financial growth and mindful money management.
 */
export default function PesoWiseLogo({ size = 36, className, style }) {
  return (
    <svg
      className={className}
      style={style}
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Background circle */}
      <rect width="64" height="64" rx="16" fill="url(#pw-bg)"/>

      {/* Subtle leaf behind the peso sign */}
      <path
        d="M44 14C44 14 52 26 48 38C44 50 34 52 28 48C22 44 20 34 24 24C28 14 44 14 44 14Z"
        fill="white"
        opacity="0.12"
      />
      <path
        d="M40 18C40 18 46 28 43 37C40 46 33 48 28 44C23 40 22 33 25 26C28 19 40 18 40 18Z"
        fill="white"
        opacity="0.08"
      />

      {/* Peso sign (₱) — bold, clean, centered */}
      <text
        x="32"
        y="45"
        fontFamily="'Nunito', Arial, sans-serif"
        fontSize="36"
        fontWeight="800"
        fill="white"
        textAnchor="middle"
        letterSpacing="-1"
      >₱</text>

      {/* Small upward arrow / growth indicator */}
      <path
        d="M46 18L50 14L54 18"
        stroke="white"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.7"
      />
      <line
        x1="50" y1="14"
        x2="50" y2="24"
        stroke="white"
        strokeWidth="2.5"
        strokeLinecap="round"
        opacity="0.7"
      />

      <defs>
        <linearGradient id="pw-bg" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#4A7C6F"/>
          <stop offset="100%" stopColor="#3B655A"/>
        </linearGradient>
      </defs>
    </svg>
  )
}

/**
 * Inline logo for nav bar — smaller, just the icon
 */
export function PesoWiseLogoMini({ size = 20 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Leaf shape */}
      <path
        d="M44 14C44 14 52 26 48 38C44 50 34 52 28 48C22 44 20 34 24 24C28 14 44 14 44 14Z"
        fill="white"
        opacity="0.2"
      />

      {/* Peso sign */}
      <text
        x="30"
        y="45"
        fontFamily="'Nunito', Arial, sans-serif"
        fontSize="36"
        fontWeight="800"
        fill="white"
        textAnchor="middle"
        letterSpacing="-1"
      >₱</text>

      {/* Growth arrow */}
      <path
        d="M46 18L50 13L54 18"
        stroke="white"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.8"
      />
      <line
        x1="50" y1="13"
        x2="50" y2="24"
        stroke="white"
        strokeWidth="2.5"
        strokeLinecap="round"
        opacity="0.8"
      />
    </svg>
  )
}
