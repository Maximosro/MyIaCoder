import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Editor, loader } from '@monaco-editor/react';
import { Lock, LockOpen, Save, Eye, EyeOff, Sparkles } from 'lucide-react';
import type { Tab, FileType } from '../types/tab';
import { isFileTab } from '../types/tab';
import * as monaco from 'monaco-editor';
import { useDictation } from '../hooks/useDictation';
import { MicButton } from './MicButton';
import { CurateModal } from './CurateModal';

// ── Monaco initialization (synchronous, must run before Editor mounts) ──

loader.config({ monaco });

// ── TOML language registration (Monaco doesn't ship TOML) ──
monaco.languages.register({ id: 'toml' });
monaco.languages.setMonarchTokensProvider('toml', {
  tokenizer: {
    root: [
      [/#.*$/, 'comment'],
      [/"""/, { token: 'string', next: '@mlstring_double' }],
      [/'''/, { token: 'string', next: '@mlstring_single' }],
      [/"([^"\\]|\\.)*"/, 'string'],
      [/'[^']*'/, 'string'],
      [/\b(true|false)\b/, 'keyword'],
      [
        /\b(0[xX][0-9a-fA-F_]+|0[oO][0-7_]+|0[bB][01_]+|\d[\d_]*\.?\d*(?:[eE][+-]?\d+)?)\b/,
        'number',
      ],
      [/\b(inf|nan)\b/, 'number'],
      [/[A-Za-z_][\w-]*/, 'identifier'],
      [/\[\[?[\w.-]+\]\]?/, 'type'],
      [/[{}[\]]/, 'delimiter'],
      [/\./, 'delimiter'],
      [/=/, 'operator'],
    ],
    mlstring_double: [
      [/"""/, { token: 'string', next: '@pop' }],
      [/[^"]+/, 'string'],
      [/"/, 'string'],
    ],
    mlstring_single: [
      [/'''/, { token: 'string', next: '@pop' }],
      [/[^']+/, 'string'],
      [/'/, 'string'],
    ],
  },
});

// ── Helpers ────────────────────────────────────────────────────

function mapFileTypeToLanguage(fileType: FileType): string {
  switch (fileType) {
    case 'text':
      return 'plaintext';
    case 'json':
      return 'json';
    case 'markdown':
      return 'markdown';
    case 'yaml':
      return 'yaml';
    case 'toml':
      return 'toml';
    case 'xml':
      return 'xml';
    case 'properties':
      // ponytail: ini is closest Monaco built-in for key=value + # comments
      return 'ini';
  }
}

function getFileTypeBadge(fileType: FileType): { label: string; className: string } {
  switch (fileType) {
    case 'text':
      return { label: 'TXT', className: 'bg-[#0a1a0e] text-[#6ba86b] border-[#6ba86b]/30' };
    case 'json':
      return { label: 'JSON', className: 'bg-[#0a1520] text-[#7b9ec4] border-[#7b9ec4]/30' };
    case 'markdown':
      return { label: 'MD', className: 'bg-[#1a0f0a] text-[#d4784a] border-[#d4784a]/30' };
    case 'yaml':
      return { label: 'YAML', className: 'bg-[#1a140a] text-[#d4a44a] border-[#d4a44a]/30' };
    case 'toml':
      return { label: 'TOML', className: 'bg-[#0a1515] text-[#4ab8b8] border-[#4ab8b8]/30' };
    case 'xml':
      return { label: 'XML', className: 'bg-[#150a12] text-[#c47ba0] border-[#c47ba0]/30' };
    case 'properties':
      return { label: 'PROP', className: 'bg-[#12100a] text-[#a89060] border-[#a89060]/30' };
  }
}

// ── Component ──────────────────────────────────────────────────

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function renderMermaidFallback(code: string, reason: string): string {
  return `<pre class="bg-[#1a0a0a] border border-[#e05555]/30 rounded p-3 my-3 overflow-x-auto"><div class="text-[10px] font-mono text-[#e05555] mb-1">${escapeHtml(reason)}</div><code class="text-xs text-[#b0a89a] font-mono">${escapeHtml(code)}</code></pre>`;
}

interface FileEditorProps {
  tab: Tab;
  initialContent: string;
  onSave: (content: string) => Promise<void>;
  onDirtyChange: (isDirty: boolean) => void;
  onContentChange?: (content: string) => void;
}

type FileTab = Tab & { kind: 'file'; filePath: string; fileType: FileType };

interface FileEditorContentProps {
  tab: FileTab;
  initialContent: string;
  onSave: (content: string) => Promise<void>;
  onDirtyChange: (isDirty: boolean) => void;
  onContentChange?: (content: string) => void;
}

// Guard kept outside the component with hooks so hooks always run unconditionally (Rules of Hooks).
export function FileEditor({ tab, initialContent, onSave, onDirtyChange, onContentChange }: FileEditorProps) {
  if (!isFileTab(tab)) return null;
  return (
    <FileEditorContent tab={tab} initialContent={initialContent} onSave={onSave} onDirtyChange={onDirtyChange} onContentChange={onContentChange} />
  );
}

function FileEditorContent({ tab, initialContent, onSave, onDirtyChange, onContentChange }: FileEditorContentProps) {
  const [readOnly, setReadOnly] = useState(true);
  const [content, setContent] = useState(initialContent);
  const [isDirty, setIsDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);

  // ── Voice dictation (Flujo 1) ──
  const { isListening, isSupported, interimText, finalText, error: voiceError, startListening, stopListening } = useDictation();
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const insertedRef = useRef('');
  const ghostRef = useRef<monaco.editor.IEditorDecorationsCollection | null>(null);
  const toggleDictation = useCallback(() => {
    if (isListening) stopListening();
    else startListening();
  }, [isListening, startListening, stopListening]);

  // ── AI curator (Flujo 2) ──
  const [hasGroqKey, setHasGroqKey] = useState(false);
  const [curateOpen, setCurateOpen] = useState(false);
  const [curateLoading, setCurateLoading] = useState(false);
  const [curatedText, setCuratedText] = useState('');
  const [curateError, setCurateError] = useState<string | null>(null);

  useEffect(() => {
    window.electronAPI.getSettings().then((s) => setHasGroqKey(!!s.groqApiKey?.trim()));
  }, [curateOpen]);

  const runCurate = useCallback(async () => {
    setCurateOpen(true);
    setCurateLoading(true);
    setCurateError(null);
    setCuratedText('');
    const res = await window.electronAPI.curate(content);
    if (res.ok) setCuratedText(res.text);
    else setCurateError(res.error);
    setCurateLoading(false);
  }, [content]);

  const applyCurate = useCallback(() => {
    const editor = editorRef.current;
    if (editor && curatedText) {
      const model = editor.getModel();
      if (model) {
        editor.executeEdits('curate', [{ range: model.getFullModelRange(), text: curatedText }]);
      }
    }
    setCurateOpen(false);
  }, [curatedText]);

  // Reset state when tab changes
  useEffect(() => {
    setContent(initialContent);
    setIsDirty(false);
    // ponytail: prompt files open editable; else read-only by default
    setReadOnly(!tab.unlocked);
    setPreviewMode(false);
  }, [initialContent, tab.id]);

  const handleChange = useCallback((value: string | undefined) => {
    const newValue = value ?? '';
    setContent(newValue);
    onContentChange?.(newValue);
    if (!isDirty) {
      setIsDirty(true);
      onDirtyChange(true);
    }
  }, [isDirty, onDirtyChange, onContentChange]);

  const handleSave = useCallback(async () => {
    if (!isDirty || saving) return;
    setSaving(true);
    try {
      await onSave(content);
      setIsDirty(false);
      onDirtyChange(false);
    } finally {
      setSaving(false);
    }
  }, [content, isDirty, saving, onSave, onDirtyChange]);

  const toggleReadOnly = useCallback(() => {
    setReadOnly((prev) => !prev);
  }, []);

  // Editor keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && !e.altKey && key === 's') {
        e.preventDefault();
        if (!readOnly && isDirty) {
          handleSave();
        }
      } else if ((e.ctrlKey || e.metaKey) && !e.altKey && key === 'e') {
        e.preventDefault();
        toggleReadOnly();
      } else if ((e.ctrlKey || e.metaKey) && !e.altKey && key === 'm' && tab.fileType === 'markdown') {
        e.preventDefault();
        setPreviewMode((p) => !p);
      } else if ((e.ctrlKey || e.metaKey) && e.shiftKey && !e.altKey && key === 'v') {
        e.preventDefault();
        toggleDictation();
      }
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [readOnly, isDirty, handleSave, toggleReadOnly, tab.fileType, toggleDictation]);

  // Insert each newly-recognized dictation chunk (the delta of finalText) at the
  // cursor. Monaco fires onChange for these edits, so dirty/content track automatically.
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || finalText === insertedRef.current) return;
    const delta = finalText.slice(insertedRef.current.length);
    insertedRef.current = finalText;
    if (!delta) return;
    const pos = editor.getPosition();
    if (!pos) return;
    editor.executeEdits('voice', [
      { range: new monaco.Range(pos.lineNumber, pos.column, pos.lineNumber, pos.column), text: delta, forceMoveMarkers: true },
    ]);
  }, [finalText]);

  // Ghost "…" hint at the cursor while a chunk is being transcribed.
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    if (!interimText) {
      ghostRef.current?.clear();
      return;
    }
    const pos = editor.getPosition();
    if (!pos) return;
    const deco: monaco.editor.IModelDeltaDecoration = {
      range: new monaco.Range(pos.lineNumber, pos.column, pos.lineNumber, pos.column),
      options: { after: { content: ` ${interimText}`, inlineClassName: 'voice-ghost' } },
    };
    if (!ghostRef.current) ghostRef.current = editor.createDecorationsCollection([deco]);
    else ghostRef.current.set([deco]);
  }, [interimText]);

  const badge = getFileTypeBadge(tab.fileType);
  const language = mapFileTypeToLanguage(tab.fileType);
  const [previewHtml, setPreviewHtml] = useState('');
  const markedRef = useRef<typeof import('marked') | null>(null);

  // Lazy-load marked + mermaid only when entering preview mode
  useEffect(() => {
    if (!previewMode || tab.fileType !== 'markdown') return;
    let cancelled = false;
    (async () => {
      try {
        if (!markedRef.current) {
          markedRef.current = await import('marked');
        }

        // 1. Extract mermaid blocks from raw markdown BEFORE parsing
        const mermaidBlockRegex = /```mermaid\s*\r?\n([\s\S]*?)```/g;
        const mermaidBlocks: { full: string; code: string }[] = [];
        let match: RegExpExecArray | null;
        while ((match = mermaidBlockRegex.exec(content)) !== null) {
          mermaidBlocks.push({ full: match[0], code: match[1].trim() });
        }

        // 2. Replace mermaid blocks with HTML div placeholders in markdown
        //    marked passes raw HTML through, so these survive parsing
        const placeholders: string[] = [];
        let md = content;
        for (let i = 0; i < mermaidBlocks.length; i++) {
          const ph = `<div data-mermaid-idx="${i}"></div>`;
          placeholders.push(ph);
          md = md.replace(mermaidBlocks[i].full, ph);
        }

        // 3. Render non-mermaid markdown to HTML
        let html = markedRef.current.marked.parse(md) as string;

        // 4. Render mermaid diagrams and inject into HTML
        if (mermaidBlocks.length > 0) {
          let mermaid: typeof import('mermaid') | null = null;
          try {
            mermaid = await import('mermaid');
            mermaid.default.initialize({
              startOnLoad: false,
              theme: 'dark',
              themeCSS: `
                .node rect, .node circle, .node polygon, .node .label-container { fill: #0a0a0a !important; stroke: #d4784a !important; }
                .edgePath .path { stroke: #8b5a3c !important; }
                .edgeLabel rect { fill: #0a0a0a !important; }
                .label, .edgeLabel span { color: #b0a89a !important; font-family: monospace !important; }
                .cluster rect { fill: #0a0a0a !important; stroke: #1f1a15 !important; }
                .cluster text { fill: #d4784a !important; }
                .titleText { fill: #f0ece8 !important; }
                marker { fill: #8b5a3c !important; stroke: #8b5a3c !important; }
              `,
            });
          } catch {
            // mermaid failed to load — show placeholder error
          }

          let counter = 0;
          for (let i = 0; i < mermaidBlocks.length; i++) {
            const ph = placeholders[i];
            if (!mermaid) {
              html = html.replace(ph, renderMermaidFallback(mermaidBlocks[i].code, 'Mermaid library failed to load'));
              continue;
            }
            try {
              const { svg } = await mermaid.default.render(`mermaid-pv-${counter++}`, mermaidBlocks[i].code);
              html = html.replace(ph, `<div class="mermaid-diagram flex justify-center my-4">${svg}</div>`);
            } catch {
              html = html.replace(ph, renderMermaidFallback(mermaidBlocks[i].code, 'Invalid diagram syntax'));
            }
          }
        }

        if (!cancelled) setPreviewHtml(html);
      } catch {
        if (!cancelled) setPreviewHtml('<p class="text-[#e05555]">Preview failed to load</p>');
      }
    })();
    return () => { cancelled = true; };
  }, [previewMode, content, tab.fileType]);

  return (
    <div className="flex flex-col h-full bg-[#050505]">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-1.5 bg-[#0a0a0a] border-b border-[#1f1a15] flex-shrink-0">
        {/* File type badge */}
        <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${badge.className}`}>
          {badge.label}
        </span>

        {/* File name */}
        <span className="text-xs font-mono text-[#b0a89a] truncate flex-1">
          {tab.title}
        </span>

        {/* Preview toggle — only for markdown files */}
        {tab.fileType === 'markdown' && (
          <button
            onClick={() => setPreviewMode((p) => !p)}
            className={`p-1 rounded transition-all duration-200 ${
              previewMode
                ? 'text-[#d4784a] hover:text-[#e8956a] bg-[#1f1a15]/50'
                : 'text-[#8b5a3c] hover:text-[#d4784a] hover:bg-[#0f0f0f]'
            }`}
            title={previewMode ? 'Show source (Ctrl+M)' : 'Preview (Ctrl+M)'}
          >
            {previewMode ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          </button>
        )}

        {/* AI curator — only when a Groq key is configured */}
        {hasGroqKey && (
          <button
            onClick={runCurate}
            disabled={!content.trim() || curateLoading}
            className="p-1 rounded transition-all duration-200 text-[#8b5a3c] hover:text-[#d4784a] hover:bg-[#0f0f0f] disabled:opacity-40 disabled:cursor-not-allowed"
            title="Curar dictado con IA (✨)"
          >
            <Sparkles className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Voice dictation toggle */}
        <MicButton
          isListening={isListening}
          isSupported={isSupported}
          error={voiceError}
          onToggle={toggleDictation}
        />

        {/* Read-only toggle */}
        <button
          onClick={toggleReadOnly}
          className={`p-1 rounded transition-all duration-200 ${
            readOnly
              ? 'text-[#8b5a3c] hover:text-[#d4784a] hover:bg-[#0f0f0f]'
              : 'text-[#d4a44a] hover:text-[#e8c06a] bg-[#1f1a15]/50'
          }`}
          title={readOnly ? 'Enable editing (Ctrl+E)' : 'Disable editing (Ctrl+E)'}
        >
          {readOnly ? <Lock className="w-3.5 h-3.5" /> : <LockOpen className="w-3.5 h-3.5" />}
        </button>

        {/* Save button — only visible when not read-only and dirty */}
        {!readOnly && isDirty && (
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1 px-2 py-1 text-xs font-mono rounded bg-[#d4784a] text-white hover:bg-[#e8956a] transition-all duration-200 disabled:opacity-50"
            title="Save (Ctrl+S)"
          >
            <Save className="w-3 h-3" />
            {saving ? '...' : 'Save'}
          </button>
        )}
      </div>

      {/* Content area */}
      <div className="flex-1 min-h-0">
        {previewMode && tab.fileType === 'markdown' ? (
          <div
            className="h-full overflow-y-auto px-8 py-6 markdown-preview"
            dangerouslySetInnerHTML={{ __html: previewHtml }}
          />
        ) : (
          <Editor
          height="100%"
          language={language}
          theme="copper-dark"
          value={content}
          onChange={handleChange}
          beforeMount={(monaco) => {
            monaco.editor.defineTheme('copper-dark', {
              base: 'vs-dark',
              inherit: true,
              rules: [
                { token: 'comment', foreground: '6a5c4c', fontStyle: 'italic' },
                { token: 'keyword', foreground: 'd4784a' },
                { token: 'string', foreground: '6ba86b' },
                { token: 'number', foreground: '7b9ec4' },
                { token: 'type', foreground: 'd4a44a' },
              ],
              colors: {
                'editor.background': '#050505',
                'editor.foreground': '#f0ece8',
                'editorCursor.foreground': '#d4784a',
                'editor.selectionBackground': 'rgba(212, 120, 74, 0.25)',
                'editor.lineHighlightBackground': '#0a0a0a',
                'editorLineNumber.foreground': '#3a2f25',
                'editorLineNumber.activeForeground': '#8b5a3c',
                'editor.inactiveSelectionBackground': 'rgba(212, 120, 74, 0.12)',
                'editorWidget.background': '#0a0a0a',
                'editorWidget.border': '#1f1a15',
                'input.background': '#0f0f0f',
                'input.border': '#1f1a15',
              },
            });
          }}
          onMount={(editor, monaco) => {
            editorRef.current = editor;
            // ponytail: disable Monaco's command palette shortcuts; app owns shortcuts.
            editor.addCommand(monaco.KeyCode.F1, () => null);
            editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyP, () => null);
          }}
          loading={
            <div className="flex items-center justify-center h-full bg-[#050505]">
              <span className="text-xs font-mono text-[#8b5a3c] animate-pulse">LOADING_</span>
            </div>
          }
          options={{
            readOnly,
            minimap: { enabled: false },
            fontSize: 14,
            fontFamily: '"Fira Code", "Cascadia Code", "JetBrains Mono", Consolas, monospace',
            lineNumbers: 'on',
            renderWhitespace: 'selection',
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 2,
            wordWrap: 'on',
            padding: { top: 8, bottom: 8 },
          }}
        />
        )}
      </div>

      <CurateModal
        open={curateOpen}
        original={content}
        curated={curatedText}
        loading={curateLoading}
        error={curateError}
        onApply={applyCurate}
        onClose={() => setCurateOpen(false)}
      />
    </div>
  );
}
