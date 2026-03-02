import React from 'react';
import { Loader2, Paperclip, FileText, CheckCircle2 } from 'lucide-react';
import { formatMarkdownText, ExpandableText } from './MarkdownUtils';

export function ReportUploadingCard({ message: m }) {
    return (
        <div className="flex gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-claude-accent/20 to-orange-400/20 flex items-center justify-center flex-shrink-0">
                <Loader2 size={18} className="animate-spin text-claude-accent" />
            </div>
            <div className="flex-1 bg-white dark:bg-claude-darkSurface border border-claude-border dark:border-claude-darkBorder rounded-2xl p-5 shadow-premium">
                <div className="flex items-center gap-3">
                    <Paperclip size={16} className="text-claude-accent" />
                    <span className="text-sm font-semibold text-claude-text dark:text-claude-darkText">Processing report: <span className="text-claude-accent">{m.filename}</span></span>
                </div>
                <div className="mt-3 h-1.5 bg-claude-border dark:bg-claude-darkBorder rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-claude-accent to-orange-400 rounded-full animate-pulse" style={{ width: '70%' }} />
                </div>
                <p className="mt-2 text-xs text-claude-muted">Extracting text &amp; analysing medical data…</p>
            </div>
        </div>
    );
}

export function ReportInsightCard({ message: m }) {
    const ins = m.insights || {};
    const vitalsMap = {
        'Blood Pressure': ins.blood_pressure,
        'Heart Rate': ins.heart_rate,
        'Temperature': ins.temperature,
        'SpO2': ins.oxygen_saturation,
        'Weight': ins.weight,
        'Height': ins.height,
    };
    const labsMap = {
        'Haemoglobin': ins.haemoglobin,
        'Blood Glucose': ins.blood_glucose,
        'WBC': ins.wbc,
        'Platelets': ins.platelets,
        'Creatinine': ins.creatinine,
        'Cholesterol': ins.cholesterol,
    };
    const hasVitals = Object.values(vitalsMap).some(Boolean);
    const hasLabs = Object.values(labsMap).some(Boolean);

    return (
        <div className="flex gap-4 animate-in fade-in slide-in-from-bottom-6 duration-700 ease-out">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-claude-accent to-orange-400 flex items-center justify-center flex-shrink-0 shadow-lg shadow-claude-accent/20">
                <FileText size={18} className="text-white" />
            </div>
            <div className="flex-1 bg-white dark:bg-claude-darkSurface border border-claude-border dark:border-claude-darkBorder rounded-2xl overflow-hidden shadow-premium">
                {/* Card header */}
                <div className="px-5 py-4 bg-claude-sidebar/30 dark:bg-claude-darkSidebar/30 border-b border-claude-border dark:border-claude-darkBorder flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <CheckCircle2 size={18} className="text-claude-accent" />
                        <div>
                            <p className="text-sm font-bold text-claude-text dark:text-claude-darkText">📄 Report Analyzed</p>
                            <p className="text-xs text-claude-muted dark:text-claude-darkMuted truncate max-w-[280px]">{m.filename}</p>
                        </div>
                    </div>
                    {ins.report_type && (
                        <span className="text-[10px] font-bold uppercase tracking-wider text-claude-accent bg-claude-accent/10 border border-claude-accent/20 px-2 py-1 rounded-lg">{ins.report_type}</span>
                    )}
                </div>

                {/* Metadata row */}
                {(ins.report_date || ins.patient_name) && (
                    <div className="px-5 py-2.5 bg-claude-sidebar/20 dark:bg-claude-darkSidebar/20 border-b border-claude-border dark:border-claude-darkBorder flex flex-wrap gap-4 text-xs text-claude-muted">
                        {ins.report_date && <span>📅 {ins.report_date}</span>}
                        {ins.patient_name && <span>👤 {ins.patient_name}</span>}
                        <span>📑 {m.pageCount} page{m.pageCount !== 1 ? 's' : ''}</span>
                    </div>
                )}

                <div className="p-5 space-y-4">
                    {/* Vitals */}
                    {hasVitals && (
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-claude-muted mb-2">📊 Vitals</p>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                {Object.entries(vitalsMap).filter(([, v]) => v).map(([label, val]) => (
                                    <div key={label} className="bg-claude-sidebar/40 dark:bg-claude-darkSidebar/40 border border-claude-border/50 dark:border-claude-darkBorder/50 rounded-xl px-3 py-2">
                                        <p className="text-[9px] font-bold uppercase tracking-wider text-claude-muted/70">{label}</p>
                                        <p className="text-sm font-bold text-claude-text dark:text-claude-darkText">{val}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Lab Values */}
                    {hasLabs && (
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-claude-muted mb-2">🧪 Lab Values</p>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                {Object.entries(labsMap).filter(([, v]) => v).map(([label, val]) => (
                                    <div key={label} className="bg-claude-sidebar/40 dark:bg-claude-darkSidebar/40 border border-claude-border/50 dark:border-claude-darkBorder/50 rounded-xl px-3 py-2">
                                        <p className="text-[9px] font-bold uppercase tracking-wider text-claude-muted/70">{label}</p>
                                        <p className="text-sm font-bold text-claude-text dark:text-claude-darkText">{val}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Diagnosis */}
                    {ins.diagnosis && (
                        <div className="bg-claude-sidebar/40 dark:bg-claude-darkSidebar/40 border border-claude-border/50 dark:border-claude-darkBorder/50 rounded-xl p-3">
                            <p className="text-[10px] font-black uppercase tracking-widest text-claude-text dark:text-claude-darkText opacity-60 mb-1">🔍 Diagnosis / Impression</p>
                            <div className="text-sm text-claude-text dark:text-claude-darkText">{formatMarkdownText(ins.diagnosis)}</div>
                        </div>
                    )}

                    {/* Recommendations */}
                    {ins.recommendations && (
                        <div className="bg-claude-sidebar/40 dark:bg-claude-darkSidebar/40 border border-claude-border/50 dark:border-claude-darkBorder/50 rounded-xl p-3">
                            <p className="text-[10px] font-black uppercase tracking-widest text-claude-text dark:text-claude-darkText opacity-60 mb-1">💊 Recommendations</p>
                            <div className="text-sm text-claude-text dark:text-claude-darkText">{formatMarkdownText(ins.recommendations)}</div>
                        </div>
                    )}

                    {/* Fallback text snippet (when nothing extracted) */}
                    {!hasVitals && !hasLabs && !ins.diagnosis && !ins.recommendations && (
                        <div className="bg-claude-sidebar/40 dark:bg-claude-darkSidebar/40 border border-claude-border/50 dark:border-claude-darkBorder/50 rounded-xl p-3">
                            <p className="text-[10px] font-black uppercase tracking-widest text-claude-muted mb-1">📄 Extracted Summary</p>
                            <ExpandableText text={m.summary || ''} />
                        </div>
                    )}

                    <p className="text-[10px] text-claude-accent font-semibold flex items-center gap-1.5">
                        <CheckCircle2 size={12} />
                        Report indexed — AI now has full context. Ask anything about this report.
                    </p>
                </div>
            </div>
        </div>
    );
}
