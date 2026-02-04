"use client";

import { useState } from "react";
import { generateLeads, submitPromptSearch } from "./actions";
import { buildCsv, downloadCsv } from "../lib/csv";

export default function Home() {
  const [view, setView] = useState("search"); // 'search' | 'results'
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchCriteria, setSearchCriteria] = useState(null);

  async function handleSearch(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const formData = new FormData(e.target);
    const prompt = formData.get("prompt");

    if (!prompt || !prompt.trim()) {
      setError("Please enter a search prompt.");
      setLoading(false);
      return;
    }

    try {
      const result = await submitPromptSearch(prompt);
      if (result.error) {
        setError(result.error);
      } else {
        const { success, criteria } = result;
        const leads = await generateLeads(criteria);
        console.log("Leads==:", leads.leads);
        setLeads(leads.leads || []);
        setSearchCriteria(result.criteria);
        setView("results");
      }
    } catch (err) {
      setError("An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  }

  function handleDownload() {
    if (!leads.length) return;
    const csv = buildCsv(leads);
    downloadCsv(csv, "leads_export.csv");
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans flex flex-col">
      {/* Header */}
      <header className="border-b border-zinc-800 bg-zinc-900/50 py-4">
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
          <h1
            className="text-lg font-semibold tracking-tight text-white cursor-pointer"
            onClick={() => setView("search")}
          >
            Prospect<span className="text-emerald-500">AI</span>
          </h1>
        </div>
      </header>

      <main
        className={`${view === "search" ? "flex-1" : ""} flex flex-col items-center justify-center p-6`}
      >
        {view === "search" ? (
          <div className="w-full max-w-3xl space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="text-center space-y-2">
              <h2 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">
                Find your next lead
              </h2>
              <p className="text-zinc-400">
                Describe your ideal prospect in plain English.
              </p>
            </div>

            <form onSubmit={handleSearch} className="relative group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-xl opacity-30 group-focus-within:opacity-100 transition duration-500 blur"></div>
              <div className="relative flex items-center bg-zinc-900 rounded-xl p-2 shadow-2xl">
                <input
                  name="prompt"
                  type="text"
                  placeholder='e.g. "Find CEOs in Austin excluding Interns"'
                  // className="w-full h-full bg-transparent border-none focus:ring-0 text-lg px-4 text-white placeholder-zinc-600"
                  className="w-full bg-transparent h-12 rounded-lg focus:outline-none text-lg px-4 placeholder-zinc-600"
                  autoFocus
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg px-6 py-3 font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                >
                  {loading ? "Searching..." : "Search"}
                </button>
              </div>
            </form>

            {error && (
              <div className="text-red-400 text-center text-sm p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                {error}
              </div>
            )}
          </div>
        ) : (
          <div className="w-full max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500 self-start mt-8">
            <div className="flex items-center justify-between">
              <div>
                <button
                  onClick={() => setView("search")}
                  className="text-zinc-400 hover:text-white text-sm mb-2 flex items-center gap-1 transition-colors cursor-pointer"
                >
                  ← Back to search
                </button>
                <h2 className="text-xl font-semibold text-white">
                  Search Results
                </h2>
                {searchCriteria && (
                  <p className="text-xs text-zinc-500 mt-1">
                    Query: {JSON.stringify(searchCriteria)}
                  </p>
                )}
              </div>
              <button
                onClick={handleDownload}
                className="bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                Download CSV
              </button>
            </div>

            <div className="border border-zinc-800 rounded-xl overflow-hidden bg-zinc-900/30">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-zinc-900/80 text-zinc-400 font-medium uppercase text-xs border-b border-zinc-800">
                    <tr>
                      <th className="px-6 py-4">Name</th>
                      <th className="px-6 py-4">Role</th>
                      <th className="px-6 py-4">Linkedin Followers</th>
                      <th className="px-6 py-4">Company</th>
                      <th className="px-6 py-4">Company Website</th>
                      <th className="px-6 py-4">Company Details</th>
                      {/* <th className="px-6 py-4">Location</th> */}
                      <th className="px-6 py-4">Description</th>
                      <th className="px-6 py-4">linkedinURL</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/50">
                    {leads.map((lead, i) => (
                      <tr
                        key={i}
                        className="hover:bg-zinc-900/50 transition-colors"
                      >
                        <td className="px-6 py-4 font-medium text-white">
                          {lead.name}
                        </td>

                        <td className="px-6 py-4 text-zinc-300">{lead.role}</td>
                        <td className="px-6 py-4 text-zinc-300">
                          {lead.followers}
                        </td>

                        <td className="px-6 py-4 text-zinc-300">
                          {lead.companyName}
                        </td>
                        <td className="px-6 py-4 text-zinc-300">
                          {lead.companyWebsite}
                        </td>
                        <td className="px-6 py-4 text-zinc-300">
                          {lead.companyWebsiteDetails}
                        </td>

                        {/* <td className="px-6 py-4 text-zinc-400">
                          {lead.location}
                        </td> */}
                        <td className="px-6 py-4 text-zinc-400">
                          {lead.linkedinHeadline}
                        </td>
                        <td className="px-6 py-4">
                          <a
                            href={lead.linkedinURL}
                            target="_blank"
                            className="text-emerald-400 hover:text-emerald-300 hover:underline truncate"
                          >
                            {lead.linkedinURL}
                          </a>
                        </td>
                      </tr>
                    ))}
                    {leads.length === 0 && (
                      <tr>
                        <td
                          colSpan={7}
                          className="px-6 py-12 text-center text-zinc-500"
                        >
                          No results found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
