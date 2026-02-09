import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import { generateInvoicePDF } from "./services/invoice.service.js";
import { db } from "./config/database.js";
import {
  googleSearchApiResult,
  searchApiResult,
} from "./tools/zenserpSearch.js";
import { parseLinkedInResult } from "./tools/linkedinParser.js";
import { enrichCompany } from "./tools/companyEnrichment.js";
import { calculateScore } from "./tools/confidenceScore.js";
import { dedupe } from "./tools/dedupe.js";
import { exportCSV } from "./tools/csvExporter.js";
import { extractContactInfoFromWebsite } from "./tools/contactExtractor.js";
import { GoogleGenerativeAI } from "@google/generative-ai";
// import cheerio from "cheerio";

const app = express();
dotenv.config();
const MONGO_URI = process.env.MONGO_URI;
db(MONGO_URI);

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const model = genAI.getGenerativeModel({
  model: "gemini-2.5-flash",
});

const PORT = process.env.PORT;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

app.get("/", (req, res) => {
  console.log("API is running");
  return res.send("API is running!");
});

// Normalize job title for search: acronyms to uppercase so LinkedIn matches (e.g. "Cto" -> "CTO", "CTOs" -> "CTO")
const JOB_ACRONYMS = new Set(
  "CEO CTO CFO CMO COO VP CPO CHRO CRO CAO CIO CISO".split(" "),
);
function normalizeJobTitleForSearch(title) {
  if (!title || typeof title !== "string") return title;
  const t = title.trim();
  const upper = t.toUpperCase();
  if (JOB_ACRONYMS.has(upper)) return upper;
  const withoutS = upper.replace(/S$/, "");
  if (JOB_ACRONYMS.has(withoutS)) return withoutS; // "CTOs" -> "CTO"
  // Multi-word: capitalize each word (e.g. "product manager" -> "Product Manager")
  return t
    .split(/\s+/)
    .map((w) => {
      const u = w.toUpperCase();
      const uNoS = u.replace(/S$/, "");
      if (JOB_ACRONYMS.has(u) || JOB_ACRONYMS.has(uNoS)) return JOB_ACRONYMS.has(u) ? u : uNoS;
      return (w[0]?.toUpperCase() || "") + (w.slice(1)?.toLowerCase() || "");
    })
    .join(" ");
}

export function buildLinkedInXrayQuery(criteria) {
  const {
    jobTitles = [],
    location = "",
    industryKeywords = [],
    negativeKeywords = [],
    excludeCompanies = [],
  } = criteria;

  const sitePart = "site:linkedin.com/in";

  // Use any profession from criteria; normalize for search (CTO, Product Manager, etc.)
  const normalizedTitles = (jobTitles || [])
    .filter((t) => t && String(t).trim())
    .map(normalizeJobTitleForSearch);
  const titlePart = normalizedTitles.length
    ? `(${normalizedTitles.map((t) => `"${t}"`).join(" OR ")})`
    : "";

  // "Pune, India"
  const locationPart = location ? `"${location}"` : "";

  // "SaaS" OR "Fintech"
  const industryPart = industryKeywords?.length
    ? `(${industryKeywords?.map((k) => `"${k}"`).join(" OR ")})`
    : "";

  // -"Intern" -"Student"
  const negativePart = negativeKeywords?.map((k) => `-"${k}"`).join(" ");

  // -"Google" -"Microsoft"
  const excludeCompaniesPart = excludeCompanies
    ?.map((c) => `-"${c}"`)
    .join(" ");

  return [
    sitePart,
    titlePart,
    locationPart,
    industryPart,
    negativePart,
    excludeCompaniesPart,
  ]
    .filter(Boolean)
    .join(" ")
    .trim();
}

/** Normalize raw company string (strip symbols, roles, and legal suffixes). */
function cleanCompanyName(raw) {
  if (!raw) return null;
  let name = String(raw).trim();
  // Strip leading symbols like "@", "-", "–"
  name = name.replace(/^[@\-\s]+/, "").trim();
  // Keep only before common separators/comma
  name = name.split("|")[0].split("·")[0].split("•")[0].split(" - ")[0];
  // Often formats like "Just Codify, Azure Certified"
  name = name.split(",")[0].trim();
  // Remove common role words if they leaked in
  name = name.replace(
    /\b(Founder|Co[-\s]?Founder|CEO|CTO|CFO|CMO|COO|Owner|Director|VP|Head of)\b/gi,
    "",
  ).trim();
  // Remove common legal suffixes
  name = name.replace(/,?\s+(Inc|LLC|Ltd|Pvt|Corp|Co)\.?$/i, "").trim();
  return name || null;
}

/** Extract company name from title or description (e.g. "Name - Role @ Company"). */
function extractCompanyFromResult(title, description) {
  let raw = null;

  // Pattern 1: "@ Just Codify" in title or description
  const atSymbolMatch =
    (title && title.match(/@\s+([^,|–\-…]+?)(?:\s*[|@\-]|,|\.\.\.|$)/i)) ||
    (description &&
      description.match(/@\s+([^,|·\-…]+?)(?:\s*[|@\-]|,|\.\.\.|$)/i));

  if (atSymbolMatch) {
    raw = atSymbolMatch[1];
  } else {
    // Pattern 2: "at Just Codify" fallback
    const atMatch =
      (title && title.match(/at\s+([^|–\-…]+?)(?:\s*[|@\-]|\.\.\.|$)/i)) ||
      (description &&
        description.match(/at\s+([A-Za-z0-9 &.,]+?)(?:\s*[|·\-]|\.\.\.|$)/i));
    raw = atMatch ? atMatch[1] : null;
  }

  return cleanCompanyName(raw);
}

/**
 * Extract company/organization from snippet when there's no "at X" or "@ X".
 * e.g. "Founder, CEO, Dreamer. Maestro Stanford University. Los Angeles, California."
 */
function extractCompanyFromSnippet(description = "") {
  if (!description || !description.includes(".")) return null;
  // Phrase between ". " and ". " that appears before location (City, State) or "X followers"
  const match = description.match(
    /\.\s+([A-Z][A-Za-z0-9\s&.,]+?)\s*\.\s+(?:[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*,\s*[A-Za-z\s,]+|[0-9]+(?:\s*K\+?)?\s*followers)/i,
  );
  if (match) return cleanCompanyName(match[1]);
  // Fallback: second segment (after first period) if it looks like org (2+ words, or contains University/Inc/etc.)
  const segments = description.split(/\s*\.\s*/).map((s) => s.trim()).filter(Boolean);
  if (segments.length >= 2) {
    const second = segments[1];
    if (second.length >= 3 && (/\s/.test(second) || /\b(University|Inc|Ltd|LLC|Corp|Co\.?)\b/i.test(second))) {
      return cleanCompanyName(second);
    }
  }
  return null;
}

// Simple in-process rate limiter and safe wrapper for Google Generative AI calls
const _genaiRate = {
  windowMs: 60 * 1000,
  maxRequests: Number(process.env.GENAI_MAX_PER_MIN) || 4, // safe default under free tier
  timestamps: [],
};

async function _waitForGenAIToken() {
  while (true) {
    const now = Date.now();
    _genaiRate.timestamps = _genaiRate.timestamps.filter(
      (t) => t > now - _genaiRate.windowMs,
    );
    if (_genaiRate.timestamps.length < _genaiRate.maxRequests) {
      _genaiRate.timestamps.push(now);
      return;
    }
    const earliest = _genaiRate.timestamps[0];
    const wait = earliest + _genaiRate.windowMs - now + 50;
    await new Promise((r) => setTimeout(r, wait));
  }
}

async function safeGenerateContent(prompt, maxRetries = 3) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      await _waitForGenAIToken();
      const result = await model.generateContent(prompt);
      return result;
    } catch (err) {
      // Inspect for rate limit hints
      console.error(
        "safeGenerateContent error (attempt",
        attempt,
        "):",
        err?.status || err?.code,
        err?.message || err,
      );

      // If Google indicates RetryInfo, use that delay
      let delayMs = 500 * Math.pow(2, attempt); // exponential backoff
      if (Array.isArray(err?.errorDetails)) {
        const retryInfo = err.errorDetails.find(
          (d) => d["@type"] && d["@type"].includes("RetryInfo"),
        );
        if (retryInfo && retryInfo.retryDelay) {
          const m = String(retryInfo.retryDelay).match(/(\d+)s/);
          if (m) delayMs = parseInt(m[1], 10) * 1000 + 200;
        }
      }

      // For 429 or transient server errors retry, otherwise fail fast
      const status = err?.status || err?.code || 0;
      if (
        (status === 429 || (status >= 500 && status < 600)) &&
        attempt < maxRetries
      ) {
        await new Promise((r) => setTimeout(r, delayMs));
        continue;
      }

      // Max retries reached or non-retryable error
      if (attempt >= maxRetries) throw err;
      // otherwise try again
    }
  }
  return null;
}

// Very simple, non-AI fallback: try to guess criteria from the prompt text.
// Supports any profession – expanded list + extract phrases like "Product Managers", "Data Scientist".
function buildCriteriaFallbackFromPrompt(promptText) {
  const text = String(promptText || "").trim();
  const lower = text.toLowerCase();

  // Broad list of professions (any can be used; not limited to this)
  const roleKeywords = [
    "ceo",
    "founder",
    "co-founder",
    "cto",
    "cfo",
    "cmo",
    "coo",
    "vp",
    "vice president",
    "director",
    "head of",
    "owner",
    "manager",
    "product manager",
    "project manager",
    "data scientist",
    "engineer",
    "software engineer",
    "developer",
    "designer",
    "sales manager",
    "marketing manager",
    "hr manager",
    "consultant",
    "architect",
    "analyst",
    "researcher",
    "lead",
    "principal",
    "specialist",
    "coordinator",
    "executive",
    "entrepreneur",
  ];

  const industryCandidates = [
    "saas",
    "software",
    "b2b",
    "b2c",
    "startup",
    "agency",
    "consulting",
    "fintech",
    "ecommerce",
    "marketing",
  ];

  const negativeCandidates = ["intern", "student", "fresher", "junior"];

  const jobTitles = [];
  for (const rk of roleKeywords) {
    if (lower.includes(rk)) {
      jobTitles.push(
        rk
          .split(" ")
          .map((w) => (["cto", "ceo", "cfo", "cmo", "coo", "vp", "hr"].includes(w) ? w.toUpperCase() : (w[0]?.toUpperCase() || "") + (w.slice(1) || "")))
          .join(" "),
      );
    }
  }

  // Extract job-like phrases: "find X" / "X in" / "X and Y" / "X, Y" (generalized for any profession)
  const findMatch = text.match(/(?:find|looking for|want|need)\s+([^.?!,]+?)(?:\s+in\s+|\s*[.,]|$)/i);
  if (findMatch) {
    const phrase = findMatch[1].trim();
    const parts = phrase.split(/\s+and\s+|\s*,\s*|\s+or\s+/i).map((p) => p.trim()).filter(Boolean);
    for (const p of parts) {
      if (p.length >= 2 && p.length <= 50 && !/^\d+$/.test(p)) {
        const normalized = normalizeJobTitleForSearch(p);
        if (normalized && !jobTitles.some((t) => t.toLowerCase() === normalized.toLowerCase())) {
          jobTitles.push(normalized);
        }
      }
    }
  }

  if (!jobTitles.length) {
    jobTitles.push("Founder", "CEO");
  }

  const industryKeywords = [];
  for (const ik of industryCandidates) {
    if (lower.includes(ik)) {
      industryKeywords.push(ik.toUpperCase());
    }
  }

  const negativeKeywords = [];
  for (const nk of negativeCandidates) {
    if (lower.includes(nk)) {
      negativeKeywords.push(nk);
    }
  }

  let location = "";
  const inMatch = text.match(/in\s+([^,]+(?:,\s*[\w\s]+)?)/i);
  if (inMatch) {
    location = inMatch[1].trim();
  }

  const excludeCompanies = [];
  const excludeMatch = text.match(/exclud(?:e|ing)\s+([^.,]+)/i);
  if (excludeMatch) {
    const parts = excludeMatch[1]
      .split(/and|,/i)
      .map((p) => p.trim())
      .filter(Boolean);
    excludeCompanies.push(...parts);
  }

  return {
    jobTitles,
    location,
    industryKeywords,
    negativeKeywords,
    excludeCompanies,
  };
}

export async function extractCompanyWithGemini(title, description) {
  const prompt = `
You are extracting company information from LinkedIn search results.

Return ONLY valid JSON in the following format:
{
  "companyName": string | null,
  "companyWebsite": string | null,
  "companyWebsiteDetails": string | null,
  "companyDescription": string | null
}

Rules:
- Do not include person name or role
- Do not guess website if not clearly mentioned
- Description should be a short summary (max 2 sentences)
- If information is missing, return null for that field
- Output JSON ONLY (no markdown, no explanation)

Title:
"${title}"

Description:
"${description}"
`;

  try {
    const result = await safeGenerateContent(prompt);
    if (!result) return null;
    const text = result.response?.text?.().trim?.() || "";
    try {
      return JSON.parse(text);
    } catch (err) {
      console.error("Gemini JSON parse failed:", text);
      return null;
    }
  } catch (err) {
    // Don't let AI failures crash the whole request; log and return null so the lead can still be returned
    console.error("extractCompanyWithGemini failed:", err?.message || err);
    return null;
  }
}

function extractCompanyByRegex(title = "", description = "") {
  // Case 1: "Founder and CEO of X"
  let match = title.match(/(?:of|at)\s+([A-Za-z0-9&.,\s]+)$/i);
  if (match) return cleanCompanyName(match[1]);

  // Case 2: "Name - Company" or "Name - Role @ Company"
  const parts = title.split(" - ");
  if (parts.length >= 2) {
    // Take everything after the first " - " as potential company fragment
    const tail = parts.slice(1).join(" - ");
    return cleanCompanyName(tail);
  }

  // Case 3: From description "at Company"
  match = description.match(/at\s+([A-Za-z0-9&.,\s]+)/i);
  if (match) return cleanCompanyName(match[1]);

  return null;
}

export async function extractLeadDetails(result) {
  const lead = {};
  const title = result.title || result.header || "";
  const description = result.description || result.snippet || "";

  // 1. LinkedIn URL (both for frontend compatibility)
  lead.linkedinURL = result.url || result.link || null;

  // 2. Name & Role
  if (title) {
    const parts = title.split(" - ");
    lead.name = parts[0]?.trim() || null;
    lead.role = parts[1]?.replace(/\.\.\./g, "").trim() || null;
  }

  // 3. Followers
  if (result.destination) {
    const followersMatch = result.destination.replace(" followers", "");
    lead.followers = followersMatch ? followersMatch : null;
  }

  // 4. Connections
  if (description) {
    const connectionsMatch = description.match(/([\d+]+)\s*connections/i);
    lead.connections = connectionsMatch ? connectionsMatch[1] : null;
  }

  // 5. Location
  if (description) {
    const locationMatch = description.match(/Location:\s*([^·]+)/i);
    lead.location = locationMatch ? locationMatch[1].trim() : null;
  }

  // 6. LinkedIn Headline / Description
  lead.linkedinHeadline = description || null;

  // Prefer "@ Company" / "at Company", then regex, then snippet phrase (e.g. "Maestro Stanford University")
  const regexCompany =
    extractCompanyFromResult(title, description) ||
    extractCompanyByRegex(title, description) ||
    extractCompanyFromSnippet(description);
  lead.companyName = regexCompany || null;

  // Keep raw title/description for Gemini fallback when enriching (not sent to frontend)
  lead._rawTitle = title || null;
  lead._rawDescription = description || null;

  lead.companyWebsite = null;
  lead.companyWebsiteDetails = null;
  lead.companyDescription = null;

  return lead;
}

app.post("/leads", async function (req, res) {
  try {
    const query = buildLinkedInXrayQuery(req.body);
    // const results = await googleSearchApiResult(query, 50);
    const results = await searchApiResult(query, 50);

    if (!results || !results.length) {
      return res.status(200).json({
        success: true,
        message: "No results found",
        leads: [],
      });
    }
    console.log("results", results);

    // Run extraction concurrently but await safely to avoid unhandled rejections
    const settled = await Promise.allSettled(
      results.map((r) => extractLeadDetails(r)),
    );
    let leads = settled
      .filter((s) => s.status === "fulfilled")
      .map((s) => s.value);

    // Log any failures for visibility
    const failures = settled.filter((s) => s.status === "rejected");
    if (failures.length) {
      console.error(
        "extractLeadDetails failures:",
        failures.map((f) => f.reason),
      );
    }

    // Enrich each lead with company search (website + details)
    for (const lead of leads) {
      // If no company name yet, try Gemini to infer from title/snippet (e.g. "Maestro Stanford University")
      if (!lead.companyName && (lead._rawTitle || lead._rawDescription)) {
        try {
          const gemini = await extractCompanyWithGemini(
            lead._rawTitle || "",
            lead._rawDescription || "",
          );
          if (gemini?.companyName) lead.companyName = gemini.companyName;
        } catch (e) {
          // ignore
        }
      }
      delete lead._rawTitle;
      delete lead._rawDescription;

      if (lead.companyName) {
        const enrichment = await enrichCompany(lead.companyName);
        Object.assign(lead, enrichment);
      }
      // Extract email/phone from company website (best-effort, may be null)
      if (lead.companyWebsite) {
        const contact = await extractContactInfoFromWebsite(
          lead.companyWebsite,
        );
        lead.email = contact.email || lead.email || null;
        lead.phone = contact.phone || lead.phone || null;
      } else {
        lead.email = lead.email || null;
        lead.phone = lead.phone || null;
      }
      lead.confidenceScore = calculateScore(lead);
    }

    console.log("Return Leads++", leads);
    // Normalize to the exact fields needed by frontend lead generation UI
    const normalizedLeads = leads.map((l) => ({
      name: l.name || null,
      companyName: l.companyName || null,
      phone: l.phone || null,
      email: l.email || null,
      linkedinURL: l.linkedinURL || null,
      website: l.companyWebsite || null,
      websiteDescription: l.companyWebsiteDetails || null,
    }));
    return res.status(200).json({
      success: true,
      totalResults: normalizedLeads.length,
      uniqueLeads: normalizedLeads.length,
      leads: normalizedLeads,
    });
  } catch (error) {
    console.error("API Error:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Internal Server Error",
    });
  }
});

/**
 * Frontend-friendly endpoint: accept a free-text prompt and generate leads.
 * Body: { "prompt": string, "limit"?: number }
 */
app.post("/leads/prompt", async function (req, res) {
  try {
    console.log("req.body?.prompt", req.body?.prompt);
    const promptText = String(req.body?.prompt || "").trim();
    const limit = Number(req.body?.limit || 50);

    if (!promptText) {
      return res.status(400).json({
        success: false,
        error: "prompt is required",
      });
    }

    const criteriaPrompt = `
Convert the user's lead-generation prompt into STRICT JSON.
Return ONLY JSON (no markdown, no explanation) with this shape:
{
  "jobTitles": string[],
  "location": string,
  "industryKeywords": string[],
  "negativeKeywords": string[],
  "excludeCompanies": string[]
}

Rules:
- jobTitles: ANY profession/role the user asks for (e.g. CTO, CEO, Founder, Product Manager, Data Scientist, Engineer, Designer, Sales Manager, Consultant). Use standard casing: acronyms in UPPERCASE (CTO, CEO, CFO, VP), multi-word in Title Case (Product Manager). Include every role mentioned.
- location: city/region/country if present, else empty string.
- industryKeywords: industry/product keywords (SaaS, fintech, web development, etc.).
- negativeKeywords: words to exclude (intern, student, etc.).
- excludeCompanies: company names to exclude.
- If unknown, use empty arrays/empty string.

User prompt:
"""${promptText}"""
`;

    let criteria = null;
    try {
      const ai = await safeGenerateContent(criteriaPrompt);
      console.log("ai++++", ai?.response);
      const raw = ai?.response?.text?.().trim?.() || "";
      if (raw) {
        try {
          criteria = JSON.parse(raw);
        } catch {
          criteria = null;
        }
      }
    } catch (e) {
      console.error("safeGenerateContent failed for /leads/prompt:", e);
      criteria = null;
    }

    if (!criteria || typeof criteria !== "object") {
      console.warn(
        "Falling back to basic prompt parsing for /leads/prompt:",
        promptText,
      );
      criteria = buildCriteriaFallbackFromPrompt(promptText);
    }

    const query = buildLinkedInXrayQuery(criteria);
    const results = await searchApiResult(query, limit);
    if (!results || !results.length) {
      return res.status(200).json({
        success: true,
        message: "No results found",
        leads: [],
      });
    }

    const settled = await Promise.allSettled(
      results.map((r) => extractLeadDetails(r)),
    );
    let leads = settled
      .filter((s) => s.status === "fulfilled")
      .map((s) => s.value);

    for (const lead of leads) {
      if (!lead.companyName && (lead._rawTitle || lead._rawDescription)) {
        try {
          const gemini = await extractCompanyWithGemini(
            lead._rawTitle || "",
            lead._rawDescription || "",
          );
          if (gemini?.companyName) lead.companyName = gemini.companyName;
        } catch (e) {
          // ignore
        }
      }
      delete lead._rawTitle;
      delete lead._rawDescription;

      if (lead.companyName) {
        const enrichment = await enrichCompany(lead.companyName);
        Object.assign(lead, enrichment);
      }
      if (lead.companyWebsite) {
        const contact = await extractContactInfoFromWebsite(
          lead.companyWebsite,
        );
        lead.email = contact.email || lead.email || null;
        lead.phone = contact.phone || lead.phone || null;
      } else {
        lead.email = lead.email || null;
        lead.phone = lead.phone || null;
      }
      lead.confidenceScore = calculateScore(lead);
    }

    const normalizedLeads = leads.map((l) => ({
      name: l.name || null,
      companyName: l.companyName || null,
      phone: l.phone || null,
      email: l.email || null,
      linkedinURL: l.linkedinURL || null,
      website: l.companyWebsite || null,
      websiteDescription: l.companyWebsiteDetails || null,
    }));

    return res.status(200).json({
      success: true,
      criteria,
      totalResults: normalizedLeads.length,
      leads: normalizedLeads,
    });
  } catch (error) {
    console.error("API Error (/leads/prompt):", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Internal Server Error",
    });
  }
});

const server = app.listen(PORT, (req, res) => {
  console.log(`App is running at http://localhost:${PORT}`);
});

// Handle uncaught exceptions
process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
  // Close server and exit process
  server.close(() => {
    process.exit(1);
  });
});

// Handle unhandled promise rejections
process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection:", reason);
  // Close server and exit process
  server.close(() => {
    process.exit(1);
  });
});
