export function calculateScore(lead) {
  let score = 0;
  if (lead.name) score += 20;
  if (lead.role) score += 20;
  if (lead.company) score += 20;
  if (lead.linkedinURL) score += 20;
  if (lead.companyWebsite) score += 20;
  return score;
}
