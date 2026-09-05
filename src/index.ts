#!/usr/bin/env node
/**
 * t3n-bounty-agent — Superteam Earn bounty triage agent built on the T3N ADK.
 *
 * Scans live Superteam Earn listings, filters for agent-completable bounties
 * (agentAccess === "AGENT_ALLOWED"), scores by deadline proximity, and emits
 * structured JSON.
 *
 * Usage:
 *   npx tsx src/index.ts                     # mock mode (no T3N key needed)
 *   T3N_API_KEY=<key> npx tsx src/index.ts   # live mode (real T3N session)
 *   npx tsx src/index.ts --env production    # pick cluster
 *   npx tsx src/index.ts --include-human     # also report HUMAN_ONLY listings
 */
import { connect } from './t3n-client.js';
import { scanAndTriage } from './earn-scanner.js';

interface CliArgs {
  env: string;
  includeHuman: boolean;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = { env: 'testnet', includeHuman: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--env') args.env = argv[++i] ?? args.env;
    if (argv[i] === '--include-human') args.includeHuman = true;
  }
  return args;
}

async function main(): Promise<void> {
  const { env, includeHuman } = parseArgs(process.argv.slice(2));

  const session = await connect(env);
  console.error(`[t3n-bounty-agent] session mode=${session.mode} did=${session.did} env=${env}`);

  const result = await scanAndTriage({ includeHumanOnly: includeHuman });

  console.log(
    JSON.stringify(
      {
        agent: 't3n-bounty-agent',
        did: session.did,
        t3nMode: session.mode,
        ...result,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error('[t3n-bounty-agent] fatal:', err);
  process.exit(1);
});
