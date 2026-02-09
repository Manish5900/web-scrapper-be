import dotenv from "dotenv";

dotenv.config();

// Polyfill `File` for Node 18 compatibility (undici/web fetch expects global File).
// This file runs BEFORE importing the rest of the app module graph.
if (!globalThis.File) {
  const { File } = await import("fetch-blob/file.js");
  globalThis.File = File;
}

await import("./app.js");
