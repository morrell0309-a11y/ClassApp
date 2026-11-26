import { Upload } from 'lucide-react';
import { AppTab } from '../types/classroom';

interface HeaderProps {
  activeTab: AppTab;
  onTabChange: (tab: AppTab) => void;
  onQuickImport: () => void;
}

export function Header({ activeTab, onTabChange, onQuickImport }: HeaderProps) {
  const navItems: { id: AppTab; label: string }[] = [
    { id: 'picker', label: '隨機點名' },
    { id: 'grouping', label: '自動分組' },
    { id: 'roster', label: '名單管理' },
  ];

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-slate-200">
      <div className="max-w-[1320px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4 sm:gap-8">
        {/* Zone 1: Single text wordmark */}
        <button
          type="button"
          onClick={() => onTabChange('picker')}
          className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded-md px-1 -ml-1"
        >
          課堂點名與分組台
        </button>

        {/* Zone 2: Clean single-line navigation links */}
        <nav aria-label="主要功能導覽" className="flex items-center gap-4 sm:gap-7">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onTabChange(item.id)}
                aria-current={isActive ? 'page' : undefined}
                className={`relative py-2 text-sm font-medium whitespace-nowrap shrink-0 transition-colors duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded ${
                  isActive
                    ? 'text-blue-700 font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {item.label}
                {isActive && (
                  <span
                    aria-hidden="true"
                    className="absolute left-0 right-0 -bottom-[17px] h-0.5 bg-blue-600 rounded-full"
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Single primary action */}
        <div className="shrink-0">
          <button
            type="button"
            onClick={onQuickImport}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-lg transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
          >
            <Upload className="w-4 h-4" aria-hidden="true" />
            <span>匯入名單</span>
          </button>
        </div>
      </div>
    </header>
  );
}
