import React from 'react';
import { Plus } from 'lucide-react';
import ChatMessage, { ChatLoadingSkeleton } from './ChatMessage';
import ChatInput from './ChatInput';

export default function IntakeView({
    intakeMessages,
    isStreaming,
    isLoading,
    chatMessage,
    setChatMessage,
    handleIntakeSend,
    handleIntakeRetry
}) {
    return (
        <>
            {/* Header */}
            <header className="h-20 border-b border-claude-border/60 dark:border-claude-darkBorder/60 flex items-center justify-between px-8 bg-claude-bg/80 dark:bg-claude-darkBg/80 backdrop-blur-xl z-20 transition-all">
                <div className="flex items-center gap-4 animate-in fade-in slide-in-from-left-4 duration-500">
                    <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-claude-accent to-orange-400 flex items-center justify-center text-white font-bold shadow-lg shadow-claude-accent/20">
                        <Plus size={20} />
                    </div>
                    <div>
                        <h2 className="text-base font-bold text-claude-text dark:text-claude-darkText tracking-tight">New Patient Intake</h2>
                        <div className="flex items-center gap-2">
                            <p className="text-[11px] text-claude-muted font-bold uppercase tracking-wider">Gathering Demographics & History</p>
                        </div>
                    </div>
                </div>
            </header>

            {/* Intake Messages Area */}
            <div className="flex-1 overflow-y-auto custom-scrollbar px-8 transition-all">
                <div className="max-w-3xl mx-auto py-12 space-y-12">
                    {intakeMessages.map((m, i) => (
                        <ChatMessage
                            key={i}
                            message={m}
                            isStreaming={isStreaming}
                            isLast={i === intakeMessages.length - 1}
                            onRetry={handleIntakeRetry}
                        />
                    ))}

                    {isLoading && <ChatLoadingSkeleton />}
                    <div className="h-4" />
                </div>
            </div>

            {/* Intake Input */}
            <ChatInput
                chatMessage={chatMessage}
                setChatMessage={setChatMessage}
                onSend={handleIntakeSend}
                isLoading={isLoading}
                placeholder="Enter patient details..."
            />
        </>
    );
}
