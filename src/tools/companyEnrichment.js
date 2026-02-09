import fetch from "node-fetch";
import { load } from "cheerio";

export async function enrichCompany(companyName) {
  try {
    const query = `"${companyName}" official website -site:linkedin.com -site:facebook.com -site:twitter.com -site:instagram.com`;
    // const searchUrl =
    // `https://www.googleapis.com/customsearch/v1?` +
    // `key=${process.env.GOOGLE_API_KEY}` +
    // `&cx=${process.env.GOOGLE_CX}` +
    // `&q=${encodeURIComponent(`${companyName} official website`)}` +
    // `&num=1`;
    const searchUrl =
      `https://www.searchapi.io/api/v1/search` +
      `?api_key=${process.env.SEARCH_API_KEY}` +
      `&engine=google` +
      `&q=${encodeURIComponent(query)}` +
      `&num=${1}`;

    const res = await fetch(searchUrl, { method: "GET" });
    const data = await res.json();

    if (data.error) {
      console.error("enrichCompany API error:", data.error);
      return {};
    }

    // Support SearchAPI.io (organic_results), Zenserp (organic), Google (items), and generic results
    const first =
      data.organic_results?.[0] ||
      data.organic?.[0] ||
      data.results?.[0] ||
      data.items?.[0] ||
      null;

    const siteUrl = first?.link || first?.url || first?.href;
    if (!siteUrl) {
      console.warn("enrichCompany: no URL in search result for", companyName, "keys:", data ? Object.keys(data) : []);
      return {};
    }

    // Avoid LinkedIn, Crunchbase, etc.
    if (/linkedin\.com|crunchbase\.com/i.test(siteUrl)) {
      console.warn("enrichCompany: skipping non-company URL", siteUrl);
      return {};
    }

    let description = first?.snippet || first?.description || "";

    try {
      const html = await fetch(siteUrl, {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36" },
      }).then((r) => r.text());
      const $ = load(html);
      const metaDesc =
        $('meta[name="description"]').attr("content") ||
        $('meta[property="og:description"]').attr("content") ||
        "";
      const firstP = $("p").first().text()?.trim() || "";
      description = metaDesc || firstP || description || "";
    } catch (fetchErr) {
      console.warn("enrichCompany: could not fetch page", siteUrl, fetchErr?.message || fetchErr);
      // Keep description from search snippet if page fetch failed
    }

    return {
      companyWebsite: siteUrl,
      companyWebsiteDetails: description || "",
    };
  } catch (err) {
    console.error("enrichCompany failed:", err.message);
    return {};
  }
}

// import fetch from "node-fetch";
// import { load } from "cheerio";

// export async function enrichCompany(companyName) {
//   try {
//     const res = await fetch("https://app.zenserp.com/api/v2/search", {
//       method: "POST",
//       headers: {
//         "Content-Type": "application/json",
//         apikey: process.env.ZENSERP_API_KEY,
//       },

//       body: JSON.stringify({
//         q: `${companyName} official website`,
//         num: 1,
//       }),
//     });

//     const data = await res.json();
//     console.log("data++", data);
//     const site = data.organic?.[0];
//     if (!site) return {};

//     const html = await fetch(site.url, {
//       headers: { "User-Agent": "Mozilla/5.0" },
//     }).then((r) => r.text());

//     const $ = load(html);

//     return {
//       companyWebsite: site.url,
//       companyWebsiteDetails:
//         $('meta[name="description"]').attr("content") ||
//         $("p").first().text().slice(0, 200),
//     };
//   } catch {
//     return {};
//   }
