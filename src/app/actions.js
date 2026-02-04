"use server";

import { generateSearchQuery } from "../lib/gemini";

export async function generateLeads(criteria) {
  try {
    const response = await fetch("http://localhost:8080/leads", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(criteria),
    });

    if (!response.ok) {
      throw new Error(`API failed: ${response.status}`);
    }

    const data = await response.json();
    console.log("Data++:", data);
    // Expecting API to return leads array
    return data || [];
  } catch (error) {
    console.error("Lead API Error:", error);
    return [];
  }
}
// MOCK DATA GENERATOR
function generateMockLeads(criteria) {
  const count = Math.min(criteria.resultLimit || 10, 50); // Cap mock data
  const leads = [];
  const titles = criteria.jobTitles?.length
    ? criteria.jobTitles
    : ["CEO", "Founder"];
  const location = criteria.location || "United States";

  for (let i = 0; i < count; i++) {
    const title = titles[i % titles.length];
    leads.push({
      name: `Mock User ${i + 1}`,
      role: title,
      company: `Mock Company ${i + 1}`,
      location: location,
      linkedinURL: `https://linkedin.com/in/mock-user-${i + 1}`,
      confidenceScore: Math.floor(Math.random() * 20 + 80) + "%",
    });
  }
  return leads;
}

export async function submitPromptSearch(prompt) {
  try {
    // 1. Convert prompt to structured criteria using Gemini
    let criteria;
    try {
      criteria = await generateSearchQuery(prompt);
    } catch (e) {
      console.error("Gemini failed, falling back to basic parsing", e);
      // Fallback if API fails or key missing
      criteria = {
        jobTitles: ["Founder (Fallback)"],
        location: "Unknown",
        resultLimit: 10,
      };
    }

    // 3. Return the results directly (since we aren't doing async polling for this mock)
    return { success: true, criteria };
  } catch (error) {
    console.error("Search Action Error:", error);
    return { error: "Failed to process search request." };
  }
}
