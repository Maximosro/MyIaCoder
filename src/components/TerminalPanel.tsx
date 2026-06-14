import { TerminalTabComponent } from './TerminalTab';
import type { TerminalTab } from '../types/terminal';
import type { Project } from '../types/project';

interface TerminalPanelProps {
  tabs: TerminalTab[];
  activeTabId: string | null;
  activeProject: Project | null;
  onOpenTab: (project: Project) => void;
  onCloseTab: (tabId: string) => void;
  onSelectTab: (tabId: string) => void;
}

export function TerminalPanel({
  tabs,
  activeTabId,
  activeProject,
  onOpenTab,
  onCloseTab,
  onSelectTab,
}: TerminalPanelProps) {
  return (
    <div className="flex-1 flex flex-col min-h-0 bg-transparent">
      {/* Tab bar */}
      {tabs.length > 0 && (
        <div className="flex items-center gap-0.5 px-2 py-1 bg-gray-900 border-b border-gray-800 overflow-x-auto">
          {tabs.map((tab) => (
            <div
              key={tab.id}
              onClick={() => onSelectTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-t cursor-pointer text-xs transition-colors flex-shrink-0 max-w-[180px]
                ${tab.id === activeTabId
                  ? 'bg-[#0a0a0a] text-gray-200'
                  : 'bg-gray-800 text-gray-500 hover:text-gray-300 hover:bg-gray-700'
                }`}
            >
              <span className="truncate">{tab.projectName}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onCloseTab(tab.id);
                }}
                className="ml-1 p-0.5 rounded hover:bg-gray-600/50 text-gray-500 hover:text-gray-300 flex-shrink-0"
                title="Close tab"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Terminal area */}
      <div className="flex-1 relative">
        {tabs.map((tab) => (
          <TerminalTabComponent
            key={tab.id}
            tab={tab}
            isActive={tab.id === activeTabId}
          />
        ))}

        {tabs.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            {activeProject ? (
              <button
                onClick={() => onOpenTab(activeProject)}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-lg font-medium text-sm transition-colors"
              >
                Launch Claude Code
              </button>
            ) : (
              <p className="text-gray-700 text-sm">Terminal will appear here</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
