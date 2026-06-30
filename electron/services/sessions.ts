import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadSettings } from './settings';
import { toWslPath } from './wsl-session';

export type SessionSource = 'copilot' | 'claude' | 'reasonix';

/** One past/live CLI session for a project, shown in the Sessions list. */
export interface SessionEntry {
  id: string;
  source: SessionSource;
  /** Human label: the session name, or the file/folder id as fallback. */
  title: string;
  /** ISO timestamp of last activity, used for sorting (newest first). */
  updatedAt: string;
}

export interface SessionListResult {
  sessions: SessionEntry[];
  error?: string;
}

/** A single clean turn in a transcript — no thinking, no tool calls. */
export interface TranscriptMessage {
  role: 'user' | 'assistant';
  text: string;
}

export interface TranscriptResult {
  source: SessionSource;
  messages: TranscriptMessage[];
  error?: string;
}

const HOME = os.homedir();

/** Reasonix 1.8.0 native config root (Go `config.MemoryUserDir()` =
 *  `os.UserConfigDir()/reasonix`): %AppData%\reasonix on Windows,
 *  ~/Library/Application Support/reasonix on macOS, $XDG_CONFIG_HOME (or
 *  ~/.config)/reasonix on Linux. */
function getReasonixDataDir(): string {
  if (process.platform === 'win32') {
    return path.join(process.env.APPDATA || path.join(HOME, 'AppData', 'Roaming'), 'reasonix');
  }
  if (process.platform === 'darwin') {
    return path.join(HOME, 'Library', 'Application Support', 'reasonix');
  }
  return path.join(process.env.XDG_CONFIG_HOME || path.join(HOME, '.config'), 'reasonix');
}

/** Path → slug used by Claude/Reasonix for per-project dirs (C:\a\b → C--a-b,
 *  /mnt/c/a → -mnt-c-a), matching reasonix's `config.WorkspaceSlug`. */
function projectSlug(p: string): string {
  return p.replace(/[:\\/]/g, '-').replace(/\.\./g, '');
}

/** Normalise a path for comparison: drop trailing seps, unify slashes, lowercase. */
function normPath(p: string): string {
  return p.trim().replace(/[\\/]+$/, '').replace(/\\/g, '/').toLowerCase();
}

/** Minimal `key: value` reader for the flat workspace.yaml the Copilot CLI writes. */
function readYamlField(yaml: string, key: string): string | null {
  const m = yaml.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'));
  return m ? m[1].trim() : null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Scan contexts. The same coder writes its session files into a different home
// depending on where it runs: the Windows/native home, or — when the WSL2 toggle
// is on — the Linux home inside WSL (reached over the \\wsl.localhost UNC share).
// A coder running in WSL also records the project as its mounted /mnt/c/… path,
// so each context carries the `target` path used to match a session to a project.
// ─────────────────────────────────────────────────────────────────────────────

interface ScanContext {
  copilot: string;        // <home>/.copilot/session-state
  claudeSessions: string; // <home>/.claude/sessions
  claudeProjects: string; // <home>/.claude/projects
  reasonixRoot: string;   // reasonix config root (holds projects/<slug>/sessions)
  target: string;         // project path as coders in this context record it
}

/** Builds the \\wsl.localhost UNC path for a POSIX home under a distro. */
export function toWslUnc(distro: string, posixHome: string): string {
  return `\\\\wsl.localhost\\${distro}${posixHome.replace(/\//g, '\\')}`;
}

// ponytail: spawns wsl.exe once per distro to resolve $HOME, then caches it.
// Swap `echo $HOME` for `wslpath -w ~` if a distro ever needs odd UNC handling.
const wslHomeCache = new Map<string, string>();
function wslHomeUnc(): string | null {
  let s: { useWsl2Git?: boolean; wslDistro?: string };
  try { s = loadSettings(); } catch { return null; }
  if (!s.useWsl2Git) return null;
  const distro = s.wslDistro || 'Ubuntu';
  const cached = wslHomeCache.get(distro);
  if (cached) return cached;
  try {
    const home = execFileSync('wsl.exe', ['-d', distro, '--', 'sh', '-c', 'echo $HOME'], {
      encoding: 'utf-8', timeout: 5000, windowsHide: true,
    }).trim();
    if (!home.startsWith('/')) return null;
    const unc = toWslUnc(distro, home);
    wslHomeCache.set(distro, unc);
    return unc;
  } catch {
    return null;
  }
}

function nativeContext(projectPath: string): ScanContext {
  return {
    copilot: path.join(HOME, '.copilot', 'session-state'),
    claudeSessions: path.join(HOME, '.claude', 'sessions'),
    claudeProjects: path.join(HOME, '.claude', 'projects'),
    reasonixRoot: getReasonixDataDir(),
    target: projectPath,
  };
}

function wslContext(projectPath: string): ScanContext | null {
  const home = wslHomeUnc();
  if (!home) return null;
  return {
    copilot: path.join(home, '.copilot', 'session-state'),
    claudeSessions: path.join(home, '.claude', 'sessions'),
    claudeProjects: path.join(home, '.claude', 'projects'),
    reasonixRoot: path.join(home, '.config', 'reasonix'),
    target: toWslPath(projectPath),
  };
}

/** Where Copilot sessions live: the WSL home when the toggle is on (Copilot is
 *  the only coder launched in WSL), otherwise the native home. Claude/Reasonix
 *  always use the native home. */
function copilotContext(projectPath: string): ScanContext {
  return wslContext(projectPath) ?? nativeContext(projectPath);
}

function reasonixSessionsDir(ctx: ScanContext): string {
  return path.join(ctx.reasonixRoot, 'projects', projectSlug(ctx.target), 'sessions');
}

// ─────────────────────────────────────────────────────────────────────────────
// Transcript parsers (exported for unit tests). Each keeps only user/assistant
// text in file order — thinking and tool calls are skipped entirely.
// ─────────────────────────────────────────────────────────────────────────────

/** Copilot CLI events.jsonl → clean transcript.
 *  user.message.data.content + assistant.message.data.content (thinking lives in
 *  the separate `reasoningOpaque` field, never read here). */
export function parseCopilotTranscript(raw: string): TranscriptMessage[] {
  const out: TranscriptMessage[] = [];
  for (const line of raw.split('\n')) {
    if (!line) continue;
    if (!line.includes('user.message') && !line.includes('assistant.message')) continue;
    let e: { type?: string; data?: { content?: string } };
    try { e = JSON.parse(line); } catch { continue; }
    const text = e.data?.content?.trim();
    if (!text) continue;
    if (e.type === 'user.message') out.push({ role: 'user', text });
    else if (e.type === 'assistant.message') out.push({ role: 'assistant', text });
  }
  return out;
}

type ClaudeContentBlock = { type?: string; text?: string };

/** Claude Code transcript JSONL → clean transcript.
 *  Keeps only `text` blocks from user/assistant messages; thinking, tool_use and
 *  tool_result blocks are skipped. */
export function parseClaudeTranscript(raw: string): TranscriptMessage[] {
  const out: TranscriptMessage[] = [];
  for (const line of raw.split('\n')) {
    if (!line) continue;
    let e: { type?: string; message?: { role?: string; content?: string | ClaudeContentBlock[] } };
    try { e = JSON.parse(line); } catch { continue; }
    const role = e.message?.role;
    if (role !== 'user' && role !== 'assistant') continue;
    const content = e.message?.content;

    let text = '';
    if (typeof content === 'string') {
      text = content.trim();
    } else if (Array.isArray(content)) {
      text = content
        .filter((b) => b?.type === 'text' && typeof b.text === 'string')
        .map((b) => b.text!.trim())
        .filter(Boolean)
        .join('\n');
    }
    if (text) out.push({ role, text });
  }
  return out;
}

/** Reasonix session transcript JSONL (OpenAI-style messages) → clean transcript.
 *  Keeps user/assistant messages with string content; tool / tool_calls / system
 *  messages are skipped. */
export function parseReasonixTranscript(raw: string): TranscriptMessage[] {
  const out: TranscriptMessage[] = [];
  for (const line of raw.split('\n')) {
    if (!line) continue;
    let m: { role?: string; content?: unknown };
    try { m = JSON.parse(line); } catch { continue; }
    if (m.role !== 'user' && m.role !== 'assistant') continue;
    let text = '';
    if (typeof m.content === 'string') {
      text = m.content.trim();
    } else if (Array.isArray(m.content)) {
      // Some providers store content as [{type:'text', text:'…'}].
      text = (m.content as Array<{ type?: string; text?: string }>)
        .filter((b) => typeof b?.text === 'string')
        .map((b) => b.text!.trim())
        .filter(Boolean)
        .join('\n');
    }
    if (text) out.push({ role: m.role, text });
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// Session listing — cheap metadata scan per source (no transcript parsing).
// ─────────────────────────────────────────────────────────────────────────────

function listCopilotSessions(ctx: ScanContext): SessionEntry[] {
  const target = normPath(ctx.target);
  const out: SessionEntry[] = [];
  if (!existsSync(ctx.copilot)) return out;

  let dirs: string[];
  try {
    dirs = readdirSync(ctx.copilot, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);
  } catch { return out; }

  for (const dir of dirs) {
    const sessionDir = path.join(ctx.copilot, dir);
    const yamlPath = path.join(sessionDir, 'workspace.yaml');
    const eventsPath = path.join(sessionDir, 'events.jsonl');
    if (!existsSync(yamlPath) || !existsSync(eventsPath)) continue;
    let yaml: string;
    try { yaml = readFileSync(yamlPath, 'utf-8'); } catch { continue; }
    const cwd = readYamlField(yaml, 'cwd');
    if (!cwd || normPath(cwd) !== target) continue;
    out.push({
      id: dir,
      source: 'copilot',
      title: readYamlField(yaml, 'name') || dir,
      updatedAt: readYamlField(yaml, 'updated_at') || mtimeIso(eventsPath),
    });
  }
  return out;
}

function listClaudeSessions(ctx: ScanContext): SessionEntry[] {
  const target = normPath(ctx.target);
  const slug = projectSlug(ctx.target);
  const out: SessionEntry[] = [];
  if (!existsSync(ctx.claudeSessions)) return out;

  let files: string[];
  try {
    files = readdirSync(ctx.claudeSessions, { withFileTypes: true })
      .filter((d) => d.isFile() && d.name.endsWith('.json'))
      .map((d) => d.name);
  } catch { return out; }

  for (const file of files) {
    let data: { sessionId?: string; cwd?: string; name?: string; updatedAt?: number };
    try { data = JSON.parse(readFileSync(path.join(ctx.claudeSessions, file), 'utf-8')); } catch { continue; }
    if (!data.sessionId || !data.cwd || normPath(data.cwd) !== target) continue;
    const transcript = path.join(ctx.claudeProjects, slug, `${data.sessionId}.jsonl`);
    if (!existsSync(transcript)) continue;
    out.push({
      id: data.sessionId,
      source: 'claude',
      title: data.name || data.sessionId,
      updatedAt: data.updatedAt ? new Date(data.updatedAt).toISOString() : mtimeIso(transcript),
    });
  }
  return out;
}

/** Reads the `<session>.jsonl.meta` sidecar reasonix 1.8.0 writes beside each
 *  session: human title (`topic_title`) and activity time (`updated_at`). */
function readReasonixMeta(jsonlPath: string): { title?: string; updatedAt?: string } {
  try {
    const m = JSON.parse(readFileSync(`${jsonlPath}.meta`, 'utf-8')) as {
      topic_title?: string;
      updated_at?: string;
    };
    return { title: m.topic_title?.trim() || undefined, updatedAt: m.updated_at || undefined };
  } catch {
    return {};
  }
}

function listReasonixSessions(ctx: ScanContext): SessionEntry[] {
  const dir = reasonixSessionsDir(ctx);
  const out: SessionEntry[] = [];
  if (!existsSync(dir)) return out;

  let files: string[];
  try { files = readdirSync(dir); } catch { return out; }

  for (const f of files) {
    if (!f.endsWith('.jsonl') || f.includes('.ckpt')) continue;
    const full = path.join(dir, f);
    const meta = readReasonixMeta(full);
    out.push({
      id: f,
      source: 'reasonix',
      title: meta.title || f.replace(/\.jsonl$/, ''),
      updatedAt: meta.updatedAt || mtimeIso(full),
    });
  }
  return out;
}

function mtimeIso(file: string): string {
  try { return statSync(file).mtime.toISOString(); } catch { return ''; }
}

/** Lists all CLI sessions on disk for a project, newest first. Copilot is read
 *  from WSL when the toggle is on (where it runs), else native; Claude/Reasonix
 *  are always native. */
export function listProjectSessions(projectPath: string): SessionListResult {
  try {
    const native = nativeContext(projectPath);
    const sessions = [
      ...listCopilotSessions(copilotContext(projectPath)),
      ...listClaudeSessions(native),
      ...listReasonixSessions(native),
    ];
    sessions.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return { sessions };
  } catch (err) {
    return { sessions: [], error: err instanceof Error ? err.message : 'Cannot list sessions' };
  }
}

function transcriptPath(source: SessionSource, ctx: ScanContext, sessionId: string): string {
  if (source === 'copilot') return path.join(ctx.copilot, sessionId, 'events.jsonl');
  if (source === 'claude') return path.join(ctx.claudeProjects, projectSlug(ctx.target), `${sessionId}.jsonl`);
  return path.join(reasonixSessionsDir(ctx), sessionId);
}

/** Reads and parses one session's transcript into clean user/assistant turns.
 *  Resolves Copilot against the same home used for listing (WSL or native). */
export function getTranscript(source: SessionSource, sessionId: string, projectPath: string): TranscriptResult {
  // Guard against path traversal in the id coming from the renderer.
  if (sessionId.includes('..') || sessionId.includes('/') || sessionId.includes('\\')) {
    return { source, messages: [], error: 'Invalid session id' };
  }

  const parse =
    source === 'copilot' ? parseCopilotTranscript :
    source === 'claude' ? parseClaudeTranscript :
    parseReasonixTranscript;

  const ctx = source === 'copilot' ? copilotContext(projectPath) : nativeContext(projectPath);
  const file = transcriptPath(source, ctx, sessionId);
  if (!existsSync(file)) return { source, messages: [], error: 'Transcript not found' };
  try {
    return { source, messages: parse(readFileSync(file, 'utf-8')) };
  } catch (err) {
    return { source, messages: [], error: err instanceof Error ? err.message : 'Cannot read transcript' };
  }
}
