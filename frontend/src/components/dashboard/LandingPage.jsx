import React from 'react';
import { Plus, Search, ChevronRight, MessageSquare } from 'lucide-react';
import PixelMascot from '../PixelMascot';

export default function LandingPage({
    greeting,
    patients,
    startNewIntake,
    handlePatientSelect
}) {
    return (
        <div className="flex-1 flex flex-row p-12 overflow-hidden relative max-w-7xl mx-auto w-full gap-10">
            {/* Mascot on the Left */}
            <div className="hidden lg:flex flex-col items-center justify-center flex-1 animate-in fade-in slide-in-from-left-8 duration-1000">
                <div className="relative w-72 h-72 flex items-center justify-center">
                    <PixelMascot className="w-64 h-64 scale-110" />
                </div>
                {/* Dynamic LLM Greeting */}
                <div className="mt-8 text-center animate-in fade-in slide-in-from-bottom-4 duration-1000 delay-500">
                    <p className="text-xl font-serif text-claude-text dark:text-claude-darkText tracking-tight leading-relaxed max-w-sm italic opacity-80">
                        "{greeting}"
                    </p>
                </div>
            </div>

            {/* Recent Chats on the Right */}
            <div className="flex-[2.5] flex flex-col h-full justify-center space-y-8 animate-in fade-in slide-in-from-right-8 duration-1000">
                <div className="flex items-center justify-between mb-2">
                    <h1 className="text-4xl font-serif font-medium text-claude-text dark:text-claude-darkText">Recent Chats</h1>
                    <button onClick={startNewIntake} className="flex items-center gap-2 py-2 px-4 bg-white dark:bg-claude-darkSurface border border-claude-border dark:border-claude-darkBorder rounded-xl shadow-premium hover:shadow-lg transition-all font-semibold text-sm">
                        <Plus size={16} /> New chat
                    </button>
                </div>

                {/* Search Bar */}
                <div className="relative group">
                    <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                        <Search size={18} className="text-claude-muted group-focus-within:text-claude-accent transition-colors" />
                    </div>
                    <input
                        type="text"
                        placeholder="Search your chats..."
                        className="w-full bg-white dark:bg-claude-darkSurface border-2 border-claude-border dark:border-claude-darkBorder rounded-xl py-4 pl-12 pr-4 focus:outline-none focus:border-claude-accent/40 shadow-premium transition-all text-base"
                    />
                </div>

                <p className="text-xs font-semibold text-claude-muted dark:text-claude-darkMuted uppercase tracking-widest pl-1">Recent Consultations</p>

                {/* Chat List with Fading effect */}
                <div className="relative flex-1 max-h-[500px]">
                    <div className="mt-2 h-full overflow-y-auto custom-scrollbar space-y-1 pb-20 mask-gradient">
                        {patients.length > 0 ? patients.map(p => (
                            <button
                                key={p.id}
                                onClick={() => handlePatientSelect(p)}
                                className="w-full text-left p-6 rounded-2xl hover:bg-black/5 dark:hover:bg-white/5 transition-all group flex items-start gap-4 border border-transparent hover:border-claude-border/40 dark:hover:border-claude-darkBorder/40"
                            >
                                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-claude-accent to-orange-400 text-white flex items-center justify-center text-lg font-bold group-hover:shadow-md group-hover:shadow-claude-accent/20 transition-all shadow-sm">
                                    {p.name[0]}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="text-lg font-semibold text-claude-text dark:text-claude-darkText truncate group-hover:text-claude-accent transition-colors">
                                        Consultation with {p.name}
                                    </div>
                                    <div className="text-sm text-claude-muted dark:text-claude-darkMuted mt-1">
                                        Last updated 2 days ago
                                    </div>
                                </div>
                                <ChevronRight className="self-center text-claude-muted opacity-0 group-hover:opacity-100 transition-all translate-x-[-10px] group-hover:translate-x-0" />
                            </button>
                        )) : (
                            <div className="py-20 text-center">
                                <div className="w-16 h-16 bg-claude-sidebar dark:bg-claude-darkSidebar rounded-full flex items-center justify-center mx-auto mb-4 opacity-40">
                                    <MessageSquare size={24} />
                                </div>
                                <p className="text-claude-muted italic">No recent chats found.</p>
                            </div>
                        )}
                    </div>
                    {/* Bottom Fade Overlay */}
                    <div className="absolute bottom-0 left-0 w-full h-32 bg-gradient-to-t from-claude-bg dark:from-claude-darkBg via-claude-bg/80 dark:via-claude-darkBg/80 to-transparent pointer-events-none z-10" />
                </div>
            </div>
        </div>
    );
}
