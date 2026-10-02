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
    { href: `${base}/thanks`, label: "Thank-yous" },
    { href: `${base}/keepsake`, label: "Keepsake" },
    { href: `${base}/settings`, label: "Party details" },
  ];

  return (
    <nav className="hd-nav" aria-label="Dashboard">
      <div className="pp-wrap pp-host-body hd-tabs">
        {items.map((item) => {
          const active = item.href === base ? path === base : path.startsWith(item.href);
          return (
            <Link key={item.href} href={item.href} className="hd-tab" aria-current={active ? "page" : undefined}>
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
