import type { Theme } from "@/themes";

/** Small theme symbol for seals and stamps. */
export function Motif({ motif, size = 24 }: { motif: Theme["motif"]; size?: number }) {
  if (motif === "heart") {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.5 3 5 6.5 5c2 0 3.5 1.1 4.5 2.6.3.4.7.4 1 0C13 6.1 14.5 5 16.5 5 20 5 22.1 8.5 20.6 11.8 18.5 16.4 12 21 12 21z" />
      </svg>
    );
  }
  if (motif === "star") {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M12 2.5l2.9 6 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.2 1.3-6.6-4.9-4.6 6.6-.8z" />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M21.5 15.2v-1.7l-8-5V3.6c0-.9-.7-1.6-1.5-1.6s-1.5.7-1.5 1.6v4.9l-8 5v1.7l8-2.5v5.1l-2 1.5v1.3l3.5-1 3.5 1v-1.3l-2-1.5v-5.1z" />
    </svg>
  );
}
