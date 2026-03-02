import React from 'react';
import { Loader2, ThumbsUp, ThumbsDown, RotateCcw } from 'lucide-react';
import { cn, formatMarkdownText } from './MarkdownUtils';
import PixelMascot from '../PixelMascot';

export default function ChatMessage({ message: m, isStreaming, isLast, onRetry }) {
    return (
        <div className={cn(
            "flex gap-6 animate-in fade-in slide-in-from-bottom-6 duration-700 ease-out",
            m.role === 'user' ? "flex-row-reverse text-right" : "text-left"
        )}>
            <div className={cn(
                "w-10 h-10 flex-shrink-0 flex items-center justify-center text-[10px] font-black tracking-tighter transition-all",
                m.role === 'assistant'
                    ? "bg-transparent"
                    : "rounded-2xl shadow-premium bg-claude-text dark:bg-white text-white dark:text-black"
            )}>
                {m.role === 'assistant' ? <PixelMascot className="w-12 h-12 scale-150" /> : 'DR'}
            </div>
            <div className="max-w-[80%] flex flex-col items-start gap-1">
                <div className="space-y-2 w-full">
                    <div className={cn(
                        "text-[17px] leading-[1.7] text-claude-text dark:text-claude-darkText whitespace-pre-wrap py-1 selection:bg-claude-accent/20",
                        m.role === 'assistant' ? "font-serif" : "font-sans font-medium"
                    )}>
                        {formatMarkdownText(m.content)}
                    </div>
                    {m.role === 'assistant' && isStreaming && isLast && (
                        <div className="pt-2">
                            <Loader2 size={16} className="animate-spin text-claude-accent" />
                        </div>
                    )}
                </div>
                {m.role === 'assistant' && !isStreaming && onRetry && (
                    <div className="flex items-center gap-3 mt-1 pl-1">
                        <button className="text-claude-muted hover:text-claude-accent transition-colors flex items-center justify-center p-1 rounded-md hover:bg-black/5 dark:hover:bg-white/5">
                            <ThumbsUp size={14} />
                        </button>
                        <button className="text-claude-muted hover:text-red-500 transition-colors flex items-center justify-center p-1 rounded-md hover:bg-black/5 dark:hover:bg-white/5">
                            <ThumbsDown size={14} />
                        </button>
                        <div className="w-px h-3 bg-claude-border dark:bg-claude-darkBorder mx-1"></div>
                        <button onClick={onRetry} className="text-claude-muted hover:text-claude-text dark:hover:text-claude-darkText transition-colors flex items-center gap-1 text-[11px] font-semibold tracking-wider uppercase p-1 rounded-md hover:bg-black/5 dark:hover:bg-white/5 active:scale-95">
                            <RotateCcw size={12} /> Retry
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

export function ChatLoadingSkeleton() {
    return (
        <div className="flex gap-6 animate-pulse">
            <div className="w-10 h-10 flex-shrink-0 flex items-center justify-center transition-all bg-transparent">
                <PixelMascot className="w-12 h-12 scale-150" />
            </div>
            <div className="space-y-3 flex-1 pt-3">
                <div className="h-3 bg-claude-border dark:bg-claude-darkBorder rounded-full w-3/4"></div>
                <div className="h-3 bg-claude-border dark:bg-claude-darkBorder rounded-full w-1/2"></div>
            </div>
        </div>
    );
}
