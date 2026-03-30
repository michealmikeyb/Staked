interface LogoProps {
  variant?: 'mark' | 'full';
  size?: number;
  onClick?: () => void;
}

/**
 * Stakswipe logo.
 * variant="mark"  — card-stack icon only (for HeaderBar)
 * variant="full"  — icon + wordmark (for LoginPage / splash)
 * size            — icon height in px (default 32); wordmark scales proportionally
 */
export default function Logo({ variant = 'mark', size = 32, onClick }: LogoProps) {
  // Three fanned playing cards with a right-arrow on the front card.
  // viewBox 34×34; all cards pivot around (17, 17).
  const cardMark = (
    <svg
      viewBox="0 0 34 34"
      width={size}
      height={size}
      style={{ display: 'block', flexShrink: 0, overflow: 'visible' }}
      aria-hidden="true"
    >
      {/* back card — muted */}
      <rect
        x="8" y="4" width="18" height="26" rx="3"
        fill="#0a0d14" stroke="#1e2235" strokeWidth="1.5"
        transform="rotate(-14 17 17)"
      />
      {/* middle card */}
      <rect
        x="8" y="4" width="18" height="26" rx="3"
        fill="#10131e" stroke="#2a2f45" strokeWidth="1.5"
        transform="rotate(-4 17 17)"
      />
      {/* front card — orange accent */}
      <rect
        x="8" y="4" width="18" height="26" rx="3"
        fill="#18203a" stroke="#ff6b35" strokeWidth="2"
        transform="rotate(6 17 17)"
      />
      {/* swipe-right chevron on front card, rotated with it */}
      <g transform="rotate(6 17 17)">
        <polyline
          points="13.5,13.5 20,17 13.5,20.5"
          stroke="#ff6b35" strokeWidth="2.2"
          strokeLinecap="round" strokeLinejoin="round"
          fill="none"
        />
      </g>
    </svg>
  );

  if (variant === 'mark') {
    if (onClick) {
      return (
        <button
          onClick={onClick}
          aria-label="Stakswipe home"
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex' }}
        >
          {cardMark}
        </button>
      );
    }
    return cardMark;
  }

  // full: icon + wordmark side-by-side
  return (
    <div
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: Math.round(size * 0.28),
        cursor: onClick ? 'pointer' : 'default',
      }}
    >
      {cardMark}
      <span
        aria-label="Stakswipe"
        style={{
          fontFamily: "'Syne', system-ui, sans-serif",
          fontWeight: 800,
          fontSize: Math.round(size * 0.72),
          lineHeight: 1,
          letterSpacing: '-0.5px',
          userSelect: 'none',
        }}
      >
        <span style={{ color: '#f5f5f5' }}>STAK</span>
        <span style={{ color: '#ff6b35' }}>SWIPE</span>
      </span>
    </div>
  );
}
