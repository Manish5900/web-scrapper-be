import dotenv from "dotenv";
dotenv.config();
import fetch from "node-fetch";

export async function zenserpXraySearch(query, limit = 20) {
  const url =
    `https://app.zenserp.com/api/v2/search` +
    `?q=${encodeURIComponent(query)}` +
    `&num=${Number(limit)}` +
    `&gl=us&hl=en`;

  const res = await fetch(url, {
    method: "GET",
    headers: {
      apikey: process.env.ZENSERP_API_KEY,
    },
  });

  const data = await res.json();
  console.log("zenserpXraySearch data++", data);

  if (data.errors) {
    console.error("Zenserp error:", data.errors);
    return [];
  }

  return data.organic || [];
}
// export async function searchApiResult(query, limit = 20) {
//   const num = Math.min(Math.max(1, Number(limit)), 50);
//   const url =
//     `https://www.searchapi.io/api/v1/search` +
//     `?api_key=${process.env.SEARCH_API_KEY}` +
//     `&engine=google&q=${encodeURIComponent(query)}` +
//     `&num=${num}`;

//   const maxRetries = 2;

//   for (let attempt = 0; attempt <= maxRetries; attempt++) {
//     try {
//       const res = await fetch(url, { method: "GET" });
//       const status = res.status;

//       // Try to parse JSON body safely
//       let data = null;
//       try {
//         data = await res.json();
//       } catch (e) {
//         console.error("searchApiResult: failed to parse JSON", e.message);
//         data = null;
//       }

//       if (!res.ok) {
//         console.error(
//           `searchApiResult: non-ok response (status=${status})`,
//           data || null,
//         );

//         // Permanent permission issue or forbidden - fall back immediately
//         if (status === 403) {
//           console.error(
//             "searchApiResult forbidden (403). Falling back to Zenserp.",
//           );
//           // const alt = await zenserpXraySearch(query, limit);
//           // return normalizeOrganic(alt);
//         }

//         // Retry on transient errors
//         if ((status >= 500 || status === 429) && attempt < maxRetries) {
//           await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
//           continue;
//         }

//         // Other non-ok: try fallback
//         const alt = await zenserpXraySearch(query, limit);
//         return normalizeOrganic(alt);
//       }

//       if (!data) {
//         if (attempt < maxRetries) {
//           await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
//           continue;
//         }
//         const alt = await zenserpXraySearch(query, limit);
//         return normalizeOrganic(alt);
//       }

//       if (data.errors || data.error) {
//         console.error("searchApiResult error:", data.errors || data.error);
//         const alt = await zenserpXraySearch(query, limit);
//         return normalizeOrganic(alt);
//       }

//       const organic = data.organic || data.results || [];
//       return normalizeOrganic(organic);
//     } catch (err) {
//       console.error("searchApiResult fetch failed:", err.message);
//       if (attempt < maxRetries) {
//         await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
//         continue;
//       }
//       const alt = await zenserpXraySearch(query, limit);
//       return normalizeOrganic(alt);
//     }
//   }

//   return [];
// }

export async function searchApiResult(query, limit = 20) {
  const num = Math.min(Math.max(1, Number(limit)), 50);

  const url =
    `https://www.searchapi.io/api/v1/search` +
    `?api_key=${process.env.SEARCH_API_KEY}` +
    `&engine=google` +
    `&q=${encodeURIComponent(query)}` +
    `&num=${num}`;

  const maxRetries = 2;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url);
      const status = res.status;

      let data;
      try {
        data = await res.json();
      } catch (e) {
        console.error("searchApiResult: JSON parse failed", e.message);
        data = null;
      }
      console.log("data in searchApiResult++", data);

      if (!res.ok) {
        console.error(
          `searchApiResult: non-ok response (status=${status})`,
          data || null,
        );

        // Retry only on transient errors
        if ((status >= 500 || status === 429) && attempt < maxRetries) {
          await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
          continue;
        }

        return [];
      }

      if (!data) {
        if (attempt < maxRetries) {
          await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
          continue;
        }
        return [];
      }

      if (data.errors || data.error) {
        console.error("searchApiResult API error:", data.errors || data.error);
        return [];
      }

      const organic = data.organic_results || [];
      return normalizeOrganic(organic);
    } catch (err) {
      console.error("searchApiResult fetch failed:", err.message);

      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
        continue;
      }

      return [];
    }
  }

  return [];
}

function normalizeOrganic(items = []) {
  // Convert different provider item shapes into { position, title, url, description, destination }
  return (items || []).map((item, i) => ({
    position: i + 1,
    title: item.title || item.header || item.name || "",
    url: item.link || item.url || item.destination || item.source || "",
    description: item.snippet || item.description || item.summary || "",
    destination: item.displayed_link,
  }));
}

/**
 * Google Custom Search API returns `items` with title, link, snippet.
 * Normalize to { title, url, description } to match extractLeadDetails / organic shape.
 */
export async function googleSearchApiResult(query, limit = 20) {
  const num = Math.min(Math.max(1, Number(limit)), 10); // Google API max 10 per request
  const url =
    `https://www.googleapis.com/customsearch/v1?` +
    `key=${process.env.GOOGLE_API_KEY}` +
    `&cx=${process.env.GOOGLE_CX}` +
    `&q=${encodeURIComponent(query)}` +
    `&num=${num}`;

  const res = await fetch(url, { method: "GET" });
  const data = await res.json();

  if (data.error) {
    console.error("googleSearchApiResult error:", data.error);
    return [];
  }

  const items = data.items || [];
  return items.map((item, i) => ({
    position: i + 1,
    title: item.title || "",
    url: item.link || item.url || "",
    description: item.snippet || "",
    destination: null,
  }));
}

// export async function zenserpXraySearch(query, limit = 20) {
//   console.log("process.env.ZENSERP_API_KEY", process.env.ZENSERP_API_KEY);
//   const res = await fetch("https://app.zenserp.com/api/v2/search", {
//     method: "POST",
//     headers: {
//       "Content-Type": "application/json",
//       apikey: process.env.ZENSERP_API_KEY,
//     },
//     body: JSON.stringify({
//       q: query,
//       num: Number(limit),
//       gl: "us",
//       hl: "en",
//     }),
//   });

//   const data = await res.json();
//   console.log("zenserpXraySearch data++", data);
//   return data.organic || [];
// }
