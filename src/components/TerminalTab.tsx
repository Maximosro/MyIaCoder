import { useEffect, useRef } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import type { TerminalTab } from '../types/terminal';

interface TerminalTabProps {
  tab: TerminalTab;
  isActive: boolean;
  /** Called when the PTY emits output (non-empty data received from polling).
   *  Used by parent to track terminal activity for the busy indicator. */
  onActivity?: (tabId: string) => void;
}

export function TerminalTabComponent({ tab, isActive, onActivity }: TerminalTabProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  // Suppress activity callbacks for a window after resize to avoid false positives
  // (ptyResize triggers terminal redraw which produces output unrelated to AI activity)
  const suppressActivityUntilRef = useRef(0);

  useEffect(() => {
    if (!containerRef.current) return;

    try {
      const term = new Terminal({
        cursorBlink: true,
        cursorStyle: 'bar',
        fontSize: 16,
        fontFamily: '"Fira Code", "Cascadia Code", "JetBrains Mono", Consolas, monospace',
        fontWeight: 'normal',
        theme: {
          // Copper / Hero-Centric — solid, crisp, matches app chrome
          background: '#050505',
          foreground: '#f0ece8',
          cursor: '#d4784a',
          selectionBackground: 'rgba(212, 120, 74, 0.25)',
          black: '#0a0a0a',
          red: '#e05555',
          green: '#6ba86b',
          yellow: '#d4a44a',
          blue: '#7b9ec4',
          magenta: '#9b7bc4',
          cyan: '#5ba89c',
          white: '#f0ece8',
          brightBlack: '#1f1a15',
          brightRed: '#ff6b6b',
          brightGreen: '#8acc8a',
          brightYellow: '#e8c06a',
          brightBlue: '#9bbce0',
          brightMagenta: '#b89bde',
          brightCyan: '#7ac4bc',
          brightWhite: '#ffffff',
        },
        allowProposedApi: true,
        allowTransparency: false,
        windowsMode: true,
        scrollback: 5000,
        tabStopWidth: 4,
      });

      // Addons (WebglAddon removed — deprecated and crashes with StrictMode double-mount)
      const fitAddon = new FitAddon();
      term.loadAddon(fitAddon);
      fitAddonRef.current = fitAddon;

      term.open(containerRef.current);
      fitAddon.fit();

      // Forward user input to PTY
      term.onData((data: string) => {
        window.electronAPI.ptyInput(tab.id, data);
      });

      // Allow copy via Ctrl+C when there's a selection
      term.attachCustomKeyEventHandler((e: KeyboardEvent) => {
        if (e.ctrlKey && e.key === 'c' && term.hasSelection()) {
          return false;
        }
        return true;
      });

      terminalRef.current = term;
      console.log(`[TerminalTab] Terminal created for tab=${tab.id} cols=${term.cols} rows=${term.rows}`);

      // ResizeObserver
      const observer = new ResizeObserver(() => {
        fitAddon.fit();
        if (term.cols > 0 && term.rows > 0) {
          suppressActivityUntilRef.current = Date.now() + 500;
          window.electronAPI.ptyResize(tab.id, term.cols, term.rows);
        }
      });
      observer.observe(containerRef.current);

      return () => {
        observer.disconnect();
        term.dispose();
      };
    } catch (err) {
      console.error('[TerminalTab] Failed to create Terminal:', err);
    }
  }, [tab.id]);

  // Poll PTY output (sandbox-compatible, no webContents.send needed)
  useEffect(() => {
    const term = terminalRef.current;
    if (!term) return;

    let alive = true;
    const POLL_MS = 50;

    const poll = async () => {
      if (!alive) return;
      try {
        const data = await window.electronAPI.ptyRead(tab.id);
        if (data && alive) {
          term.write(data);
          if (Date.now() > suppressActivityUntilRef.current) {
            onActivity?.(tab.id);
          }
        }
      } catch {
        // tab might have been killed
      }
      if (alive) {
        timer = setTimeout(poll, POLL_MS);
      }
    };

    let timer = setTimeout(poll, POLL_MS);

    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [tab.id]);

  // Refit when tab becomes active — use double-refit for reliability
  useEffect(() => {
    if (isActive && fitAddonRef.current) {
      const timer = setTimeout(() => {
        fitAddonRef.current?.fit();
        const term = terminalRef.current;
        if (term && term.cols > 0 && term.rows > 0) {
          suppressActivityUntilRef.current = Date.now() + 500;
          window.electronAPI.ptyResize(tab.id, term.cols, term.rows);
        }
        // Second refit to catch any layout settling
        setTimeout(() => {
          fitAddonRef.current?.fit();
          if (term && term.cols > 0 && term.rows > 0) {
            suppressActivityUntilRef.current = Date.now() + 500;
            window.electronAPI.ptyResize(tab.id, term.cols, term.rows);
          }
        }, 100);
      }, 80);
      return () => clearTimeout(timer);
    }
  }, [isActive, tab.id]);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 border border-[#1f1a15]/40"
      style={{
        opacity: isActive ? 1 : 0,
        pointerEvents: isActive ? 'auto' : 'none',
        zIndex: isActive ? 1 : 0,
      }}
    />
  );
}
