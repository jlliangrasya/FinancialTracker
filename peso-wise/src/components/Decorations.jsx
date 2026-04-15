/* Decorative SVG components for a calming, Canva-like aesthetic */

export function LeafDecor({ className, style }) {
  return (
    <svg className={className} style={style} viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M60 10C60 10 20 30 20 65C20 90 38 105 60 105C82 105 100 90 100 65C100 30 60 10 60 10Z" fill="var(--pastel-mint)" opacity="0.5"/>
      <path d="M60 25C60 25 35 42 35 68C35 85 46 95 60 95C74 95 85 85 85 68C85 42 60 25 60 25Z" fill="var(--pastel-mint)" opacity="0.3"/>
      <path d="M60 15V100" stroke="var(--color-primary)" strokeWidth="1.5" opacity="0.2"/>
      <path d="M60 40C48 48 40 58 38 70" stroke="var(--color-primary)" strokeWidth="1" opacity="0.15" strokeLinecap="round"/>
      <path d="M60 40C72 48 80 58 82 70" stroke="var(--color-primary)" strokeWidth="1" opacity="0.15" strokeLinecap="round"/>
    </svg>
  )
}

export function PlantDecor({ className, style }) {
  return (
    <svg className={className} style={style} viewBox="0 0 100 140" fill="none" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="50" cy="130" rx="25" ry="8" fill="var(--pastel-peach)" opacity="0.4"/>
      <path d="M50 130V60" stroke="var(--color-primary)" strokeWidth="2" opacity="0.2" strokeLinecap="round"/>
      <path d="M50 90C35 80 22 82 18 88C14 94 22 100 35 95C42 92 48 90 50 90Z" fill="var(--pastel-mint)" opacity="0.5"/>
      <path d="M50 72C65 62 78 64 82 70C86 76 78 82 65 77C58 74 52 72 50 72Z" fill="var(--pastel-sage)" opacity="0.5"/>
      <path d="M50 60C38 45 28 40 22 44C16 48 24 58 38 56C44 55 48 58 50 60Z" fill="var(--pastel-mint)" opacity="0.4"/>
      <ellipse cx="50" cy="130" rx="18" ry="5" fill="var(--pastel-peach)" opacity="0.3"/>
    </svg>
  )
}

export function WaveDecor({ className, style, color = 'var(--pastel-mint)' }) {
  return (
    <svg className={className} style={{ width: '100%', ...style }} viewBox="0 0 400 40" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
      <path d="M0 20C50 8 100 32 150 20C200 8 250 32 300 20C350 8 400 32 400 20V40H0V20Z" fill={color} opacity="0.3"/>
      <path d="M0 24C60 14 110 34 170 24C230 14 280 34 340 24C380 17 400 22 400 24V40H0V24Z" fill={color} opacity="0.2"/>
    </svg>
  )
}

export function BlobDecor({ className, style, color = 'var(--pastel-lavender)' }) {
  return (
    <svg className={className} style={style} viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M140 30C170 50 190 90 170 130C150 170 110 190 70 170C30 150 10 110 30 70C50 30 110 10 140 30Z" fill={color} opacity="0.3"/>
    </svg>
  )
}

export function SparkleDecor({ className, style }) {
  return (
    <svg className={className} style={style} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2L13.5 9L20 8L14.5 12.5L18 19L12 15L6 19L9.5 12.5L4 8L10.5 9L12 2Z" fill="var(--pastel-butter)" opacity="0.6"/>
    </svg>
  )
}
