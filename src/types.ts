export interface EarnListing {
  id: string;
  slug: string;
  title: string;
  rewardAmount: number | null;
  token: string;
  deadline: string;
  type: 'bounty' | 'project';
  status: string;
  agentAccess: 'HUMAN_ONLY' | 'AGENT_ALLOWED';
  sponsor: {
    name: string;
    slug: string;
    logo: string;
    isVerified: boolean;
  };
  _count: {
    Comments: number;
    Submission: number;
  };
}

export interface TriagedBounty {
  id: string;
  slug: string;
  title: string;
  reward: { amount: number | null; token: string };
  deadline: string;
  daysRemaining: number;
  sponsor: string;
  submissionCount: number;
  priority: 'high' | 'medium' | 'low';
  agentCapable: boolean;
  listingUrl: string;
}

export interface ScanResult {
  scannedAt: string;
  totalListings: number;
  agentEligible: number;
  results: TriagedBounty[];
}
