import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, FileText } from 'lucide-react';

interface PromptTemplate {
  id: string;
  name: string;
  content: string;
}

interface GuidedPromptModalProps {
  open: boolean;
  onClose: () => void;
  onCreate: (name: string, content: string) => void | Promise<void>;
}

export function GuidedPromptModal({ open, onClose, onCreate }: GuidedPromptModalProps) {
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [selected, setSelected] = useState<string>('');
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const [templatesPath, setTemplatesPath] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setName('');
    setCreating(false);
    window.electronAPI.getSettings().then((s) => setTemplatesPath(s.templatesPath || ''));
    window.electronAPI.readTemplates().then((diskTemplates) => {
      setTemplates(diskTemplates);
      setSelected(diskTemplates[0]?.id ?? '');
    }).catch(() => {
      setTemplates([]);
      setSelected('');
    });
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    if (open) window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  if (!open) return null;

  const template = templates.find((t) => t.id === selected) ?? templates[0];

  const handleCreate = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setCreating(true);
    try {
      await onCreate(trimmed, template.content);
      onClose();
    } finally {
      setCreating(false);
    }
  };

  return createPortal(
    <div
      ref={backdropRef}
      onClick={(e) => { if (e.target === backdropRef.current) onClose(); }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in"
    >
      <div className="bg-[#0a0a0a] border border-[#1f1a15] rounded-lg shadow-2xl w-[480px] max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#1f1a15]">
          <h2 className="text-sm font-mono font-semibold text-[#f0ece8]">Guided Prompt</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-[#1f1a15] text-[#8b5a3c] hover:text-[#d4784a] transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Template list */}
        <div className="px-4 py-3 flex flex-col gap-2 overflow-y-auto">
          <span className="text-[10px] font-mono text-[#8b5a3c] tracking-wider uppercase">Template</span>
          {templates.length === 0 && (
            <div className="py-6 px-2 text-center space-y-3">
              <p className="text-xs font-mono text-[#f0ece8]">
                No templates found
              </p>
              <p className="text-[11px] font-mono text-[#8b5a3c] leading-relaxed">
                Create <span className="text-[#d4784a]">.md</span> files in your templates folder to use them here:
              </p>
              <code className="block text-[10px] font-mono text-[#d4784a] bg-[#050505] border border-[#1f1a15] rounded px-3 py-2 break-all">
                {templatesPath || '(not configured — see Settings)'}
              </code>
              <p className="text-[10px] font-mono text-[#8b5a3c]">
                Each .md becomes a selectable template. Filename = template name.
              </p>
            </div>
          )}
          {templates.map((t) => (
            <button
              key={t.id}
              onClick={() => setSelected(t.id)}
              className={`flex items-start gap-2.5 p-3 rounded border text-left transition-all ${
                selected === t.id
                  ? 'border-[#d4784a] bg-[#d4784a]/10'
                  : 'border-[#1f1a15] hover:border-[#d4784a]/40 bg-transparent'
              }`}
            >
              <FileText className={`w-4 h-4 mt-0.5 flex-shrink-0 ${selected === t.id ? 'text-[#d4784a]' : 'text-[#8b5a3c]'}`} />
              <span className="text-xs font-mono font-medium text-[#f0ece8]">{t.name}</span>
            </button>
          ))}
        </div>

        {/* Name input + Create — only when templates exist */}
        {templates.length > 0 && (
          <div className="px-4 py-3 border-t border-[#1f1a15] flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); }}
              placeholder="nombre-del-prompt.md"
              spellCheck={false}
              className="flex-1 bg-[#050505] border border-[#1f1a15] rounded px-2.5 py-1.5 text-xs font-mono text-[#f0ece8] placeholder-[#4a2a1a] focus:outline-none focus:border-[#d4784a]/50 transition-all"
            />
            <button
              onClick={handleCreate}
              disabled={!name.trim() || creating}
              className="px-3 py-1.5 text-[11px] font-mono font-medium bg-[#d4784a]/15 text-[#d4784a] border border-[#d4784a]/30 rounded hover:bg-[#d4784a]/30 disabled:opacity-30 transition-all"
            >
              {creating ? 'CREATING...' : 'CREATE'}
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
