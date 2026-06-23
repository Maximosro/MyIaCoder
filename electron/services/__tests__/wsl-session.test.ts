import { describe, it, expect, vi } from 'vitest';

// wsl-session.ts → settings.ts imports `electron`; stub it so the module loads.
vi.mock('electron', () => ({ app: { getPath: () => '' } }));

import { shQuote, toWslPath } from '../wsl-session';

describe('toWslPath', () => {
  it('converts a Windows drive path to /mnt, lowercasing the drive', () => {
    expect(toWslPath('C:\\ECLIPSE\\MyIaCoder')).toBe('/mnt/c/ECLIPSE/MyIaCoder');
  });
});

describe('shQuote', () => {
  it('wraps plain args in single quotes', () => {
    expect(shQuote('status')).toBe("'status'");
  });

  it('neutralises shell injection in a commit message', () => {
    // A malicious message must stay a single literal argument — the `;` and the
    // `rm -rf` must not be able to break out of the quotes.
    const evil = "msg'; rm -rf ~ #";
    const quoted = shQuote(evil);
    expect(quoted).toBe("'msg'\\''; rm -rf ~ #'");
    // Reconstructed by a POSIX shell, the value is exactly the original string.
    expect(unquote(quoted)).toBe(evil);
  });

  it('handles embedded single quotes', () => {
    expect(unquote(shQuote("a'b'c"))).toBe("a'b'c");
  });
});

/** Minimal POSIX single-quote reader: verifies shQuote round-trips. */
function unquote(s: string): string {
  let out = '';
  let i = 0;
  while (i < s.length) {
    if (s[i] === "'") {
      i++;
      while (i < s.length && s[i] !== "'") out += s[i++];
      i++; // closing quote
    } else if (s[i] === '\\') {
      out += s[i + 1];
      i += 2;
    } else {
      out += s[i++];
    }
  }
  return out;
}
