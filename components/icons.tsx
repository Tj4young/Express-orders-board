type IconProps = { size?: number };

export function IconSound({ on, size = 18 }: IconProps & { on: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 10h3l5-4v12l-5-4H4z" fill="currentColor" stroke="none" />
      {on ? (
        <path d="M16 9a4 4 0 0 1 0 6M18.5 7a7 7 0 0 1 0 10" strokeLinecap="round" />
      ) : (
        <path d="M16 10l5 5M21 10l-5 5" strokeLinecap="round" />
      )}
    </svg>
  );
}

export function IconLock({ open, size = 18 }: IconProps & { open: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="5" y="11" width="14" height="9" rx="2" />
      {open ? <path d="M8 11V8a4 4 0 0 1 7.5-2" strokeLinecap="round" /> : <path d="M8 11V8a4 4 0 0 1 8 0v3" strokeLinecap="round" />}
    </svg>
  );
}

export function IconTrophy({ size = 22 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#F5C451"
        d="M7 4h10v2h3v2.2a4.8 4.8 0 0 1-4.2 4.76A5.5 5.5 0 0 1 13 16.7V19h3v2H8v-2h3v-2.3a5.5 5.5 0 0 1-2.8-3.74A4.8 4.8 0 0 1 4 8.2V6h3V4zm0 4H6v.2a2.8 2.8 0 0 0 2.2 2.74A5.5 5.5 0 0 1 8 9.2V8zm10 0v1.2a5.5 5.5 0 0 1-.2 1.74A2.8 2.8 0 0 0 20 8.2V8h-3z"
      />
    </svg>
  );
}
