import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs) {
    return twMerge(clsx(inputs));
}

export const formatMarkdownText = (text) => {
    if (!text) return text;
    // Split by **bold** or *semibold*, keeping the delimiters using capture groups
    const parts = text.split(/(\*\*.*?\*\*|\*.*?\*)/g);

    return parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
            return <strong key={i} className="font-bold">{part.slice(2, -2)}</strong>;
        } else if (part.startsWith('*') && part.endsWith('*')) {
            return <span key={i} className="font-semibold">{part.slice(1, -1)}</span>;
        }
        return part;
    });
};

export const ExpandableText = ({ text }) => {
    const [expanded, setExpanded] = useState(false);

    if (!text) return null;

    return (
        <div className="relative group">
            <div className={cn(
                "text-sm text-claude-text dark:text-claude-darkText whitespace-pre-wrap transition-all duration-300",
                expanded ? "max-h-[400px] overflow-y-auto custom-scrollbar" : "max-h-24 overflow-hidden"
            )}>
                {formatMarkdownText(text)}
            </div>

            <button
                onClick={() => setExpanded(!expanded)}
                className="w-full flex items-center justify-center py-1 mt-2 bg-claude-sidebar/20 dark:bg-claude-darkSidebar/20 hover:bg-claude-sidebar/60 dark:hover:bg-claude-darkSidebar/60 border border-claude-border/50 dark:border-claude-darkBorder/50 rounded-lg transition-colors text-claude-muted hover:text-claude-accent"
            >
                {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
        </div>
    );
};
