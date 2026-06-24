interface LogoProps {
  className?: string;
}

/**
 * The e2e-testora brand mark: two endpoint nodes connected by a path that
 * resolves into a "test passed" checkmark — end-to-end, verified — set on a
 * violet→sky squircle that mirrors the app's primary/accent palette.
 *
 * Kept in sync with src/app/icon.svg (the favicon). The gradient ids are
 * namespaced so multiple instances on a page don't collide.
 */
export function Logo({ className }: LogoProps) {
  return (
    <svg
      viewBox="0 0 512 512"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="e2e-testora"
      className={className}
    >
      <defs>
        <linearGradient id="logo-bg" x1="40" y1="32" x2="472" y2="488" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#a78bfa" />
          <stop offset="0.52" stopColor="#7c5cf6" />
          <stop offset="1" stopColor="#22a7f0" />
        </linearGradient>
        <linearGradient id="logo-check" x1="150" y1="360" x2="372" y2="150" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#eaf7ff" />
        </linearGradient>
        <radialGradient id="logo-glow" cx="0.32" cy="0.24" r="0.85">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.32" />
          <stop offset="0.55" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
      </defs>

      <rect x="0" y="0" width="512" height="512" rx="124" fill="url(#logo-bg)" />
      <rect x="0" y="0" width="512" height="512" rx="124" fill="url(#logo-glow)" />

      <path
        d="M152 262 L228 344 L372 166"
        fill="none"
        stroke="url(#logo-check)"
        strokeWidth="46"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      <circle cx="152" cy="262" r="30" fill="#ffffff" />
      <circle cx="152" cy="262" r="13" fill="#7c5cf6" />
      <circle cx="372" cy="166" r="30" fill="#ffffff" />
      <circle cx="372" cy="166" r="13" fill="#1f9fed" />

      <path d="M408 250 l9 22 22 9 -22 9 -9 22 -9 -22 -22 -9 22 -9 z" fill="#ffffff" fillOpacity="0.9" />
    </svg>
  );
}
