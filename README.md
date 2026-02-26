<div align="center">

<img src="frontend/src/assets/mascot.png" alt="DocOc Mascot" width="160" />

# 🩺 DocOc — Local AI Medical Assistant

**A private, offline-first AI diagnostic assistant for doctors.**  
Built with a local LLM (Ollama · phi3), RAG-powered patient records, and a beautiful Claude-inspired UI.

[![FastAPI](https://img.shields.io/badge/FastAPI-0.110+-009688?style=flat-square&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-18+-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-5+-646CFF?style=flat-square&logo=vite&logoColor=white)](https://vitejs.dev/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3+-38BDF8?style=flat-square&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Ollama](https://img.shields.io/badge/Ollama-phi3-black?style=flat-square&logo=ollama&logoColor=white)](https://ollama.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)

</div>

---

## 📌 What is DocOc?

**DocOc** is a fully **local, privacy-first AI medical assistant** designed for doctors and clinicians. It runs entirely on your own machine — no cloud, no data leaks, no subscriptions.

Using **Retrieval-Augmented Generation (RAG)**, DocOc ingests patient documents and uses that knowledge to provide context-aware clinical insights, differential diagnoses, and recommended tests — powered by the `phi3` language model running via **Ollama**.

> 💡 Everything stays on your machine. Patient data never leaves your system.

---

## ✨ Features

| Feature | Description |
|---|---|
| 🤖 **AI Diagnostic Chat** | Ask questions about a patient and get clinical insights powered by a local LLM |
| 📋 **Smart Patient Intake** | Conversational AI gathers patient name, age, gender, and medical history automatically |
| 📄 **RAG Document Engine** | Upload patient documents; the AI retrieves relevant context before answering |
| 🔍 **Patient Search** | Browse and search through all consultation sessions |
| 🌙 **Dark / Light Mode** | Premium Claude-inspired UI with full theme support |
| ⚡ **Streaming Responses** | Token-by-token streaming for a real-time feel |
| 🔒 **100% Offline & Private** | No API keys, no cloud — Ollama runs the model locally |

---

## 🏗️ Architecture

```
DocOc/
├── backend/                  # FastAPI Python backend
│   ├── main.py               # API routes (chat, intake, patients, documents)
│   ├── database.py           # SQLAlchemy models & SQLite DB setup
│   └── rag_engine.py         # RAG indexing & retrieval (ChromaDB / similar)
│
├── frontend/                 # React + Vite frontend
│   └── src/
│       ├── pages/
│       │   └── Dashboard.jsx # Main app: intake, chat, patient list
│       ├── components/
│       │   └── PixelMascot.jsx  # The animated mascot 🐾
│       └── assets/
│           └── mascot.png    # DocOc mascot image
│
├── scripts/
│   ├── start.ps1             # 🪟 Windows one-click launcher
│   └── start.sh              # 🐧 Linux/macOS one-click launcher
│
├── data/                     # Patient documents (auto-created, gitignored)
└── package.json              # Root scripts for dev
```

---

## 🚀 Getting Started

### Prerequisites

Make sure you have the following installed:

- 🐍 **Python 3.10+**
- 🟢 **Node.js 18+** & npm
- 🦙 **[Ollama](https://ollama.com/)** — to run the local LLM

### 1. Clone the Repository

```bash
git clone https://github.com/siddheshvrane/DocOck.git
cd DocOck
```

### 2. Pull the AI Model

```bash
ollama pull phi3
```

### 3. Install Backend Dependencies

```bash
cd backend
pip install fastapi uvicorn sqlalchemy python-multipart requests chromadb
```

### 4. Install Frontend Dependencies

```bash
cd frontend
npm install
```

---

## ▶️ Running the App

### 🪟 Windows (Recommended)

```powershell
.\scripts\start.ps1
```

This script automatically:
1. ✅ Checks that Ollama is installed
2. 🚀 Starts the FastAPI backend on **port 8000**
3. 📦 Installs frontend dependencies if needed
4. 🌐 Starts the Vite dev server on **port 5173**

### 🐧 Linux / macOS

```bash
bash scripts/start.sh
```

### Manual Start

```bash
# Terminal 1 — Backend
cd backend
python -m uvicorn main:app --reload --port 8000

# Terminal 2 — Frontend
cd frontend
npm run dev
```

Then open **[http://localhost:5173](http://localhost:5173)** in your browser.

---

## 🔌 API Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/greeting` | Returns a dynamic LLM-generated greeting |
| `POST` | `/chat/intake` | Conversational patient intake (streaming) |
| `POST` | `/chat/generate` | RAG-powered clinical chat (streaming) |
| `GET` | `/patients/` | List all patients |
| `POST` | `/patients/` | Create a patient manually |
| `POST` | `/patients/{id}/sessions/` | Create a consultation session |
| `POST` | `/patients/{id}/documents/` | Upload a patient document for RAG |

> 📖 Full interactive API docs: **[http://localhost:8000/docs](http://localhost:8000/docs)**

---

## 🧠 How RAG Works

```
Doctor uploads document
         ↓
   Document is chunked
         ↓
   Chunks embedded & stored in vector DB
         ↓
   Doctor asks a clinical question
         ↓
   Relevant chunks retrieved from vector DB
         ↓
   Context + question sent to phi3 (via Ollama)
         ↓
   Streamed clinical response returned to UI
```

This ensures **answers are grounded in actual patient data** rather than hallucinated by the model.

---

## 🎨 UI Highlights

<div align="center">
<img src="frontend/src/assets/mascot.png" alt="DocOc — Private & Local" width="80" />
<br/>
<sub><b>DocOc • Private & Local</b></sub>
</div>

- **Claude-inspired design language** with a warm, professional palette
- **Pixel mascot** on the landing page with smooth animations
- **Real-time streaming** chat with token-by-token rendering
- **Dark mode** with smooth transitions
- **Responsive layout** with animated patient intake flow

---

## 🛣️ Roadmap

- [ ] 📊 Patient vitals chart panel
- [ ] 🖨️ Export consultation reports as PDF
- [ ] 📁 Support for DICOM imaging files
- [ ] 🔐 Doctor login / auth flow
- [ ] 🌐 Multi-language support
- [ ] 📱 Mobile-responsive layout

---

## 🤝 Contributing

Contributions are welcome! Please open an issue first to discuss what you'd like to change.

```bash
# Fork the repo, then:
git checkout -b feature/your-feature
git commit -m "feat: add your feature"
git push origin feature/your-feature
# Open a Pull Request 🎉
```

---

## 📜 License

This project is licensed under the **MIT License**. See [LICENSE](LICENSE) for details.

---

<div align="center">

Made with ❤️ by [Siddhesh Vrane](https://github.com/siddheshvrane)

<img src="frontend/src/assets/mascot.png" width="48" />

*DocOc — because your patients' data deserves to stay private.*

</div>
