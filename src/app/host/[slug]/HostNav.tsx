"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function HostNav({ slug }: { slug: string }) {
  const path = usePathname();
  const base = `/host/${slug}`;
  const items = [
    { href: base, label: "Overview" },
    { href: `${base}/messages`, label: "Guest book" },
    { href: `${base}/photos`, label: "Photos" },
    { href: `${base}/games`, label: "Games" },
    { href: `${base}/gift`, label: "Gift designer" },
    { href: `${base}/settings`, label: "Party details" },
  ];

  return (
    <nav style={{ display: "flex", gap: "1.25rem", alignItems: "center", marginTop: "0.75rem", flexWrap: "wrap" }}>
      {items.map((item) => {
        const active = path === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className="pp-caps"
            aria-current={active ? "page" : undefined}
            style={{
              fontSize: "0.78rem",
              textDecoration: "none",
              color: active ? "var(--pp-accent)" : "var(--pp-ink-soft)",
              borderBottom: active ? "2px solid var(--pp-gold)" : "2px solid transparent",
              paddingBottom: "0.2rem",
            }}
          >
            {item.label}
          </Link>
        );
      })}
      <a
        href={`/p/${slug}`}
        target="_blank"
        rel="noopener noreferrer"
        className="pp-caps"
        style={{ fontSize: "0.78rem", marginLeft: "auto", color: "var(--pp-ink-soft)" }}
      >
        View guest page ↗
      </a>
    </nav>
  );
}
