import { AlertTriangle } from 'lucide-react';

interface CloseTerminalDialogProps {
  open: boolean;
  tabTitle: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function CloseTerminalDialog({ open, tabTitle, onConfirm, onCancel }: CloseTerminalDialogProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={onCancel}
    >
      <div
        className="bg-[#0f0f0f] border border-[#1f1a15] rounded-lg p-6 max-w-sm w-full mx-4 shadow-2xl animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-full bg-[#1a0f0a] flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-4 h-4 text-[#d4a44a]" />
          </div>
          <div>
            <h3 className="text-[#f0ece8] font-mono text-sm">Close Terminal</h3>
            <p className="text-[#8b5a3c] text-[11px] font-mono">{tabTitle}</p>
          </div>
        </div>

        <p className="text-[#b0a89a] text-xs font-mono mb-6 leading-relaxed">
          This terminal tab will be closed and any running processes will be terminated.
        </p>

        {/* Actions */}
        <div className="flex gap-2 justify-end">
          <button
            onClick={onCancel}
            className="px-3 py-1.5 text-xs font-mono rounded border border-[#1f1a15] text-[#8b5a3c] hover:text-[#b0a89a] hover:border-[#3a2f25] transition-all duration-200"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-3 py-1.5 text-xs font-mono rounded bg-[#1a0a0a] text-[#e05555] border border-[#e05555]/20 hover:bg-[#2a0a0a] hover:border-[#e05555]/40 transition-all duration-200"
          >
            Close Terminal
          </button>
        </div>
      </div>
    </div>
  );
}
