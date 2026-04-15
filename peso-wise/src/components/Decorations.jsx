/* Decorative SVG components — cool-tone, visible organic shapes */

export function LeafDecor({ className, style }) {
  return (
    <svg className={className} style={style} viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M60 10C60 10 20 30 20 65C20 90 38 105 60 105C82 105 100 90 100 65C100 30 60 10 60 10Z" fill="var(--accent-teal-strong)" opacity="0.35"/>
      <path d="M60 25C60 25 35 42 35 68C35 85 46 95 60 95C74 95 85 85 85 68C85 42 60 25 60 25Z" fill="var(--accent-teal)" opacity="0.4"/>
      <path d="M60 15V100" stroke="var(--color-primary)" strokeWidth="1.5" opacity="0.25"/>
      <path d="M60 40C48 48 40 58 38 70" stroke="var(--color-primary)" strokeWidth="1.2" opacity="0.2" strokeLinecap="round"/>
      <path d="M60 40C72 48 80 58 82 70" stroke="var(--color-primary)" strokeWidth="1.2" opacity="0.2" strokeLinecap="round"/>
      <path d="M60 55C52 60 46 66 44 75" stroke="var(--color-primary)" strokeWidth="0.8" opacity="0.15" strokeLinecap="round"/>
      <path d="M60 55C68 60 74 66 76 75" stroke="var(--color-primary)" strokeWidth="0.8" opacity="0.15" strokeLinecap="round"/>
    </svg>
  )
}

export function PlantDecor({ className, style }) {
  return (
    <svg className={className} style={style} viewBox="0 0 100 140" fill="none" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="50" cy="132" rx="22" ry="7" fill="var(--accent-warm)" opacity="0.4"/>
      <path d="M50 130V55" stroke="var(--color-primary)" strokeWidth="2.5" opacity="0.2" strokeLinecap="round"/>
      <path d="M50 90C32 78 18 80 14 88C10 96 20 102 36 96C44 92 48 90 50 90Z" fill="var(--accent-teal-strong)" opacity="0.35"/>
      <path d="M50 70C68 58 82 60 86 68C90 76 80 84 64 78C56 74 52 70 50 70Z" fill="var(--accent-teal)" opacity="0.4"/>
      <path d="M50 55C36 38 24 34 18 40C12 46 22 56 38 52C46 50 48 55 50 55Z" fill="var(--accent-teal-strong)" opacity="0.3"/>
    </svg>
  )
}

export function WaveDecor({ className, style, color = 'var(--accent-teal)' }) {
  return (
    <svg className={className} style={{ width: '100%', ...style }} viewBox="0 0 400 40" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
      <path d="M0 20C50 8 100 32 150 20C200 8 250 32 300 20C350 8 400 32 400 20V40H0V20Z" fill={color} opacity="0.4"/>
      <path d="M0 24C60 14 110 34 170 24C230 14 280 34 340 24C380 17 400 22 400 24V40H0V24Z" fill={color} opacity="0.25"/>
    </svg>
  )
}

export function BlobDecor({ className, style, color = 'var(--accent-ice)' }) {
  return (
    <svg className={className} style={style} viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M140 30C170 50 190 90 170 130C150 170 110 190 70 170C30 150 10 110 30 70C50 30 110 10 140 30Z" fill={color} opacity="0.4"/>
    </svg>
  )
}

export function SparkleDecor({ className, style }) {
  return (
    <svg className={className} style={style} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2L13.5 9L20 8L14.5 12.5L18 19L12 15L6 19L9.5 12.5L4 8L10.5 9L12 2Z" fill="var(--color-primary)" opacity="0.15"/>
    </svg>
  )
}
