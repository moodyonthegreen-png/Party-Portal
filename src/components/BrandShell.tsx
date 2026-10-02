import Link from "next/link";
import { brandFontVars } from "@/lib/brand-fonts";
import "@/app/brand.css";

/**
 * The Moody Celebrations front-door look: the brand pattern, the wordmark on
 * a gray band, a bold card, and a small footer. Used by "Find your party",
 * host sign-in and the expired-link page.
 */
export function BrandShell({ children, footer }: { children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <div className={`mc ${brandFontVars}`}>
      <main className="mc-main">
        <header className="mc-logo">
          <span className="mc-icon mc-sparkle" aria-hidden="true" />
          <Link href="/" aria-label="Moody Celebrations home">
            <img src="/brand/wordmark-black.png" alt="Moody Celebrations" width={683} height={244} />
          </Link>
          <span className="mc-icon mc-sparkle" aria-hidden="true" />
        </header>
        <div className="mc-card">{children}</div>
        {footer && <footer className="mc-foot">{footer}</footer>}
      </main>
    </div>
  );
}
