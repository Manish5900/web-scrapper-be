"use client";

import Link from "next/link";
import { useState } from "react";

const API_BASE = "http://localhost:8080";

export default function LeadGenerationPage() {
  const [prompt, setPrompt] = useState("");
  const [limit, setLimit] = useState(5);
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [criteria, setCriteria] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    const trimmed = prompt.trim();
    if (!trimmed) {
      setError("Please enter a prompt describing your ideal lead.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/leads/prompt`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: trimmed,
          limit: Number(limit) || 50,
        }),
      });

      if (!res.ok) {
        throw new Error(`API error: ${res.status}`);
      }

      const data = await res.json();
      if (data.success === false) {
        setError(data.error || "Failed to generate leads.");
        setLeads([]);
        return;
      }

      setCriteria(data.criteria || null);
      setLeads(data.leads || []);
    } catch (err) {
      console.error("Lead generation failed:", err);
      setError(
        "Something went wrong while generating leads. Please try again.",
      );
      setLeads([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      {/* Header */}
      <header className="border-b border-zinc-800 bg-zinc-900/60 backdrop-blur py-4">
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between gap-4">
          <Link
            href="/"
            className="text-lg font-semibold tracking-tight text-white"
          >
            Prospect<span className="text-emerald-500">AI</span>
          </Link>
          <span className="text-xs md:text-sm text-zinc-400">
            Lead generation · LinkedIn X‑ray · Company enrichment
          </span>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* Prompt card */}
        <section className="grid gap-6 lg:grid-cols-[minmax(0,3fr),minmax(0,2fr)] items-start">
          <div className="relative group">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-2xl opacity-30 group-hover:opacity-80 transition duration-500 blur" />
            <div className="relative bg-zinc-950 border border-zinc-800/80 rounded-2xl p-6 md:p-7 shadow-2xl space-y-5">
              <div className="space-y-2">
                <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">
                  Lead generation with a single prompt
                </h1>
                <p className="text-sm md:text-base text-zinc-400">
                  Describe the types of people or companies you want to reach
                  (role, location, industry, exclusions) and we&apos;ll return
                  enriched leads.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <label
                    htmlFor="prompt"
                    className="block text-xs font-medium uppercase tracking-wide text-zinc-400"
                  >
                    Lead generation prompt
                  </label>
                  <textarea
                    id="prompt"
                    rows={4}
                    className="w-full rounded-xl bg-zinc-900 border border-zinc-800 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/40 outline-none text-sm md:text-base px-3.5 py-2.5 text-zinc-100 placeholder-zinc-600 resize-none"
                    placeholder={`Example: "Founders or CEOs of B2B SaaS startups in Bangalore, exclude interns and students, ignore Google and Microsoft."`}
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                  />
                </div>

                <div className="flex flex-wrap items-center gap-4">
                  <div className="space-y-1">
                    <label
                      htmlFor="limit"
                      className="block text-xs font-medium uppercase tracking-wide text-zinc-500"
                    >
                      Max leads
                    </label>
                    <input
                      id="limit"
                      type="number"
                      min={1}
                      max={100}
                      value={limit}
                      onChange={(e) => setLimit(e.target.value)}
                      className="w-24 rounded-lg bg-zinc-900 border border-zinc-800 px-3 py-1.5 text-sm text-zinc-100 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/40 outline-none"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 px-5 py-2.5 text-sm font-medium text-white transition disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {loading ? (
                      <>
                        <span className="h-3 w-3 rounded-full border-2 border-white/40 border-t-transparent animate-spin" />
                        Generating leads...
                      </>
                    ) : (
                      "Generate leads"
                    )}
                  </button>
                </div>

                {error && (
                  <p className="text-xs md:text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
                    {error}
                  </p>
                )}
              </form>
            </div>
          </div>

          <div className="space-y-4 text-sm text-zinc-400">
            <div className="bg-zinc-950 border border-zinc-800/80 rounded-2xl p-4 md:p-5 space-y-3">
              <h2 className="text-sm font-semibold text-zinc-100">
                What you&apos;ll get for each lead
              </h2>
              <ul className="space-y-1.5 list-disc list-inside">
                <li>
                  <span className="font-medium text-zinc-100">Name</span> and{" "}
                  <span className="font-medium text-zinc-100">
                    Company Name
                  </span>
                </li>
                <li>
                  <span className="font-medium text-zinc-100">Phone</span> (best
                  effort from company website)
                </li>
                <li>
                  <span className="font-medium text-zinc-100">Email</span> (best
                  effort from company website)
                </li>
                <li>
                  <span className="font-medium text-zinc-100">
                    LinkedIn URL
                  </span>
                </li>
                <li>
                  <span className="font-medium text-zinc-100">
                    Company / personal website
                  </span>
                </li>
                <li>
                  <span className="font-medium text-zinc-100">
                    Website description
                  </span>{" "}
                  (what the website is about)
                </li>
              </ul>
            </div>

            {criteria && (
              <div className="bg-zinc-950 border border-zinc-800/80 rounded-2xl p-4">
                <p className="text-xs uppercase tracking-wide text-zinc-500 mb-1">
                  Parsed search criteria
                </p>
                <pre className="text-xs text-zinc-300 bg-zinc-900/80 rounded-lg p-3 overflow-x-auto">
                  {JSON.stringify(criteria, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </section>

        {/* Results table */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-200">
              Leads ({leads.length})
            </h2>
          </div>

          <div className="border border-zinc-800 rounded-2xl overflow-hidden bg-zinc-900/40">
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs md:text-sm text-left">
                <thead className="bg-zinc-900/80 text-zinc-400 font-medium uppercase text-[0.65rem] md:text-xs border-b border-zinc-800">
                  <tr>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Company Name</th>
                    <th className="px-4 py-3">Phone</th>
                    <th className="px-4 py-3">Email</th>
                    <th className="px-4 py-3">LinkedIn</th>
                    <th className="px-4 py-3">Website</th>
                    <th className="px-4 py-3">Website description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {leads.map((lead, idx) => (
                    <tr
                      key={idx}
                      className="hover:bg-zinc-900/60 transition-colors"
                    >
                      <td className="px-4 py-3 text-zinc-100 font-medium">
                        {lead.name || "-"}
                      </td>
                      <td className="px-4 py-3 text-zinc-200">
                        {lead.companyName || "-"}
                      </td>
                      <td className="px-4 py-3 text-zinc-300">
                        {lead.phone || "-"}
                      </td>
                      <td className="px-4 py-3 text-zinc-300">
                        {lead.email ? (
                          <a
                            href={`mailto:${lead.email}`}
                            className="text-emerald-400 hover:text-emerald-300 hover:underline"
                          >
                            {lead.email}
                          </a>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="px-4 py-3 text-zinc-300 max-w-[180px]">
                        {lead.linkedinURL ? (
                          <Link
                            href={lead.linkedinURL}
                            target="_blank"
                            rel="noreferrer"
                            className="text-emerald-400 hover:text-emerald-300 hover:underline break-all"
                          >
                            {lead.linkedinURL}
                          </Link>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="px-4 py-3 text-zinc-300 max-w-[180px]">
                        {lead.website ? (
                          <Link
                            href={lead.website}
                            target="_blank"
                            rel="noreferrer"
                            className="text-emerald-400 hover:text-emerald-300 hover:underline break-all"
                          >
                            {lead.website}
                          </Link>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="px-4 py-3 text-zinc-400 max-w-xs md:max-w-md">
                        <span className="line-clamp-3">
                          {lead.websiteDescription || "-"}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {leads.length === 0 && (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-4 py-10 text-center text-zinc-500"
                      >
                        No leads yet. Run a search to see results here.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
