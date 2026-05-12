import simpleGit, { SimpleGit } from 'simple-git'
import path from 'path'
import fs from 'fs'

export function getReposDir(): string {
  return process.env.REPOS_DIR || path.join(process.cwd(), 'repos')
}

export function getRepoPath(resourceId: string): string {
  return path.join(getReposDir(), resourceId)
}

export async function ensureRepo(
  resourceId: string,
  upstreamUrl: string
): Promise<SimpleGit> {
  const repoPath = getRepoPath(resourceId)
  fs.mkdirSync(getReposDir(), { recursive: true })

  if (fs.existsSync(repoPath)) {
    // Validate the directory is a healthy git repo (not a partial/killed clone)
    try {
      const git = simpleGit(repoPath)
      await git.status()
    } catch {
      // Corrupted or incomplete clone — wipe and re-clone
      console.log(`[git-ops] repo for ${resourceId} is invalid, re-cloning...`)
      fs.rmSync(repoPath, { recursive: true, force: true })
      await simpleGit().clone(upstreamUrl, repoPath)
    }
  } else {
    await simpleGit().clone(upstreamUrl, repoPath)
  }

  return simpleGit(repoPath)
}

export async function fetchUpstream(git: SimpleGit): Promise<void> {
  await git.env({ GIT_TERMINAL_PROMPT: '0' }).fetch(['origin'])
}

export async function getCommitsAhead(git: SimpleGit): Promise<number> {
  try {
    // Determine the default branch name
    const remoteInfo = await git.raw(['remote', 'show', 'origin'])
    const headMatch = remoteInfo.match(/HEAD branch: (.+)/)
    const branch = headMatch?.[1]?.trim() || 'main'
    const result = await git.raw(['rev-list', '--count', `HEAD..origin/${branch}`])
    return parseInt(result.trim(), 10) || 0
  } catch {
    return 0
  }
}

export async function getDiff(git: SimpleGit): Promise<string> {
  try {
    const remoteInfo = await git.raw(['remote', 'show', 'origin'])
    const headMatch = remoteInfo.match(/HEAD branch: (.+)/)
    const branch = headMatch?.[1]?.trim() || 'main'
    return await git.diff([`HEAD`, `origin/${branch}`])
  } catch {
    return ''
  }
}

export async function mergeUpstream(git: SimpleGit): Promise<void> {
  const remoteInfo = await git.raw(['remote', 'show', 'origin'])
  const headMatch = remoteInfo.match(/HEAD branch: (.+)/)
  const branch = headMatch?.[1]?.trim() || 'main'
  await git.merge([`origin/${branch}`])
}

export async function getLastCommitDate(git: SimpleGit): Promise<string> {
  const result = await git.raw(['log', '-1', '--format=%ci'])
  return result.trim()
}

export async function getLocalCommitHash(git: SimpleGit): Promise<string> {
  const result = await git.raw(['rev-parse', 'HEAD'])
  return result.trim()
}

export function deleteRepo(resourceId: string): void {
  const repoPath = getRepoPath(resourceId)
  if (fs.existsSync(repoPath)) {
    fs.rmSync(repoPath, { recursive: true, force: true })
    console.log(`[git-ops] deleted repo for ${resourceId}`)
  }
}
