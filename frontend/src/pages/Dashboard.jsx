import React, { useState, useEffect, useRef } from 'react';
import {
    Plus,
    MessageSquare,
    Users,
    Settings,
    Sun,
    Moon,
    Send,
    FileText,
    Search,
    ChevronRight,
    Loader2
} from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import axios from 'axios';
import PixelMascot from '../components/PixelMascot';

function cn(...inputs) {
    return twMerge(clsx(inputs));
}

export default function Dashboard({ isDarkMode, toggleTheme }) {
    const [activePatient, setActivePatient] = useState(null);
    const [activeSession, setActiveSession] = useState(null);
    const [chatMessage, setChatMessage] = useState("");
    const [patients, setPatients] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isIntakeMode, setIsIntakeMode] = useState(false);
    const [intakeMessages, setIntakeMessages] = useState([
        { role: 'assistant', content: 'Hello! I am DocOc. To get started, could you please provide the patient\'s full name, age, gender, and a brief medical history?' }
    ]);
    const [greeting, setGreeting] = useState("Hello Doctor. How can I assist you today?");
    const [messages, setMessages] = useState([
        { role: 'assistant', content: 'Hello Doctor. How can I assist you with patient records today?' }
    ]);

    // Fetch dynamic greeting from LLM
    useEffect(() => {
        if (!activePatient) {
            axios.get("http://localhost:8000/greeting")
                .then(res => setGreeting(res.data.greeting))
                .catch(err => {
                    console.error("Failed to fetch greeting:", err);
                    setGreeting("Good day, Doctor. Ready for the next consultation?");
                });
        }
    }, [activePatient]);

    useEffect(() => {
        fetchPatients();
    }, []);

    const fetchPatients = async () => {
        try {
            const res = await axios.get('/api/patients/');
            setPatients(res.data);
        } catch (err) {
            console.error("Failed to fetch patients", err);
        }
    };

    const handlePatientSelect = async (patient) => {
        setIsIntakeMode(false);
        setActivePatient(patient);
        try {
            const res = await axios.post(`/api/patients/${patient.id}/sessions/`);
            setActiveSession(res.data);
            setMessages([{ role: 'assistant', content: `How can I help you with ${patient.name}'s records?` }]);
        } catch (err) {
            console.error("Failed to create session", err);
        }
    };

    const startNewIntake = () => {
        setActivePatient(null);
        setActiveSession(null);
        setIsIntakeMode(true);
        setIntakeMessages([
            { role: 'assistant', content: 'Hello! I am DocOc. To get started, could you please provide the patient\'s full name, age, gender, and a brief medical history?' }
        ]);
        setChatMessage("");
    };

    const handleSend = async () => {
        if (!chatMessage.trim() || !activeSession || isLoading) return;

        const userMsg = { role: 'user', content: chatMessage };
        setChatMessage("");
        setIsLoading(true);

        // Use a ref to accumulate streamed text — avoids React StrictMode double-render bugs
        const accumulatedRef = { current: '' };

        try {
            const snapshotMessages = [...messages, userMsg, { role: 'assistant', content: '' }];
            setMessages(snapshotMessages);

            const response = await fetch(`/api/chat/generate?prompt=${encodeURIComponent(userMsg.content)}&session_id=${activeSession.id}`, {
                method: 'POST'
            });

            if (!response.body) throw new Error("No response body");

            setIsLoading(false);

            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                if (chunk) {
                    accumulatedRef.current += chunk;
                    setMessages(prev => {
                        const updated = [...prev];
                        updated[updated.length - 1] = { role: 'assistant', content: accumulatedRef.current };
                        return updated;
                    });
                }
            }
        } catch (err) {
            setMessages(prev => {
                const updated = [...prev];
                updated[updated.length - 1] = { role: 'assistant', content: "Error communicating with local LLM. Is Ollama running?" };
                return updated;
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleIntakeSend = async () => {
        if (!chatMessage.trim() || isLoading) return;

        const userMsg = { role: 'user', content: chatMessage };
        const newMessages = [...intakeMessages, userMsg];
        setChatMessage("");
        setIsLoading(true);

        // Accumulate streamed text in a plain object ref to avoid closure/StrictMode issues
        const accRef = { current: '' };
        setIntakeMessages([...newMessages, { role: 'assistant', content: '' }]);

        try {
            const response = await fetch('/api/chat/intake', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ messages: newMessages })
            });

            if (!response.body) throw new Error("No response body");

            setIsLoading(false);

            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                accRef.current += chunk;

                if (accRef.current.includes("__INTAKE_COMPLETE__")) {
                    const parts = accRef.current.split("__INTAKE_COMPLETE__");
                    const visibleText = parts[0];
                    const jsonStr = parts[1];

                    setIntakeMessages(prev => {
                        const updated = [...prev];
                        updated[updated.length - 1] = { role: 'assistant', content: visibleText };
                        return updated;
                    });

                    try {
                        const data = JSON.parse(jsonStr);
                        setPatients(prev => [data.patient, ...prev]);
                        setIsIntakeMode(false);
                        setActivePatient(data.patient);
                        setActiveSession({ id: data.session_id, patient_id: data.patient.id, title: "Initial Consultation" });
                        setMessages([
                            { role: 'assistant', content: `Intake complete. What are ${data.patient.name}'s current symptoms?` }
                        ]);
                        return;
                    } catch (e) { console.error("Parse error", e); }
                } else {
                    setIntakeMessages(prev => {
                        const updated = [...prev];
                        updated[updated.length - 1] = { role: 'assistant', content: accRef.current };
                        return updated;
                    });
                }
            }
        } catch (err) {
            setIntakeMessages(prev => {
                const updated = [...prev];
                updated[updated.length - 1] = { role: 'assistant', content: "Error communicating with local LLM. Is Ollama running?" };
                return updated;
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex h-screen overflow-hidden font-sans selection:bg-claude-accent/20 bg-claude-bg dark:bg-claude-darkBg transition-colors duration-500">
            {/* Sidebar - Claude Style */}
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

            {/* Main Content Area */}
            <main className="flex-1 flex flex-col relative bg-claude-bg dark:bg-claude-darkBg transition-colors duration-500">
                {isIntakeMode ? (
                    /* Patient Intake View */
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
                                    <div key={i} className={cn(
                                        "flex gap-6 animate-in fade-in slide-in-from-bottom-6 duration-700 ease-out",
                                        m.role === 'user' ? "flex-row-reverse text-right" : "text-left"
                                    )}>
                                        <div className={cn(
                                            "w-10 h-10 rounded-2xl flex-shrink-0 flex items-center justify-center text-[10px] font-black tracking-tighter shadow-premium transition-all",
                                            m.role === 'assistant'
                                                ? "bg-claude-accent text-white"
                                                : "bg-claude-text dark:bg-white text-white dark:text-black"
                                        )}>
                                            {m.role === 'assistant' ? 'AI' : 'DR'}
                                        </div>
                                        <div className="max-w-[80%] space-y-2">
                                            <div className={cn(
                                                "text-[17px] leading-[1.7] text-claude-text dark:text-claude-darkText whitespace-pre-wrap py-1 selection:bg-claude-accent/20",
                                                m.role === 'assistant' ? "font-serif" : "font-sans font-medium"
                                            )}>
                                                {m.content}
                                            </div>
                                        </div>
                                    </div>
                                ))}

                                {isLoading && (
                                    <div className="flex gap-6 animate-pulse">
                                        <div className="w-10 h-10 rounded-2xl bg-claude-accent/20 flex items-center justify-center">
                                            <Loader2 size={16} className="animate-spin text-claude-accent" />
                                        </div>
                                        <div className="space-y-3 flex-1 pt-2">
                                            <div className="h-3 bg-claude-border dark:bg-claude-darkBorder rounded-full w-3/4"></div>
                                            <div className="h-3 bg-claude-border dark:bg-claude-darkBorder rounded-full w-1/2"></div>
                                        </div>
                                    </div>
                                )}
                                <div className="h-4" />
                            </div>
                        </div>

                        {/* Intake Input */}
                        <div className="p-8 pb-10 bg-gradient-to-t from-claude-bg via-claude-bg to-transparent dark:from-claude-darkBg dark:via-claude-darkBg z-20">
                            <div className="max-w-3xl mx-auto relative group">
                                <div className="absolute -inset-1 bg-gradient-to-r from-claude-accent/10 to-orange-400/10 rounded-[2rem] blur opacity-0 group-focus-within:opacity-100 transition-opacity duration-500" />
                                <div className="relative">
                                    <textarea
                                        rows="1"
                                        value={chatMessage}
                                        onChange={(e) => {
                                            setChatMessage(e.target.value);
                                            e.target.style.height = 'auto';
                                            e.target.style.height = e.target.scrollHeight + 'px';
                                        }}
                                        placeholder="Enter patient details..."
                                        className="w-full bg-white dark:bg-claude-darkSurface border border-claude-border dark:border-claude-darkBorder rounded-3xl py-6 pl-8 pr-16 text-[16px] focus:outline-none focus:ring-2 focus:ring-claude-accent/20 focus:border-claude-accent/40 resize-none transition-all shadow-premium group-hover:shadow-xl disabled:opacity-50 min-h-[72px] max-h-48 custom-scrollbar"
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && !e.shiftKey) {
                                                e.preventDefault();
                                                handleIntakeSend();
                                            }
                                        }}
                                    />
                                    <button
                                        onClick={handleIntakeSend}
                                        disabled={!chatMessage.trim() || isLoading}
                                        className="absolute right-4 bottom-4 p-3 bg-claude-accent text-white rounded-2xl hover:scale-110 hover:shadow-lg hover:shadow-claude-accent/30 active:scale-95 transition-all disabled:opacity-20 disabled:hover:scale-100 shadow-premium"
                                    >
                                        <Send size={18} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </>
                ) : !activePatient ? (
                    /* Landing Page - Claude "Chats" View */
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
                                            <div className="w-12 h-12 rounded-xl bg-claude-sidebar dark:bg-claude-darkSidebar flex items-center justify-center text-lg font-bold group-hover:bg-claude-accent group-hover:text-white transition-all shadow-sm">
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
                ) : (
                    /* Active Consultation View */
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
                                {messages.map((m, i) => (
                                    <div key={i} className={cn(
                                        "flex gap-6 animate-in fade-in slide-in-from-bottom-6 duration-700 ease-out",
                                        m.role === 'user' ? "flex-row-reverse text-right" : "text-left"
                                    )}>
                                        <div className={cn(
                                            "w-10 h-10 rounded-2xl flex-shrink-0 flex items-center justify-center text-[10px] font-black tracking-tighter shadow-premium transition-all",
                                            m.role === 'assistant'
                                                ? "bg-claude-accent text-white"
                                                : "bg-claude-text dark:bg-white text-white dark:text-black"
                                        )}>
                                            {m.role === 'assistant' ? 'AI' : 'DR'}
                                        </div>
                                        <div className="max-w-[80%] space-y-2">
                                            <div className={cn(
                                                "text-[17px] leading-[1.7] text-claude-text dark:text-claude-darkText whitespace-pre-wrap py-1 selection:bg-claude-accent/20",
                                                m.role === 'assistant' ? "font-serif" : "font-sans font-medium"
                                            )}>
                                                {m.content}
                                            </div>
                                        </div>
                                    </div>
                                ))}

                                {isLoading && (
                                    <div className="flex gap-6 animate-pulse">
                                        <div className="w-10 h-10 rounded-2xl bg-claude-accent/20 flex items-center justify-center">
                                            <Loader2 size={16} className="animate-spin text-claude-accent" />
                                        </div>
                                        <div className="space-y-3 flex-1 pt-2">
                                            <div className="h-3 bg-claude-border dark:bg-claude-darkBorder rounded-full w-3/4"></div>
                                            <div className="h-3 bg-claude-border dark:bg-claude-darkBorder rounded-full w-1/2"></div>
                                        </div>
                                    </div>
                                )}
                                <div className="h-4" />
                            </div>
                        </div>

                        {/* Message Input */}
                        <div className="p-8 pb-10 bg-gradient-to-t from-claude-bg via-claude-bg to-transparent dark:from-claude-darkBg dark:via-claude-darkBg z-20">
                            <div className="max-w-3xl mx-auto relative group">
                                <div className="absolute -inset-1 bg-gradient-to-r from-claude-accent/10 to-orange-400/10 rounded-[2rem] blur opacity-0 group-focus-within:opacity-100 transition-opacity duration-500" />
                                <div className="relative">
                                    <textarea
                                        rows="1"
                                        value={chatMessage}
                                        onChange={(e) => {
                                            setChatMessage(e.target.value);
                                            e.target.style.height = 'auto';
                                            e.target.style.height = e.target.scrollHeight + 'px';
                                        }}
                                        disabled={!activeSession}
                                        placeholder={`Ask DocOc about ${activePatient.name}'s records...`}
                                        className="w-full bg-white dark:bg-claude-darkSurface border border-claude-border dark:border-claude-darkBorder rounded-3xl py-6 pl-8 pr-16 text-[16px] focus:outline-none focus:ring-2 focus:ring-claude-accent/20 focus:border-claude-accent/40 resize-none transition-all shadow-premium group-hover:shadow-xl disabled:opacity-50 min-h-[72px] max-h-48 custom-scrollbar"
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && !e.shiftKey) {
                                                e.preventDefault();
                                                handleSend();
                                            }
                                        }}
                                    />
                                    <button
                                        onClick={handleSend}
                                        disabled={!chatMessage.trim() || !activeSession || isLoading}
                                        className="absolute right-4 bottom-4 p-3 bg-claude-accent text-white rounded-2xl hover:scale-110 hover:shadow-lg hover:shadow-claude-accent/30 active:scale-95 transition-all disabled:opacity-20 disabled:hover:scale-100 shadow-premium"
                                    >
                                        <Send size={18} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </>
                )}
                {/* Global Footer */}
                <div className="absolute bottom-4 left-0 right-0 pointer-events-none flex justify-center">
                    <div className="flex items-center gap-4 opacity-40 hover:opacity-100 transition-opacity pointer-events-auto cursor-default">
                        <div className="h-[1px] w-8 bg-claude-text dark:bg-white" />
                        <p className="text-[9px] text-claude-text dark:text-white font-black uppercase tracking-[0.4em]">
                            DocOc • Private & Local
                        </p>
                        <div className="h-[1px] w-8 bg-claude-text dark:bg-white" />
                    </div>
                </div>
            </main>
        </div>
    );

}
