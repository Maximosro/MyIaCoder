import { useState, useEffect } from 'react';
import { Minus, Square, X, Settings, Info } from 'lucide-react';

export function TitleBar({ onConfig, onAbout }: { onConfig: () => void; onAbout: () => void }) {
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    // Initial state
    window.electronAPI.windowIsMaximized().then(setIsMaximized);

    // Listen for maximize/unmaximize events from main process
    const unsubscribe = window.electronAPI.onMaximizedChanged((maximized) => {
      setIsMaximized(maximized);
    });

    return unsubscribe;
  }, []);

  const handleMinimize = () => window.electronAPI.windowMinimize();
  const handleMaximize = () => window.electronAPI.windowMaximize();
  const handleClose = () => window.electronAPI.windowClose();

  return (
    <div
      className="titlebar flex items-center justify-between h-9 bg-[#050505] border-b border-[#1f1a15] select-none"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      {/* App logo + title */}
      <div className="flex items-center gap-2.5 pl-3">
        <img src="./logo.svg" alt="Focusxide" className="w-5 h-5 opacity-90" />
        <span className="text-[10px] tracking-[0.2em] uppercase text-[#d4784a]/70 font-medium">
          Focusxide Code Manager
        </span>
      </div>

      {/* Center spacer + config */}
      <div className="flex-1" />
      {/* About */}
      <button
        onClick={onAbout}
        className="titlebar-btn w-9 h-full flex items-center justify-center text-[#f0ece8]/40 hover:text-[#d4784a] hover:bg-[#1a1a1a] transition-colors"
        aria-label="About"
        title="About Focusxide"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        <Info size={14} strokeWidth={1.5} />
      </button>

      <span className="w-px h-4 bg-[#1f1a15] mx-1" />

      <button
        onClick={onConfig}
        className="titlebar-btn w-9 h-full flex items-center justify-center text-[#f0ece8]/40 hover:text-[#d4784a] hover:bg-[#1a1a1a] transition-colors"
        aria-label="Configuración"
        title="Configuración"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        <Settings size={14} strokeWidth={1.5} />
      </button>

      <span className="w-px h-4 bg-[#1f1a15] mx-1" />

      {/* Window controls — Windows-style */}
      <div
        className="flex h-full"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        <button
          onClick={handleMinimize}
          className="titlebar-btn w-11 h-full flex items-center justify-center text-[#f0ece8]/50 hover:text-[#f0ece8] hover:bg-[#1a1a1a] transition-colors"
          aria-label="Minimizar"
        >
          <Minus size={14} strokeWidth={1.5} />
        </button>
        <button
          onClick={handleMaximize}
          className="titlebar-btn w-11 h-full flex items-center justify-center text-[#f0ece8]/50 hover:text-[#f0ece8] hover:bg-[#1a1a1a] transition-colors"
          aria-label={isMaximized ? 'Restaurar' : 'Maximizar'}
        >
          <Square size={12} strokeWidth={1.5} />
        </button>
        <button
          onClick={handleClose}
          className="titlebar-btn titlebar-close w-11 h-full flex items-center justify-center text-[#f0ece8]/50 hover:text-white hover:bg-[#e05555] transition-colors"
          aria-label="Cerrar"
        >
          <X size={16} strokeWidth={1.5} />
        </button>
      </div>
    </div>
  );
}
