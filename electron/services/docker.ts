import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { loadSettings } from './settings';
import { toWslPath, shQuote } from './wsl-session';

const execFileAsync = promisify(execFile);

/** Result of a docker action run inside WSL. */
export interface DockerResult {
  ok: boolean;
  output: string; // merged stdout+stderr (or the spawn error message)
}

/** Reads the configured WSL distro, defaulting to Ubuntu (e.g. in tests). */
function distroName(): string {
  try {
    return loadSettings().wslDistro || 'Ubuntu';
  } catch {
    return 'Ubuntu';
  }
}

/**
 * Builds the WSL command to ensure the Docker engine is usable. First checks
 * `docker info` (works without sudo when the user is in the `docker` group / the
 * daemon is already up); only if that fails does it try a non-interactive
 * `sudo -n service docker start`. `sudo -n` fails fast instead of hanging on a
 * password prompt a non-interactive child can never answer. Exported so the
 * self-check can assert the command without spawning WSL.
 */
export function startEngineArgs(distro: string): string[] {
  return [
    '-d', distro, '--', 'bash', '-lc',
    'docker info >/dev/null 2>&1 && echo "Docker engine already running" || sudo -n systemctl start docker.service docker.socket',
  ];
}

/**
 * Builds the WSL command to stop Docker. Stops BOTH docker.service and
 * docker.socket — leaving the socket up would let any connection (docker info,
 * compose) socket-activate the daemon again. Relies on a NOPASSWD sudoers rule.
 */
export function stopEngineArgs(distro: string): string[] {
  return ['-d', distro, '--', 'bash', '-lc', 'sudo -n systemctl stop docker.service docker.socket'];
}

/**
 * Builds the argv to bring up a compose file inside WSL. The Windows path is
 * translated to its /mnt mount and POSIX-quoted — the value reaches WSL through
 * `bash -lc`, so quoting guards the (file-picker, trusted) path against spaces
 * and shell metacharacters at this boundary.
 */
export function composeUpArgs(distro: string, winComposePath: string): string[] {
  const wslPath = shQuote(toWslPath(winComposePath));
  return ['-d', distro, '--', 'bash', '-lc', `docker compose -f ${wslPath} up -d`];
}

async function runWsl(args: string[], timeoutMs: number): Promise<DockerResult> {
  try {
    const { stdout, stderr } = await execFileAsync('wsl.exe', args, {
      encoding: 'utf-8',
      timeout: timeoutMs,
      windowsHide: true,
    });
    return { ok: true, output: (stdout + stderr).trim() };
  } catch (err) {
    // execFile rejects on non-zero exit/timeout; surface its captured output.
    const e = err as { stdout?: string; stderr?: string; message?: string };
    const output = ((e.stdout ?? '') + (e.stderr ?? '')).trim() || e.message || 'docker command failed';
    return { ok: false, output };
  }
}

/** Starts the Docker engine inside WSL (idempotent — ok if already running). */
export function startDockerEngine(distro: string = distroName()): Promise<DockerResult> {
  return runWsl(startEngineArgs(distro), 30_000);
}

/**
 * Stops the Docker engine via `sudo -n service docker stop` inside WSL. Surgical —
 * it stops only Docker, leaving other WSL sessions/terminals untouched. Relies on a
 * NOPASSWD sudoers rule for `service docker *`; without it `sudo -n` fails fast.
 */
export function stopDockerEngine(distro: string = distroName()): Promise<DockerResult> {
  return runWsl(stopEngineArgs(distro), 30_000);
}

/** Runs `docker compose -f <file> up -d` inside WSL for the given compose file. */
export function composeUp(winComposePath: string, distro: string = distroName()): Promise<DockerResult> {
  return runWsl(composeUpArgs(distro, winComposePath), 120_000);
}

/**
 * Builds a Windows shell command that opens a visible `cmd /k` window running
 * the same compose-up inside WSL, so the user can watch live logs/errors. Used
 * as the "open a terminal with the detail" fallback when the background run fails.
 * `cmd /k` keeps the window open after the command finishes.
 */
export function composeTerminalCommand(distro: string, winComposePath: string): string {
  const wslPath = shQuote(toWslPath(winComposePath));
  return `start "" cmd.exe /k wsl.exe -d "${distro}" -- bash -lc "docker compose -f ${wslPath} up -d"`;
}

/** A single running container row (subset of `docker ps` fields). */
export interface DockerContainer {
  id: string;
  names: string;
  image: string;
  status: string;
  ports: string;
}

/** Result of listing running containers. */
export interface DockerPsResult {
  ok: boolean;
  containers: DockerContainer[];
  output: string; // raw stdout/stderr — shown on error
}

/**
 * Builds the argv for `docker ps --format {{json .}}` (running containers only;
 * one JSON object per line). Exported for the self-check.
 */
export function listContainersArgs(distro: string): string[] {
  return ['-d', distro, '--', 'docker', 'ps', '--format', '{{json .}}'];
}

/** Parses the newline-delimited JSON of `docker ps --format {{json .}}`. */
export function parseContainers(stdout: string): DockerContainer[] {
  return stdout
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const c = JSON.parse(line) as Record<string, string>;
      return {
        id: c.ID ?? '',
        names: c.Names ?? '',
        image: c.Image ?? '',
        status: c.Status ?? '',
        ports: c.Ports ?? '',
      };
    });
}

/** Lists running containers inside WSL. Read-only; no sudo needed. */
export async function listContainers(distro: string = distroName()): Promise<DockerPsResult> {
  const res = await runWsl(listContainersArgs(distro), 15_000);
  if (!res.ok) return { ok: false, containers: [], output: res.output };
  try {
    return { ok: true, containers: parseContainers(res.output), output: res.output };
  } catch {
    return { ok: false, containers: [], output: res.output || 'Could not parse docker ps output' };
  }
}

/**
 * Builds the argv for `docker stop <id>`. The id passes as its own argv element
 * (execFile, no shell) so it can't be misinterpreted. Exported for the self-check.
 */
export function stopContainerArgs(distro: string, id: string): string[] {
  return ['-d', distro, '--', 'docker', 'stop', id];
}

/** Stops a running container by id/name inside WSL. No sudo needed. */
export function stopContainer(id: string, distro: string = distroName()): Promise<DockerResult> {
  return runWsl(stopContainerArgs(distro, id), 30_000);
}
