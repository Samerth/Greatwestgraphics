/**
 * WordPress used trailing slashes and a www host. The Next app serves the
 * same path without a trailing slash (the framework default). These helpers
 * collapse both shapes — plus full live URLs from the migration spec — to
 * one lookup key so a slug is never missed because of punctuation.
 */

const LIVE_HOST = /^https?:\/\/(?:www\.)?greatwestgraphics\.com/i;

export function canonicalizePath(input: string): string {
  let value = input.trim();
  value = value.replace(LIVE_HOST, "");

  const query = value.indexOf("?");
  if (query >= 0) value = value.slice(0, query);
  const hash = value.indexOf("#");
  if (hash >= 0) value = value.slice(0, hash);

  try {
    value = decodeURIComponent(value);
  } catch {
    // Keep the raw path if it was not encoded.
  }

  value = value.replace(/\/{2,}/g, "/");
  if (!value.startsWith("/")) value = `/${value}`;
  if (value.length > 1) value = value.replace(/\/+$/, "");
  return value.toLowerCase();
}

export function pathFromSegments(segments: string[]): string {
  return canonicalizePath(`/${segments.filter(Boolean).join("/")}`);
}

export function segmentsFromPath(path: string): string[] {
  return canonicalizePath(path).split("/").filter(Boolean);
}

export function withTrailingSlash(path: string): string {
  const canonical = canonicalizePath(path);
  return canonical === "/" ? "/" : `${canonical}/`;
}
