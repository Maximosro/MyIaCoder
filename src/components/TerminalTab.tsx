import { useEffect, useRef } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import type { TerminalTab } from '../types/terminal';

interface TerminalTabProps {
  tab: TerminalTab;
  isActive: boolean;
}

export function TerminalTabComponent({ tab, isActive }: TerminalTabProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    try {
      const term = new Terminal({
        cursorBlink: true,
        cursorStyle: 'bar',
        fontSize: 14,
        fontFamily: '"Fira Code", "Cascadia Code", Consolas, "Courier New", monospace',
        fontWeight: 'normal',
        theme: {
          // Tango Dark at 70% opacity — matches Windows Terminal bg image opacity 0.3
          background: 'rgba(46, 52, 54, 0.7)',
          foreground: '#D3D7CF',
          cursor: '#FFFFFF',
          selectionBackground: '#555753',
          black: '#2E3436',
          red: '#CC0000',
          green: '#4E9A06',
          yellow: '#C4A000',
          blue: '#3465A4',
          magenta: '#75507B',
          cyan: '#06989A',
          white: '#D3D7CF',
          brightBlack: '#555753',
          brightRed: '#EF2929',
          brightGreen: '#8AE234',
          brightYellow: '#FCE94F',
          brightBlue: '#729FCF',
          brightMagenta: '#AD7FA8',
          brightCyan: '#34E2E2',
          brightWhite: '#EEEEEC',
        },
        allowProposedApi: true,
        allowTransparency: true,
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

  // Refit when tab becomes active (visible)
  useEffect(() => {
    if (isActive && fitAddonRef.current) {
      // Small delay to let the DOM settle
      const timer = setTimeout(() => {
        fitAddonRef.current?.fit();
        const term = terminalRef.current;
        if (term && term.cols > 0 && term.rows > 0) {
          window.electronAPI.ptyResize(tab.id, term.cols, term.rows);
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isActive, tab.id]);

  return (
    <div
      ref={containerRef}
      className="h-full w-full"
      style={{
        display: isActive ? 'block' : 'none',
        backgroundImage: "url('/wallpaper.png')",
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    />
  );
}
