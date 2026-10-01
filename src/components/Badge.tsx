import { Motif } from "@/components/Motif";
import type { Theme } from "@/themes";

/** A little stamp or sticker in the theme's style, showing its motif. */
export function Badge({
  theme,
  size,
  style,
}: {
  theme: Theme;
  size: number;
  style?: React.CSSProperties;
}) {
  if (theme.badge === "sticker") {
    return (
      <div className="pp-sticker" style={{ width: size, height: size, ...style }} aria-hidden="true">
        <span>
          <Motif motif={theme.motif} size={Math.round(size * 0.36)} />
        </span>
      </div>
    );
  }
  return (
    <div
      className="pp-stamp"
      style={{ width: size * 0.84, height: size, ...(size < 40 ? { "--perf": "3px" } : {}), ...style } as React.CSSProperties}
      aria-hidden="true"
    >
      <div className="pp-stamp-inner">
        <Motif motif={theme.motif} size={Math.round(size * 0.32)} />
      </div>
    </div>
  );
}
