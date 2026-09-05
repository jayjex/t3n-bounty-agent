import type { EarnListing, TriagedBounty, ScanResult } from './types.js';

const EARN_API = 'https://superteam.fun/api/listings';
const PRIVY_APP_ID = 'cm6sav90900nixch9nzy7c41v';

/** Fetch one page of listings from Superteam Earn. */
async function fetchPage(page: number, take = 20): Promise<EarnListing[]> {
  const url = `${EARN_API}?page=${page}&take=${take}`;
  const res = await fetch(url, {
    headers: { 'privy-app-id': PRIVY_APP_ID },
  });
  if (!res.ok) throw new Error(`Earn API ${res.status}: ${url}`);
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

/** Scrape ALL live listings (3 pages covers ~60 items). */
export async function scanAll(maxPages = 3): Promise<EarnListing[]> {
  const seen = new Set<string>();
  const results: EarnListing[] = [];
  for (let p = 1; p <= maxPages; p++) {
    const page = await fetchPage(p);
    if (page.length === 0) break;
    for (const l of page) {
      if (seen.has(l.id)) continue;
      seen.add(l.id);
      results.push(l);
    }
  }
  return results;
}

/** Score and triage a listing. */
function triage(listing: EarnListing): TriagedBounty {
  const now = new Date();
  const deadline = new Date(listing.deadline);
  const daysRemaining = Math.max(
    0,
    Math.round((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
  );

  let priority: TriagedBounty['priority'] = 'low';
  if (daysRemaining <= 3 && listing.agentAccess === 'AGENT_ALLOWED') priority = 'high';
  else if (daysRemaining <= 7 && listing.agentAccess === 'AGENT_ALLOWED') priority = 'medium';
  else if (listing.agentAccess === 'AGENT_ALLOWED') priority = 'medium';

  return {
    id: listing.id,
    slug: listing.slug,
    title: listing.title,
    reward: { amount: listing.rewardAmount, token: listing.token },
    deadline: listing.deadline,
    daysRemaining,
    sponsor: listing.sponsor.name,
    submissionCount: listing._count.Submission,
    priority,
    agentCapable: listing.agentAccess === 'AGENT_ALLOWED',
    listingUrl: `https://superteam.fun/earn/listing/${listing.slug}`,
  };
}

/** Scan + filter + triage → structured result. */
export async function scanAndTriage(
  { includeHumanOnly = false, maxPages = 3 }: { includeHumanOnly?: boolean; maxPages?: number } = {},
): Promise<ScanResult> {
  const raw = await scanAll(maxPages);
  const eligible = includeHumanOnly ? raw : raw.filter((l) => l.agentAccess === 'AGENT_ALLOWED');
  const triaged = eligible.map(triage).sort((a, b) => {
    const rank = { high: 0, medium: 1, low: 2 };
    return rank[a.priority] - rank[b.priority] || (a.daysRemaining ?? 999) - (b.daysRemaining ?? 999);
  });

  return {
    scannedAt: new Date().toISOString(),
    totalListings: raw.length,
    agentEligible: eligible.length,
    results: triaged,
  };
}
