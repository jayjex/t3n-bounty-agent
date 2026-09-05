import { describe, it, expect, vi, afterEach } from 'vitest';
import { scanAll, scanAndTriage } from './earn-scanner.js';
import type { EarnListing } from './types.js';

const makeListing = (over: Partial<EarnListing> = {}): EarnListing => ({
  id: 'id-1',
  slug: 'test-bounty',
  title: 'Test Bounty',
  rewardAmount: 500,
  token: 'USDC',
  deadline: new Date(Date.now() + 3 * 86400_000).toISOString(),
  type: 'bounty',
  status: 'OPEN',
  agentAccess: 'AGENT_ALLOWED',
  sponsor: { name: 'Test Sponsor', slug: 'test', logo: '', isVerified: false },
  _count: { Comments: 0, Submission: 0 },
  ...over,
});

const fetchJson = (payload: unknown) =>
  Promise.resolve({ ok: true, json: () => Promise.resolve(payload) } as Response);

afterEach(() => vi.unstubAllGlobals());

describe('scanAll', () => {
  it('dedupes listings repeated across pages', async () => {
    const a = makeListing({ id: 'a' });
    const b = makeListing({ id: 'b' });
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) =>
        fetchJson(url.includes('page=1') ? [a, b] : url.includes('page=2') ? [b] : []),
      ),
    );
    const out = await scanAll(2);
    expect(out).toHaveLength(2);
  });

  it('returns empty when the API errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve({ ok: false, status: 500 } as Response)),
    );
    await expect(scanAll(1)).rejects.toThrow(/Earn API 500/);
  });
});

describe('scanAndTriage', () => {
  it('filters to AGENT_ALLOWED and scores priority by deadline', async () => {
    const soon = makeListing({ id: 'soon', deadline: new Date(Date.now() + 2 * 86400_000).toISOString() });
    const later = makeListing({ id: 'later', deadline: new Date(Date.now() + 12 * 86400_000).toISOString() });
    const human = makeListing({ id: 'human', agentAccess: 'HUMAN_ONLY' });
    vi.stubGlobal('fetch', vi.fn(() => fetchJson([soon, later, human])));
    const out = await scanAndTriage();
    expect(out.agentEligible).toBe(2);
    expect(out.results[0].id).toBe('soon');
    expect(out.results[0].priority).toBe('high');
    expect(out.results[1].id).toBe('later');
    expect(out.results[1].priority).toBe('medium');
  });

  it('includes HUMAN_ONLY when asked', async () => {
    const human = makeListing({ id: 'human', agentAccess: 'HUMAN_ONLY' });
    vi.stubGlobal('fetch', vi.fn(() => fetchJson([human])));
    const out = await scanAndTriage({ includeHumanOnly: true });
    expect(out.results).toHaveLength(1);
    expect(out.results[0].agentCapable).toBe(false);
  });
});
