import { describe, it, expect, vi } from 'vitest';

// docker.ts → settings.ts imports `electron`; stub it so the module loads.
vi.mock('electron', () => ({ app: { getPath: () => '' } }));

import { startEngineArgs, stopEngineArgs, composeUpArgs, composeTerminalCommand, parseContainers, listContainersArgs, stopContainerArgs } from '../docker';

describe('startEngineArgs', () => {
  it('checks docker info first, falling back to non-interactive sudo start', () => {
    expect(startEngineArgs('Ubuntu')).toEqual([
      '-d', 'Ubuntu', '--', 'bash', '-lc',
      'docker info >/dev/null 2>&1 && echo "Docker engine already running" || sudo -n systemctl start docker.service docker.socket',
    ]);
  });
});

describe('stopEngineArgs', () => {
  it('stops both the docker service and socket to prevent socket re-activation', () => {
    expect(stopEngineArgs('Ubuntu')).toEqual([
      '-d', 'Ubuntu', '--', 'bash', '-lc',
      'sudo -n systemctl stop docker.service docker.socket',
    ]);
  });
});

describe('composeUpArgs', () => {
  it('translates the Windows path to /mnt and quotes it inside compose up -d', () => {
    expect(composeUpArgs('Ubuntu', 'C:\\proj\\docker-compose.yml')).toEqual([
      '-d', 'Ubuntu', '--', 'bash', '-lc',
      "docker compose -f '/mnt/c/proj/docker-compose.yml' up -d",
    ]);
  });

  it('keeps a path with spaces as a single quoted argument (no shell split)', () => {
    const [, , , , , cmd] = composeUpArgs('Ubuntu', 'C:\\my proj\\compose.yaml');
    expect(cmd).toBe("docker compose -f '/mnt/c/my proj/compose.yaml' up -d");
  });
});

describe('composeTerminalCommand', () => {
  it('opens a persistent cmd window running the WSL compose up', () => {
    expect(composeTerminalCommand('Ubuntu', 'C:\\proj\\docker-compose.yml')).toBe(
      `start "" cmd.exe /k wsl.exe -d "Ubuntu" -- bash -lc "docker compose -f '/mnt/c/proj/docker-compose.yml' up -d"`,
    );
  });
});

describe('listContainersArgs', () => {
  it('builds docker ps with json formatting', () => {
    expect(listContainersArgs('Ubuntu')).toEqual([
      '-d', 'Ubuntu', '--', 'docker', 'ps', '--format', '{{json .}}',
    ]);
  });
});

describe('parseContainers', () => {
  it('parses newline-delimited json into container rows', () => {
    const stdout = [
      '{"ID":"abc","Names":"web","Image":"nginx:alpine","Status":"Up 2 minutes","Ports":"0.0.0.0:8088->80/tcp"}',
      '',
      '{"ID":"def","Names":"db","Image":"postgres:16","Status":"Up 5 minutes","Ports":""}',
    ].join('\n');
    expect(parseContainers(stdout)).toEqual([
      { id: 'abc', names: 'web', image: 'nginx:alpine', status: 'Up 2 minutes', ports: '0.0.0.0:8088->80/tcp' },
      { id: 'def', names: 'db', image: 'postgres:16', status: 'Up 5 minutes', ports: '' },
    ]);
  });

  it('returns an empty array when there are no containers', () => {
    expect(parseContainers('')).toEqual([]);
  });
});

describe('stopContainerArgs', () => {
  it('builds docker stop with the container id as its own argv element', () => {
    expect(stopContainerArgs('Ubuntu', 'a2bfc60d9dcf')).toEqual([
      '-d', 'Ubuntu', '--', 'docker', 'stop', 'a2bfc60d9dcf',
    ]);
  });
});
