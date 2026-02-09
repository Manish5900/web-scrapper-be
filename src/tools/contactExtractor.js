import fetch from "node-fetch";
import { load } from "cheerio";

function uniq(arr) {
  return [...new Set((arr || []).filter(Boolean))];
}

function normalizeEmail(email) {
  if (!email) return null;
  const e = String(email).trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return null;
  return e;
}

function normalizePhone(phone) {
  if (!phone) return null;
  const p = String(phone).trim();
  // Keep + and digits, strip other punctuation/spaces
  const cleaned = p.replace(/[^\d+]/g, "");
  // Too short is likely not a phone number
  if (cleaned.replace(/\D/g, "").length < 8) return null;
  return cleaned;
}

function extractEmailsFromText(text) {
  if (!text) return [];
  const t = String(text);
  // Basic email regex; good enough for web page text
  const matches = t.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi);
  return uniq(matches || []).map(normalizeEmail).filter(Boolean);
}

function extractPhonesFromText(text) {
  if (!text) return [];
  const t = String(text);
  // Loose international-ish phone capture
  const matches =
    t.match(/(\+?\d[\d\s().-]{7,}\d)/g) || [];
  return uniq(matches.map(normalizePhone)).filter(Boolean);
}

function safeUrlJoin(base, path) {
  try {
    return new URL(path, base).toString();
  } catch {
    return null;
  }
}

async function fetchHtml(url) {
  const res = await fetch(url, {
    method: "GET",
    headers: { "User-Agent": "Mozilla/5.0" },
  });
  if (!res.ok) return "";
  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("text/html")) return "";
  return await res.text();
}

/**
 * Best-effort contact info extraction from a website.
 * - Reads homepage and (if found) a "Contact" link (one extra page).
 * - Extracts emails and phones from mailto/tel + page text.
 */
export async function extractContactInfoFromWebsite(websiteUrl) {
  if (!websiteUrl) return { email: null, phone: null };

  try {
    const homeHtml = await fetchHtml(websiteUrl);
    if (!homeHtml) return { email: null, phone: null };

    const $home = load(homeHtml);
    const homeEmails = uniq([
      ...$home('a[href^="mailto:"]')
        .map((_, a) => String($home(a).attr("href") || "").replace(/^mailto:/i, ""))
        .get(),
      ...extractEmailsFromText($home.text()),
    ])
      .map(normalizeEmail)
      .filter(Boolean);

    const homePhones = uniq([
      ...$home('a[href^="tel:"]')
        .map((_, a) => String($home(a).attr("href") || "").replace(/^tel:/i, ""))
        .get(),
      ...extractPhonesFromText($home.text()),
    ])
      .map(normalizePhone)
      .filter(Boolean);

    // Try a single contact page for better hit rate
    let contactUrl = null;
    const contactHref = $home('a[href*="contact"]')
      .first()
      .attr("href");
    contactUrl = contactHref ? safeUrlJoin(websiteUrl, contactHref) : null;

    let contactEmails = [];
    let contactPhones = [];
    if (contactUrl && contactUrl !== websiteUrl) {
      const contactHtml = await fetchHtml(contactUrl);
      if (contactHtml) {
        const $c = load(contactHtml);
        contactEmails = uniq([
          ...$c('a[href^="mailto:"]')
            .map((_, a) =>
              String($c(a).attr("href") || "").replace(/^mailto:/i, ""),
            )
            .get(),
          ...extractEmailsFromText($c.text()),
        ])
          .map(normalizeEmail)
          .filter(Boolean);

        contactPhones = uniq([
          ...$c('a[href^="tel:"]')
            .map((_, a) =>
              String($c(a).attr("href") || "").replace(/^tel:/i, ""),
            )
            .get(),
          ...extractPhonesFromText($c.text()),
        ])
          .map(normalizePhone)
          .filter(Boolean);
      }
    }

    const emails = uniq([...homeEmails, ...contactEmails]);
    const phones = uniq([...homePhones, ...contactPhones]);

    return {
      email: emails[0] || null,
      phone: phones[0] || null,
    };
  } catch (err) {
    console.error("extractContactInfoFromWebsite failed:", err?.message || err);
    return { email: null, phone: null };
  }
}

