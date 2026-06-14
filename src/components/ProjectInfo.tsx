import type { Project } from '../types/project';

interface ProjectInfoProps {
  project: Project | null;
}

export function ProjectInfo({ project }: ProjectInfoProps) {
  if (!project) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-gray-600">
        <svg className="w-12 h-12 mb-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
        </svg>
        <p className="text-lg">Select a project from the sidebar to start</p>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <h2 className="text-xl font-semibold text-gray-100">{project.name}</h2>
      <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-gray-400">
        <span className="truncate max-w-[400px]" title={project.path}>Path: {project.path}</span>
        <span className={`px-2 py-0.5 rounded text-xs border ${
          project.branch === 'main' || project.branch === 'master'
            ? 'bg-blue-900/50 text-blue-300 border-blue-700'
            : project.branch === 'develop'
              ? 'bg-green-900/50 text-green-300 border-green-700'
              : 'bg-gray-700/50 text-gray-300 border-gray-600'
        }`}>
          {project.branch}
        </span>
      </div>
    </div>
  );
}
