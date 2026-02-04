import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || "");

const SYSTEM_PROMPT = `
You are an expert at converting natural language recruiting queries into structured search parameters.
Your goal is to extract the following fields from the user's prompt:
- jobTitles: Array of strings (e.g. ["CEO", "Founder"])
- location: String (e.g. "Austin, Texas")
- industryKeywords: Array of strings (e.g. ["SaaS", "Fintech"])
- negativeKeywords: Array of strings (e.g. ["Intern", "Assistant"])
- excludeCompanies: Array of strings (e.g. ["Amazon", "Google"])
- resultLimit: Number (default to 50, max 200)

Return ONLY a valid JSON object. Do not include markdown code blocks.
If a field is not mentioned, leave it empty or null.
`;

export async function generateSearchQuery(prompt) {
  if (!process.env.GOOGLE_API_KEY) {
    throw new Error("GOOGLE_API_KEY is not set");
  }

  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  try {
    const result = await model.generateContent([
      SYSTEM_PROMPT,
      `User Prompt: "${prompt}"`,
    ]);
    const response = result.response;
    let text = response.text();

    // Clean up markdown code blocks if present
    text = text
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    return JSON.parse(text);
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw new Error("Failed to generate search parameters from prompt");
  }
}
