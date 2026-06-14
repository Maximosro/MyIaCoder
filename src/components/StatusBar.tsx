import { useEffect, useState } from 'react';

interface StatusBarProps {
  projectCount: number;
  workspacePath: string;
}

export function StatusBar({ projectCount, workspacePath }: StatusBarProps) {
  const [time, setTime] = useState(new Date().toLocaleTimeString());

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date().toLocaleTimeString());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="h-6 bg-gray-900 border-t border-gray-800 text-[11px] text-gray-500 flex items-center px-3 gap-4 flex-shrink-0 select-none">
      <span>{projectCount} project{projectCount !== 1 ? 's' : ''}</span>
      <span className="truncate max-w-[300px]" title={workspacePath}>{workspacePath}</span>
      <span className="ml-auto">{time}</span>
    </div>
  );
}
