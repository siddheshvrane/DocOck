import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import Sidebar from '../components/dashboard/Sidebar';
import LandingPage from '../components/dashboard/LandingPage';
import IntakeView from '../components/dashboard/IntakeView';
import ConsultationView from '../components/dashboard/ConsultationView';

export default function Dashboard({ isDarkMode, toggleTheme }) {
    const [activePatient, setActivePatient] = useState(null);
    const [activeSession, setActiveSession] = useState(null);
    const [chatMessage, setChatMessage] = useState("");
    const [patients, setPatients] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isStreaming, setIsStreaming] = useState(false);
    const [isIntakeMode, setIsIntakeMode] = useState(false);
    const [intakeMessages, setIntakeMessages] = useState([
        { role: 'assistant', content: "New patient intake. What is the patient's full name?" }
    ]);
    const [greeting, setGreeting] = useState("Hello Doctor. How can I assist you today?");
    const [messages, setMessages] = useState([
        { role: 'assistant', content: 'Hello Doctor. How can I assist you with patient records today?' }
    ]);

    // Report upload states
    const [uploadingFile, setUploadingFile] = useState(false);
    const [uploadFileName, setUploadFileName] = useState('');
    const [uploadError, setUploadError] = useState(null);
    const fileInputRef = useRef(null);

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
            // Build an opening summary for the doctor from known patient data
            const conditions = patient.chronic_conditions && !['none', 'none reported', 'none known'].includes(patient.chronic_conditions.toLowerCase())
                ? patient.chronic_conditions : 'none known';
            const allergies = patient.allergies && !['none', 'none reported', 'none known'].includes(patient.allergies.toLowerCase())
                ? patient.allergies : 'none known';
            const meds = patient.current_medications && !['none', 'none reported'].includes(patient.current_medications.toLowerCase())
                ? patient.current_medications : 'none reported';
            setMessages([{
                role: 'assistant',
                content: `Patient loaded: ${patient.name}, ${patient.age}y, ${patient.sex}${patient.blood_group ? ', ' + patient.blood_group : ''}.\n` +
                    `Chronic conditions: ${conditions}.\n` +
                    `Allergies: ${allergies}.\n` +
                    `Medications: ${meds}.\n\n` +
                    `What are the presenting symptoms or how can I assist?`
            }]);
        } catch (err) {
            console.error("Failed to create session", err);
        }
    };

    const startNewIntake = () => {
        setActivePatient(null);
        setActiveSession(null);
        setIsIntakeMode(true);
        setIntakeMessages([
            { role: 'assistant', content: "New patient intake. What is the patient's full name?" }
        ]);
        setChatMessage("");
    };

    // ── Report Upload Handler ─────────────────────────────────────────────────
    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file || !activePatient) return;

        // Reset input so the same file can be re-selected if needed
        e.target.value = '';

        const allowedTypes = [
            'application/pdf',
            'image/png', 'image/jpeg', 'image/jpg',
            'image/tiff', 'image/bmp', 'image/webp'
        ];
        if (!allowedTypes.includes(file.type)) {
            setUploadError('Unsupported file type. Please upload a PDF or image (PNG, JPG, TIFF, BMP, WEBP).');
            setTimeout(() => setUploadError(null), 5000);
            return;
        }

        setUploadingFile(true);
        setUploadFileName(file.name);
        setUploadError(null);

        // Add a placeholder "uploading" message to the chat
        const placeholderMsg = {
            role: 'report-uploading',
            content: `📎 Reading **${file.name}**…`,
            filename: file.name
        };
        setMessages(prev => [...prev, placeholderMsg]);

        try {
            const formData = new FormData();
            formData.append('file', file);

            const res = await axios.post(
                `/api/patients/${activePatient.id}/upload-report/`,
                formData,
                { headers: { 'Content-Type': 'multipart/form-data' } }
            );

            const data = res.data;

            // Replace the placeholder with the real insight card
            setMessages(prev => {
                const updated = [...prev];
                // Find the last uploading placeholder and replace it
                const idx = updated.findLastIndex(m => m.role === 'report-uploading');
                if (idx !== -1) {
                    updated[idx] = {
                        role: 'report-card',
                        filename: data.filename,
                        pageCount: data.page_count,
                        insights: data.insights,
                        summary: data.summary,
                    };
                }
                return updated;
            });
        } catch (err) {
            const errMsg = err.response?.data?.detail || 'Upload failed. Please try again.';
            setUploadError(errMsg);
            setTimeout(() => setUploadError(null), 6000);
            // Remove the placeholder on error
            setMessages(prev => prev.filter(m => m.role !== 'report-uploading'));
        } finally {
            setUploadingFile(false);
            setUploadFileName('');
        }
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
            setIsStreaming(true);

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
            setIsStreaming(false);
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
            setIsStreaming(true);

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
                        const p = data.patient;
                        setPatients(prev => [p, ...prev]);
                        setIsIntakeMode(false);
                        setActivePatient(p);
                        setActiveSession({ id: data.session_id, patient_id: p.id, title: "Initial Consultation" });
                        // Build opening clinical summary from what was just captured
                        const conditions = p.chronic_conditions && !['none', 'none reported', 'none known'].includes(p.chronic_conditions.toLowerCase())
                            ? p.chronic_conditions : 'none known';
                        const allergies = p.allergies && !['none', 'none reported', 'none known'].includes(p.allergies.toLowerCase())
                            ? p.allergies : 'none known';
                        setMessages([{
                            role: 'assistant',
                            content: `Patient registered: ${p.name}, ${p.age}y, ${p.sex}${p.blood_group ? ', ' + p.blood_group : ''}.\n` +
                                `Chronic conditions: ${conditions}.\n` +
                                `Allergies: ${allergies}.\n\n` +
                                `I have the full profile. What are the presenting symptoms?`
                        }]);
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
            setIsStreaming(false);
        }
    };

    const handleRetry = async () => {
        if (messages.length < 2 || isLoading) return;

        // Find the last user message
        let lastUserIndex = messages.length - 1;
        while (lastUserIndex >= 0 && messages[lastUserIndex].role !== 'user') {
            lastUserIndex--;
        }

        if (lastUserIndex < 0) return;

        const previousMessages = messages.slice(0, lastUserIndex + 1);
        const lastUserMsg = messages[lastUserIndex].content;

        setIsLoading(true);
        setMessages([...previousMessages, { role: 'assistant', content: '' }]);

        const accumulatedRef = { current: '' };

        try {
            const response = await fetch(`/api/chat/generate?prompt=${encodeURIComponent(lastUserMsg)}&session_id=${activeSession.id}`, {
                method: 'POST'
            });

            if (!response.body) throw new Error("No response body");

            setIsLoading(false);
            setIsStreaming(true);

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
            setIsStreaming(false);
        }
    };

    const handleIntakeRetry = async () => {
        if (intakeMessages.length < 2 || isLoading) return;

        let lastUserIndex = intakeMessages.length - 1;
        while (lastUserIndex >= 0 && intakeMessages[lastUserIndex].role !== 'user') {
            lastUserIndex--;
        }

        if (lastUserIndex < 0) return;

        const previousMessages = intakeMessages.slice(0, lastUserIndex + 1);
        setIsLoading(true);
        setIntakeMessages([...previousMessages, { role: 'assistant', content: '' }]);

        const accRef = { current: '' };

        try {
            const response = await fetch('/api/chat/intake', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ messages: previousMessages })
            });

            if (!response.body) throw new Error("No response body");

            setIsLoading(false);
            setIsStreaming(true);

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
                        const p = data.patient;
                        setPatients(prev => [p, ...prev]);
                        setIsIntakeMode(false);
                        setActivePatient(p);
                        setActiveSession({ id: data.session_id, patient_id: p.id, title: "Initial Consultation" });

                        const conditions = p.chronic_conditions && !['none', 'none reported', 'none known'].includes(p.chronic_conditions.toLowerCase())
                            ? p.chronic_conditions : 'none known';
                        const allergies = p.allergies && !['none', 'none reported', 'none known'].includes(p.allergies.toLowerCase())
                            ? p.allergies : 'none known';
                        setMessages([{
                            role: 'assistant',
                            content: `Patient registered: ${p.name}, ${p.age}y, ${p.sex}${p.blood_group ? ', ' + p.blood_group : ''}.\n` +
                                `Chronic conditions: ${conditions}.\n` +
                                `Allergies: ${allergies}.\n\n` +
                                `I have the full profile. What are the presenting symptoms?`
                        }]);
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
            setIsStreaming(false);
        }
    };

    return (
        <div className="flex h-screen overflow-hidden font-sans selection:bg-claude-accent/20 bg-claude-bg dark:bg-claude-darkBg transition-colors duration-500">
            <Sidebar
                isDarkMode={isDarkMode}
                toggleTheme={toggleTheme}
                activePatient={activePatient}
                isIntakeMode={isIntakeMode}
                startNewIntake={startNewIntake}
                setActivePatient={setActivePatient}
                setIsIntakeMode={setIsIntakeMode}
            />

            <main className="flex-1 flex flex-col relative bg-claude-bg dark:bg-claude-darkBg transition-colors duration-500">
                {isIntakeMode ? (
                    <IntakeView
                        intakeMessages={intakeMessages}
                        isStreaming={isStreaming}
                        isLoading={isLoading}
                        chatMessage={chatMessage}
                        setChatMessage={setChatMessage}
                        handleIntakeSend={handleIntakeSend}
                        handleIntakeRetry={handleIntakeRetry}
                    />
                ) : !activePatient ? (
                    <LandingPage
                        greeting={greeting}
                        patients={patients}
                        startNewIntake={startNewIntake}
                        handlePatientSelect={handlePatientSelect}
                    />
                ) : (
                    <ConsultationView
                        activePatient={activePatient}
                        activeSession={activeSession}
                        messages={messages}
                        isLoading={isLoading}
                        isStreaming={isStreaming}
                        chatMessage={chatMessage}
                        setChatMessage={setChatMessage}
                        handleSend={handleSend}
                        handleRetry={handleRetry}
                        uploadError={uploadError}
                        setUploadError={setUploadError}
                        uploadingFile={uploadingFile}
                        uploadFileName={uploadFileName}
                        handleFileUpload={handleFileUpload}
                    />
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
