import Link from "next/link";
import { Motif } from "@/components/Motif";
import type { SectionKey, Theme } from "@/themes";

/** The CSS-drawn scrapbook object for each party section. */
function Drawing({ section, theme }: { section: SectionKey; theme: Theme }) {
  switch (section) {
    case "blanket":
      return (
        <div className="pp-swatch">
          <div className="pp-swatch-inner">
            <span className="pp-script" style={{ fontSize: "2.4rem" }}>
              + you
            </span>
          </div>
        </div>
      );
    case "album":
      return (
        <div className="pp-polaroids">
          <div className="pp-polaroid">
            <div className="pp-polaroid-photo" />
          </div>
          <div className="pp-polaroid">
            <div className="pp-polaroid-photo" />
          </div>
        </div>
      );
    case "messages":
      return (
        <div className="pp-postcard">
          <div className="pp-postcard-note pp-script">Wish you were here!</div>
          <div className="pp-postcard-lines" />
          <div className="pp-stamp pp-postcard-stamp" style={{ "--perf": "3px" } as React.CSSProperties}>
            <div className="pp-stamp-inner">
              <Motif motif={theme.motif} size={12} />
            </div>
          </div>
        </div>
      );
    case "games":
      return (
        <div className="pp-pass">
          <div className="pp-pass-band">
            <span className="pp-caps">Boarding pass</span>
          </div>
          <div className="pp-pass-main">
            <div className="pp-pass-body">
              Gate
              <strong>Games</strong>
            </div>
          </div>
          <div className="pp-pass-stub">
            <div className="pp-barcode" />
          </div>
        </div>
      );
    case "registry":
      return (
        <div className="pp-tag-wrap">
          <div className="pp-tag">
            <div className="pp-tag-card">
              <span className="pp-script" style={{ fontSize: "2rem" }}>
                Registry
              </span>
              <span className="pp-caps" style={{ fontSize: "0.62rem" }}>
                Tap to view
              </span>
            </div>
          </div>
        </div>
      );
  }
}

export function SectionObject({
  section,
  theme,
  href,
  label,
  detail,
  soon = false,
  external = false,
  tilt = 0,
  className,
  style,
}: {
  section: SectionKey;
  theme: Theme;
  href: string;
  label?: string;
  detail?: React.ReactNode;
  soon?: boolean;
  external?: boolean;
  tilt?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  const art = theme.art?.[section];
  const body = (
    <>
      {art ? (
        <img src={art} alt="" style={{ width: "100%", height: "auto", display: "block" }} />
      ) : (
        <Drawing section={section} theme={theme} />
      )}
      {(label || detail || soon) && (
        <div className="pp-object-label">
          {label && <span className="pp-script">{label}</span>}
          {detail && <small>{detail}</small>}
          {soon && <span className="pp-soon">Opens soon</span>}
        </div>
      )}
    </>
  );

  const common = {
    className: `pp-object ${className ?? ""}`,
    style: { transform: `rotate(${tilt}deg)`, ...style },
  };

  return external ? (
    <a href={href} target="_blank" rel="noopener noreferrer" {...common}>
      {body}
    </a>
  ) : (
    <Link href={href} {...common}>
      {body}
    </Link>
  );
}
