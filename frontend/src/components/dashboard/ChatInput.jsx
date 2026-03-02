import React, { useRef } from 'react';
import { Send, AlertCircle, X, Loader2, Paperclip } from 'lucide-react';
import { cn } from './MarkdownUtils';

export default function ChatInput({
    chatMessage,
    setChatMessage,
    onSend,
    isLoading,
    placeholder,
    // File upload props 
    showAttachment = false,
    activeSession = null,
    uploadingFile = false,
    uploadFileName = '',
    uploadError = null,
    setUploadError = () => { },
    handleFileUpload = () => { }
}) {
    const fileInputRef = useRef(null);

    return (
        <div className="p-8 pb-10 bg-gradient-to-t from-claude-bg via-claude-bg to-transparent dark:from-claude-darkBg dark:via-claude-darkBg z-20">
            <div className="max-w-3xl mx-auto relative group">
                {/* Error Toast */}
                {uploadError && (
                    <div className="mb-3 flex items-center gap-2 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/50 rounded-2xl px-4 py-3 animate-in fade-in slide-in-from-top-2 duration-300">
                        <AlertCircle size={16} className="text-red-500 flex-shrink-0" />
                        <p className="text-sm text-red-600 dark:text-red-400 font-medium">{uploadError}</p>
                        <button onClick={() => setUploadError(null)} className="ml-auto text-red-400 hover:text-red-600 transition-colors">
                            <X size={14} />
                        </button>
                    </div>
                )}

                {/* Supported formats hint */}
                {showAttachment && (
                    <div className="mb-2 text-center">
                        <span className="text-[10px] text-claude-muted/50 dark:text-claude-darkMuted/40">
                            Attach: PDF · PNG · JPG · TIFF · BMP · WEBP
                        </span>
                    </div>
                )}

                <div className="absolute -inset-1 bg-gradient-to-r from-claude-accent/10 to-orange-400/10 rounded-[2rem] blur opacity-0 group-focus-within:opacity-100 transition-opacity duration-500" />
                <div className="relative">
                    {showAttachment && (
                        <>
                            {/* Hidden file input */}
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleFileUpload}
                                accept=".pdf,.png,.jpg,.jpeg,.tiff,.tif,.bmp,.webp"
                                className="hidden"
                            />

                            {/* Attach button — left side of textarea */}
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                disabled={!activeSession || uploadingFile}
                                title="Attach patient report (PDF or image)"
                                className={cn(
                                    "absolute left-4 bottom-4 p-3 rounded-2xl transition-all active:scale-95",
                                    uploadingFile
                                        ? "text-claude-accent animate-pulse"
                                        : "text-claude-muted hover:text-claude-accent hover:bg-claude-accent/10 dark:hover:bg-claude-accent/10",
                                    "disabled:opacity-30 disabled:pointer-events-none"
                                )}
                            >
                                {uploadingFile ? <Loader2 size={18} className="animate-spin" /> : <Paperclip size={18} />}
                            </button>
                        </>
                    )}

                    <textarea
                        rows="1"
                        value={chatMessage}
                        onChange={(e) => {
                            setChatMessage(e.target.value);
                            e.target.style.height = 'auto';
                            e.target.style.height = e.target.scrollHeight + 'px';
                        }}
                        disabled={showAttachment && !activeSession}
                        placeholder={uploadingFile ? `Analysing ${uploadFileName}…` : placeholder}
                        className={cn(
                            "w-full bg-white dark:bg-claude-darkSurface border border-claude-border dark:border-claude-darkBorder rounded-3xl py-6 pr-16 text-[16px] focus:outline-none focus:ring-2 focus:ring-claude-accent/20 focus:border-claude-accent/40 resize-none transition-all shadow-premium group-hover:shadow-xl disabled:opacity-50 min-h-[72px] max-h-48 custom-scrollbar",
                            showAttachment ? "pl-16" : "pl-8"
                        )}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                onSend();
                            }
                        }}
                    />
                    <button
                        onClick={onSend}
                        disabled={!chatMessage.trim() || (showAttachment && !activeSession) || isLoading}
                        className="absolute right-4 bottom-4 p-3 bg-claude-accent text-white rounded-2xl hover:scale-110 hover:shadow-lg hover:shadow-claude-accent/30 active:scale-95 transition-all disabled:opacity-20 disabled:hover:scale-100 shadow-premium"
                    >
                        <Send size={18} />
                    </button>
                </div>
            </div>
        </div>
    );
}
