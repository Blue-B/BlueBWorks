// Small dependency-free helpers shared by the builder and the checks.

export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function txt(value) {
  return String(value ?? "").trim();
}

// baseUrl -> "/BlueBWorks" (or "" for a domain root / custom domain).
export function basePathFromUrl(baseUrl) {
  try {
    const url = new URL(baseUrl);
    const path = url.pathname.replace(/\/+$/, "");
    return path === "/" ? "" : path;
  } catch {
    return "";
  }
}

export function normalizeBaseUrl(baseUrl) {
  const value = txt(baseUrl) || "https://blue-b.github.io/BlueBWorks";
  return value.replace(/\/+$/, "");
}

// Path inside the site ("/" or "/articles/x/") -> full URL.
export function joinUrl(baseUrl, path = "/") {
  const base = normalizeBaseUrl(baseUrl);
  if (path === "/" || path === "") return `${base}/`;
  return `${base}/${String(path).replace(/^\/+/, "")}`;
}

export function pageHref(basePath, path = "/") {
  const base = basePath || "";
  if (path === "/" || path === "") return `${base}/`;
  return `${base}/${String(path).replace(/^\/+/, "")}`;
}

export function assetHref(basePath, rel) {
  const base = basePath || "";
  return `${base}/assets/${String(rel).replace(/^\/+/, "")}`;
}

export function hostnameOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

export function formatKoreanDate(value) {
  if (!value) return "";
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00+09:00` : value;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "Asia/Seoul",
  }).format(date);
}

export function formatKoreanDateTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Seoul",
  }).format(date);
}

// ISO 8601 value for JSON-LD, tolerating both date-only and full timestamps.
export function toIso(value) {
  if (!value) return "";
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00+09:00` : value;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString();
}

export function toRfc822(value) {
  const iso = !value
    ? ""
    : /^\d{4}-\d{2}-\d{2}$/.test(value)
      ? `${value}T00:00:00+09:00`
      : value;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toUTCString();
}

export function sortKey(value) {
  const iso = !value
    ? ""
    : /^\d{4}-\d{2}-\d{2}$/.test(value)
      ? `${value}T00:00:00+09:00`
      : value;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

export function splitParagraphs(body) {
  return String(body ?? "")
    .split(/\n\s*\n/)
    .map((part) => part.replace(/\s*\n\s*/g, " ").trim())
    .filter(Boolean);
}

// A section may carry a body string, a paragraphs array, or both.
// Merge them and drop exact duplicates so the same text is never printed twice.
export function sectionParagraphs(section) {
  const combined = [...splitParagraphs(section.body), ...(section.paragraphs || [])];
  const seen = new Set();
  const out = [];
  for (const paragraph of combined) {
    const value = String(paragraph || "").trim();
    if (!value || seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }
  return out;
}

export function readingMinutes(post) {
  const chunks = [post.summary, post.editorNote];
  for (const point of post.keyPoints || []) chunks.push(point);
  for (const section of post.sections || []) {
    chunks.push(...sectionParagraphs(section));
  }
  const text = chunks.filter(Boolean).join(" ");
  return Math.max(2, Math.round(text.length / 700));
}

export function jsonEmbed(value) {
  return JSON.stringify(value).replaceAll("<", "\\u003c");
}

export function unique(values) {
  return [...new Set(values.filter(Boolean))];
}
