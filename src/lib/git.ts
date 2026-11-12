import { execSync } from 'node:child_process';

let commitHash: string | null = null;

export function getCommitHash(): string {
  if (commitHash !== null) return commitHash;
  try {
    const globalBun = (globalThis as unknown as { Bun?: { spawnSync: (args: string[]) => { stdout: { toString: () => string } } } }).Bun;
    if (globalBun?.spawnSync) {
      commitHash = globalBun.spawnSync(['git', 'rev-parse', '--short', 'HEAD']).stdout.toString().trim();
    } else {
      commitHash = execSync('git rev-parse --short HEAD').toString().trim();
    }
  } catch {
    commitHash = (process.env.PUBLIC_GIT_SHA || process.env.GITHUB_SHA || '').slice(0, 7);
  }
  return commitHash || '';
}
