import { useEffect, useRef, useState, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebglAddon } from '@xterm/addon-webgl';
import { SearchAddon } from '@xterm/addon-search';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { Unicode11Addon } from '@xterm/addon-unicode11';
import { SerializeAddon } from '@xterm/addon-serialize';
import { LigaturesAddon } from '@xterm/addon-ligatures';
import type { Tab } from '../types/tab';

interface TerminalTabProps {
  tab: Tab;
  isActive: boolean;
  /** Called when the PTY emits output (non-empty data received).
   *  Used by parent to track terminal activity for the busy indicator. */
  onActivity?: (tabId: string) => void;
}

export function TerminalTab({ tab, isActive, onActivity }: TerminalTabProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const webglAddonRef = useRef<WebglAddon | null>(null);
  const searchAddonRef = useRef<SearchAddon | null>(null);
  // Suppress activity callbacks for a window after resize to avoid false positives
  // (ptyResize triggers terminal redraw which produces output unrelated to AI activity)
  const suppressActivityUntilRef = useRef(0);

  // ── Search bar state ──────────────────────────────────
  const [searchVisible, setSearchVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

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
        scrollback: 100000,
        tabStopWidth: 4,
      });

      // ── Addons ──────────────────────────────────────────
      const fitAddon = new FitAddon();
      const webglAddon = new WebglAddon();
      const searchAddon = new SearchAddon();
      const webLinksAddon = new WebLinksAddon();
      const unicode11Addon = new Unicode11Addon();
      const serializeAddon = new SerializeAddon();
      const ligaturesAddon = new LigaturesAddon();

      term.loadAddon(fitAddon);
      fitAddonRef.current = fitAddon;

      // WebGL with DOM fallback — WebGL addon may fail on machines
      // without a GPU or with missing drivers.
      try {
        term.loadAddon(webglAddon);
        webglAddonRef.current = webglAddon;
      } catch (e) {
        console.warn('[TerminalTab] WebGL unavailable, using DOM renderer:', e);
        webglAddon.dispose();
      }

      term.loadAddon(searchAddon);
      searchAddonRef.current = searchAddon;
      term.loadAddon(webLinksAddon);
      term.loadAddon(unicode11Addon);
      term.unicode.activeVersion = '11';
      term.loadAddon(serializeAddon);

      // ── Terminal setup ──────────────────────────────────
      term.open(containerRef.current);
      fitAddon.fit();

      // LigaturesAddon needs the DOM renderer available,
      // so it must be loaded after term.open().
      term.loadAddon(ligaturesAddon);

      // ── Diagnostics ────────────────────────────────────
      if (webglAddonRef.current) {
        console.info('[TerminalTab] Renderer: WebGL (GPU)');
      } else {
        console.info('[TerminalTab] Renderer: DOM (CPU fallback)');
      }

      // Forward user input to PTY
      term.onData((data: string) => {
        window.electronAPI.ptyInput(tab.id, data);
      });

      // Custom key handler:
      // - Ctrl+C with selection → copy (browser default)
      // - Ctrl+Shift+F → show search addon overlay
      term.attachCustomKeyEventHandler((e: KeyboardEvent) => {
        if (e.ctrlKey && e.key === 'c' && term.hasSelection()) {
          return false; // let the browser copy instead of sending Ctrl+C to PTY
        }
        if (e.ctrlKey && e.shiftKey && e.key === 'F') {
          setSearchVisible(true);
          return false;
        }
        return true;
      });

      terminalRef.current = term;

      // ── ResizeObserver ──────────────────────────────────

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
        webglAddonRef.current?.dispose();
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

  // ── Search handlers ───────────────────────────────────

  const doSearch = useCallback((query: string) => {
    setSearchQuery(query);
    searchAddonRef.current?.findNext(query);
  }, []);

  const hideSearch = useCallback(() => {
    setSearchVisible(false);
    setSearchQuery('');
  }, []);

  // Focus the search input when bar appears
  useEffect(() => {
    if (searchVisible && searchInputRef.current) {
      searchInputRef.current.focus();
      searchInputRef.current.select();
    }
  }, [searchVisible]);

  return (
    <div className="absolute inset-0" style={{ opacity: isActive ? 1 : 0, pointerEvents: isActive ? 'auto' : 'none', zIndex: isActive ? 1 : 0 }}>
      {/* Search bar overlay */}
      {searchVisible && (
        <div className="absolute top-0 right-0 z-20 flex items-center gap-1.5 px-3 py-1.5 bg-[#0a0a0a] border-b border-l border-[#1f1a15] rounded-bl shadow-lg shadow-black/60">
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => doSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') { hideSearch(); e.preventDefault(); }
              if (e.key === 'Enter' && !e.shiftKey) { searchAddonRef.current?.findNext(searchQuery); e.preventDefault(); }
              if (e.key === 'Enter' && e.shiftKey) { searchAddonRef.current?.findPrevious(searchQuery); e.preventDefault(); }
            }}
            className="w-48 bg-[#050505] border border-[#1f1a15] rounded px-2 py-0.5 text-xs font-mono text-[#f0ece8] placeholder-[#4a2a1a] outline-none focus:border-[#d4784a]/50"
            placeholder="Find..."
            spellCheck={false}
          />
          <button onClick={() => searchAddonRef.current?.findPrevious(searchQuery)} className="px-1.5 text-xs font-mono text-[#8b5a3c] hover:text-[#d4784a] transition-colors" title="Previous (Shift+Enter)">▲</button>
          <button onClick={() => searchAddonRef.current?.findNext(searchQuery)} className="px-1.5 text-xs font-mono text-[#8b5a3c] hover:text-[#d4784a] transition-colors" title="Next (Enter)">▼</button>
          <button onClick={hideSearch} className="px-1 text-xs font-mono text-[#8b5a3c] hover:text-[#e05555] transition-colors" title="Close (Esc)">✕</button>
        </div>
      )}
      <div ref={containerRef} className="absolute inset-0 border border-[#1f1a15]/40" />
    </div>
  );
}
