import { useEffect, useState, useRef } from 'react';
import { DiffEditor, loader } from '@monaco-editor/react';
import { GitCompare, RefreshCw } from 'lucide-react';
import * as monaco from 'monaco-editor';

loader.config({ monaco });

interface DiffViewerProps {
  fileName: string;
  projectPath: string;
  filePath: string;
}

/**
 * Side-by-side diff viewer using Monaco's DiffEditor.
 * Fetches original (HEAD) and modified (working tree) versions via IPC
 * and renders them with proper green/red highlighting.
 */
export function DiffViewer({ fileName, projectPath, filePath }: DiffViewerProps) {
  const [original, setOriginal] = useState<string>('');
  const [modified, setModified] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const versions = await window.electronAPI.getGitFileVersions(projectPath, filePath);
        if (cancelled) return;
        setOriginal(versions.original ?? '');
        setModified(versions.modified ?? '');
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load diff');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [projectPath, filePath]);

  if (loading) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3">
        <RefreshCw className="w-6 h-6 text-[#d4784a] animate-spin" />
        <p className="text-[11px] font-mono text-[#8b5a3c] tracking-widest">
          LOADING_DIFF<span className="animate-cursor-blink">_</span>
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 p-8">
        <GitCompare className="w-10 h-10 text-[#e05555]/40" />
        <p className="text-xs font-mono text-[#e05555] text-center">{error}</p>
      </div>
    );
  }

  // Detect file language from extension
  const getLanguage = (name: string): string => {
    const ext = name.slice(name.lastIndexOf('.')).toLowerCase();
    switch (ext) {
      case '.ts': case '.tsx': return 'typescript';
      case '.js': case '.jsx': return 'javascript';
      case '.json': return 'json';
      case '.md': case '.markdown': return 'markdown';
      case '.css': return 'css';
      case '.html': return 'html';
      case '.py': return 'python';
      case '.java': return 'java';
      case '.yml': case '.yaml': return 'yaml';
      case '.xml': return 'xml';
      case '.sh': case '.bash': return 'shell';
      case '.ps1': return 'powershell';
      case '.sql': return 'sql';
      case '.dockerfile': return 'dockerfile';
      default: return 'plaintext';
    }
  };

  const language = getLanguage(fileName);

  return (
    <div ref={containerRef} className="h-full w-full">
      <DiffEditor
        height="100%"
        language={language}
        original={original}
        modified={modified}
        theme="vs-dark"
        options={{
          readOnly: true,
          renderSideBySide: true,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          fontSize: 13,
          fontFamily: '"Fira Code", "Cascadia Code", "JetBrains Mono", Consolas, monospace',
          lineNumbers: 'on',
          folding: true,
          wordWrap: 'on',
          automaticLayout: true,
          originalEditable: false,
          // Copper-tinted diff colors
          renderIndicators: true,
          diffWordWrap: 'on',
        }}
        loading={
          <div className="h-full flex items-center justify-center">
            <RefreshCw className="w-6 h-6 text-[#d4784a] animate-spin" />
          </div>
        }
      />
    </div>
  );
}
