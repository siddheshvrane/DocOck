import React from 'react';
import { Search, FileText } from 'lucide-react';
import ChatMessage, { ChatLoadingSkeleton } from './ChatMessage';
import ChatInput from './ChatInput';
import { ReportUploadingCard, ReportInsightCard } from './ReportInsightCard';

export default function ConsultationView({
    activePatient,
    activeSession,
    messages,
    isLoading,
    isStreaming,
    chatMessage,
    setChatMessage,
    handleSend,
    handleRetry,
    uploadError,
    setUploadError,
    uploadingFile,
    uploadFileName,
    handleFileUpload
}) {
    return (
        <>
            {/* Chat Header */}
            <header className="h-20 border-b border-claude-border/60 dark:border-claude-darkBorder/60 flex items-center justify-between px-8 bg-claude-bg/80 dark:bg-claude-darkBg/80 backdrop-blur-xl z-20 transition-all">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-4 animate-in fade-in slide-in-from-left-4 duration-500">
                        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-claude-accent to-orange-400 flex items-center justify-center text-white font-bold shadow-lg shadow-claude-accent/20">
                            {activePatient.name[0]}
                        </div>
                        <div>
                            <h2 className="text-base font-bold text-claude-text dark:text-claude-darkText tracking-tight">{activePatient.name}</h2>
                            <div className="flex items-center gap-2">
                                <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                                </span>
                                <p className="text-[11px] text-green-600 dark:text-green-500 font-bold uppercase tracking-wider">Clinical Insight Active</p>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <button className="p-2.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition-all text-claude-muted active:scale-95"><Search size={20} /></button>
                    <button className="p-2.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition-all text-claude-muted active:scale-95"><FileText size={20} /></button>
                </div>
            </header>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto custom-scrollbar px-8 transition-all">
                <div className="max-w-3xl mx-auto py-12 space-y-12">
                    {messages.map((m, i) => {
                        if (m.role === 'report-uploading') {
                            return <ReportUploadingCard key={i} message={m} />;
                        }
                        if (m.role === 'report-card') {
                            return <ReportInsightCard key={i} message={m} />;
                        }
                        return (
                            <ChatMessage
                                key={i}
                                message={m}
                                isStreaming={isStreaming}
                                isLast={i === messages.length - 1}
                                onRetry={handleRetry}
                            />
                        );
                    })}

                    {isLoading && <ChatLoadingSkeleton />}
                    <div className="h-4" />
                </div>
            </div>

            {/* Message Input with File Attachment */}
            <ChatInput
                chatMessage={chatMessage}
                setChatMessage={setChatMessage}
                onSend={handleSend}
                isLoading={isLoading}
                placeholder={`Ask DocOc about ${activePatient.name}'s records…`}
                showAttachment={true}
                activeSession={activeSession}
                uploadingFile={uploadingFile}
                uploadFileName={uploadFileName}
                uploadError={uploadError}
                setUploadError={setUploadError}
                handleFileUpload={handleFileUpload}
            />
        </>
    );
}
