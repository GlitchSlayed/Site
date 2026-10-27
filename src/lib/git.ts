import { execSync } from 'node:child_process';

let commitHash: string | null = null;

export function getCommitHash(): string {
  if (commitHash !== null) return commitHash;
  try {
    commitHash = execSync('git rev-parse --short HEAD').toString().trim();
  } catch {
    commitHash = (process.env.PUBLIC_GIT_SHA || process.env.GITHUB_SHA || '').slice(0, 7);
  }
  return commitHash;
}
