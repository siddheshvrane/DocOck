import React from 'react';
import { Plus, MessageSquare, Settings, Sun, Moon } from 'lucide-react';
import { cn } from './MarkdownUtils';

export default function Sidebar({
    isDarkMode,
    toggleTheme,
    activePatient,
    isIntakeMode,
    startNewIntake,
    setActivePatient,
    setIsIntakeMode
}) {
    return (
        <aside className="w-72 bg-claude-sidebar dark:bg-claude-darkSidebar border-r border-claude-border dark:border-claude-darkBorder flex flex-col transition-all duration-500 ease-in-out">
            <div className="p-6 flex items-center justify-between">
                <div className="flex items-center gap-2 cursor-pointer" onClick={() => { setActivePatient(null); setIsIntakeMode(false); }}>
                    <div className="w-8 h-8 bg-claude-accent rounded-lg flex items-center justify-center text-white font-bold shadow-premium">
                        D
                    </div>
                    <h1 className="font-bold text-xl tracking-tight text-claude-text dark:text-claude-darkText">DocOc</h1>
                </div>
                <button
                    onClick={toggleTheme}
                    className="p-2.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition-all text-claude-muted dark:text-claude-darkMuted active:scale-95"
                >
                    {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
                </button>
            </div>

            <div className="px-4 mb-4">
                <button onClick={startNewIntake} className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-white dark:bg-claude-darkSurface border border-claude-border dark:border-claude-darkBorder rounded-2xl shadow-premium hover:translate-y-[-1px] active:translate-y-[1px] transition-all font-semibold text-sm text-claude-text dark:text-claude-darkText group">
                    <Plus size={18} className="text-claude-accent group-hover:rotate-90 transition-transform duration-300" />
                    New Consultation
                </button>
            </div>

            <nav className="flex-1 overflow-y-auto custom-scrollbar px-3 space-y-1">
                <div className="px-4 py-3 text-[11px] font-bold text-claude-muted/60 dark:text-claude-darkMuted/40 uppercase tracking-[0.15em]">System</div>
                <button
                    onClick={() => { setActivePatient(null); setIsIntakeMode(false); }}
                    className={cn(
                        "w-full text-left px-4 py-3.5 rounded-2xl transition-all group flex items-center gap-4",
                        (!activePatient && !isIntakeMode) ? "bg-white dark:bg-claude-darkSurface shadow-premium text-claude-text dark:text-claude-darkText" : "hover:bg-black/5 dark:hover:bg-white/5 text-claude-muted dark:text-claude-darkMuted"
                    )}
                >
                    <MessageSquare size={18} className={(!activePatient && !isIntakeMode) ? "text-claude-accent" : ""} />
                    <span className="text-sm font-semibold">Dashboard</span>
                </button>
            </nav>

            <div className="p-4 border-t border-claude-border dark:border-claude-darkBorder">
                <button className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl hover:bg-black/5 dark:hover:bg-white/5 text-sm font-semibold text-claude-muted dark:text-claude-darkMuted transition-all active:scale-[0.98]">
                    <Settings size={18} /> Settings
                </button>
            </div>
        </aside>
    );
}
