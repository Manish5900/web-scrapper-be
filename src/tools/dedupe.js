export function dedupe(leads) {
  const seen = new Set();
  return leads.filter((l) => {
    if (seen.has(l.linkedinURL)) return false;
    seen.add(l.linkedinURL);
    return true;
  });
}
