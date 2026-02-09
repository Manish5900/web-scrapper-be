function extractCompanyFromTitle(title) {
  const regex = /at\s+([^|–-]+)/i;
  const match = title.match(regex);
  return match ? match[1].trim() : null;
}
function extractCompanyFromSnippet(snippet) {
  const regex = /at\s+([A-Z][A-Za-z0-9 &.,]+)/;
  const match = snippet.match(regex);
  return match ? match[1].trim() : null;
}

function normalizeCompany(company) {
  return company?.replace(/,?\s+(Inc|LLC|Ltd|Pvt|Corp|Co)\.?$/i, "").trim();
}

export function parseLinkedInResult(result) {
  const title = result.title || "";
  const snippet = result.snippet || "";
  const url = result.url || "";

  if (!/linkedin\.com\/(in|pub)\//i.test(url)) return null;

  // NAME
  let name = title.split("|")[0]?.split("–")[0]?.split("-")[0]?.trim() || null;

  // ROLE
  let roleMatch =
    title.match(/(?:–|-|\|)\s*(.*?)\s*(?:at|@|\||,)/i) ||
    snippet.match(/(CEO|Founder|Co-Founder|CTO|CPO|CMO|Owner|Director|VP)/i);

  const role = roleMatch ? roleMatch[1] || roleMatch[0] : null;

  // COMPANY
  let company =
    extractCompanyFromTitle(title) || extractCompanyFromSnippet(snippet);

  company = normalizeCompany(company);

  if (!name) return null;

  return {
    name,
    role,
    company,
    linkedinURL: url,
    linkedinHeadline: snippet,
  };
}

// export function parseLinkedInResult(result) {
//   console.log("parseLinkedInResult++", result);
//   const title = result.title || "";
//   const snippet = result.snippet || "";
//   const url = result.url || "";

//   if (!url.includes("linkedin.com/in")) return null;

//   // Example:
//   // John Doe – Founder at Acme Inc | LinkedIn
//   // const regex = /^(.*?)\s[-–]\s(.*?)\sat\s(.*?)\s\|/i;
//   // const match = title.match(regex);

//   const nameMatch = title.match(/^(.*?)\s[-–|]/);
//   const name = nameMatch ? nameMatch[1].trim() : null;

//   const roleMatch = title.match(/[-–]\s(.*?)\sat/i);
//   const role = roleMatch ? roleMatch[1].trim() : null;

//   let company =
//     extractCompanyFromTitle(title) || extractCompanyFromSnippet(snippet);

//   company = normalizeCompany(company);

//   if (!name || !role) return null;

//   // return {
//   //   name: match[1].trim(),
//   //   role: match[2].trim(),
//   //   company: match[3].trim(),
//   //   linkedinURL: url,
//   //   linkedinHeadline: snippet,
//   // };
//   return {
//     name,
//     role,
//     company,
//     linkedinURL: url,
//     linkedinHeadline: snippet,
//   };
// }
