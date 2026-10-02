/** Fine line icons, drawn to match the serif (1.5px strokes, round ends). */
const PATHS = {
  pencil: "M4 20l4.2-1 10.6-10.6a2 2 0 0 0 0-2.8l-.4-.4a2 2 0 0 0-2.8 0L5 15.8 4 20zM13.5 6.5l4 4",
  camera: "M4 8.5A1.5 1.5 0 0 1 5.5 7h2l1.4-2h6.2l1.4 2h2A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5zM12 16.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z",
  book: "M5 4.5h9a3 3 0 0 1 3 3V20H8a3 3 0 0 1-3-3zM5 17a3 3 0 0 1 3-3h9M9 8h5",
  games: "M7 9.5h4M9 7.5v4M15 9h.01M17 11h.01M6.5 5h11A3.5 3.5 0 0 1 21 8.5l-.6 6.2a2.5 2.5 0 0 1-4.3 1.5L14 14h-4l-2.1 2.2a2.5 2.5 0 0 1-4.3-1.5L3 8.5A3.5 3.5 0 0 1 6.5 5z",
  gift: "M4 9h16v3H4zM5.5 12v8h13v-8M12 9v11M12 9S10.5 4 8 4.5 7.5 9 12 9zm0 0s1.5-5 4-4.5S16.5 9 12 9z",
  ticket: "M4 7h16v3a2 2 0 0 0 0 4v3H4v-3a2 2 0 0 0 0-4zM14 7v10",
  arrowLeft: "M15 6l-6 6 6 6",
  arrowRight: "M9 6l6 6-6 6",
  heart: "M12 19s-7-4.4-7-9.5A3.8 3.8 0 0 1 12 7a3.8 3.8 0 0 1 7 2.5C19 14.6 12 19 12 19z",
  mic: "M12 4a2.5 2.5 0 0 1 2.5 2.5v5a2.5 2.5 0 0 1-5 0v-5A2.5 2.5 0 0 1 12 4zM6.5 11a5.5 5.5 0 0 0 11 0M12 16.5V20",
  video: "M4 7.5A1.5 1.5 0 0 1 5.5 6h8A1.5 1.5 0 0 1 15 7.5v9a1.5 1.5 0 0 1-1.5 1.5h-8A1.5 1.5 0 0 1 4 16.5zM15 10.5l5-3v9l-5-3",
  check: "M5 12.5l4.5 4.5L19 7.5",
  external: "M14 5h5v5M19 5l-8 8M18 14v4a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h4",
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 24, style }: { name: IconName; size?: number; style?: React.CSSProperties }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={style}>
      <path d={PATHS[name]} />
    </svg>
  );
}

/** A small foil flourish: rule, sparkle, rule. */
export function Ornament({ width = 72, style }: { width?: number; style?: React.CSSProperties }) {
  return (
    <svg width={width} height={14} viewBox="0 0 72 14" fill="none" aria-hidden="true" className="pp-ornament" style={style}>
      <path d="M2 7h24M46 7h24" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
      <path d="M36 1.5c.6 3.2 2.3 4.9 5.5 5.5-3.2.6-4.9 2.3-5.5 5.5-.6-3.2-2.3-4.9-5.5-5.5 3.2-.6 4.9-2.3 5.5-5.5z" fill="currentColor" />
      <circle cx="29" cy="7" r="1" fill="currentColor" />
      <circle cx="43" cy="7" r="1" fill="currentColor" />
    </svg>
  );
}
