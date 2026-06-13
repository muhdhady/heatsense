// Shared utility functions used across client and server code.

import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

// Merges Tailwind class names safely, resolving conflicts (e.g. two `text-*` classes).
// Used throughout the UI instead of plain string concatenation to avoid class collisions.
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Converts an ISO date string into a human-readable relative time label
// (e.g. "42s ago", "3m ago", "2h ago").
// Used in the dashboard table and worker detail header to show last sync time.
export function formatTimeAgo(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}
