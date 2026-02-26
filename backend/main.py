from fastapi import FastAPI, Depends, HTTPException, UploadFile, File
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List, Optional
import os
import requests
import json
import shutil
import sys

import sys
import re

# Ensure backend directory is in path for imports
sys.path.append(os.path.dirname(__file__))

import database
import rag_engine
from database import get_db, init_db

app = FastAPI(title="DocOc API")

# CORS for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize DB on startup
@app.on_event("startup")
def startup_event():
    try:
        init_db()
    except Exception as e:
        print(f"Database initialization failed: {e}")

@app.get("/greeting")
def get_greeting():
    import datetime
    now = datetime.datetime.now()
    hour = now.hour
    
    if hour < 12:
        time_context = "morning"
    elif hour < 18:
        time_context = "afternoon"
    else:
        time_context = "evening"
    
    prompt = f"Generate a very short, friendly, and professional one-line greeting for a doctor from their medical AI assistant named DocOc. The current time is {time_context}. Output ONLY the greeting, nothing else."
    
    try:
        payload = {
            "model": "phi3",
            "prompt": prompt,
            "stream": False
        }
        # Using a shorter timeout for the greeting to keep the UI snappy
        response = requests.post("http://localhost:11434/api/generate", json=payload, timeout=10)
        response.raise_for_status()
        greeting = response.json().get("response", "").strip()
        return {"greeting": greeting}
    except Exception as e:
        print(f"Greeting generation failed: {e}")
        # High-quality fallbacks if LLM is unavailable
        if hour < 12:
            return {"greeting": "Good morning, Doctor. Ready for today's records?"}
        elif hour < 18:
            return {"greeting": "Good afternoon, Doctor. How can I help you today?"}
        else:
            return {"greeting": "Good evening, Doctor. Need help wrapping up?"}

# Ollama Integration
OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434/api/generate")
OLLAMA_CHAT_URL = os.getenv("OLLAMA_CHAT_URL", "http://localhost:11434/api/chat")
MODEL_NAME = "phi3" 

@app.post("/chat/generate")
def generate_response(prompt: str, session_id: int, db: Session = Depends(get_db)):
    session = db.query(database.ChatSession).filter(database.ChatSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    engine = rag_engine.RAGEngine(session.patient_id)
    context_chunks = engine.query(prompt)
    context = "\n".join(context_chunks)
    
    system_prompt = f"You are DocOc, an expert AI medical diagnostic assistant. Use the following patient records context to deeply analyze the doctor's query. Context:\n{context}\n\nInstructions:\n1. carefully consider the symptoms provided.\n2. Diagnose the likely disease or medical condition based on the symptoms and RAG context.\n3. If the symptoms are ambiguous or multiple conditions are possible, explicitly state this and recommend the specific medical tests or exams the patient should undergo to confirm the diagnosis.\n4. Keep your answer professional, clinical, and structured."
    
    # Retrieve past messages for context
    past_messages = db.query(database.ChatMessage).filter(database.ChatMessage.session_id == session_id).order_by(database.ChatMessage.timestamp).all()
    
    messages = [{"role": "system", "content": system_prompt}]
    for msg in past_messages:
        messages.append({"role": msg.role, "content": msg.content})
    messages.append({"role": "user", "content": prompt})
    
    def event_generator():
        payload = {
            "model": MODEL_NAME,
            "messages": messages,
            "stream": True,
            "keep_alive": "1h",
            "options": { "num_predict": 300 } # Limit generation to return faster
        }
        
        full_response = ""
        try:
            with requests.post(OLLAMA_CHAT_URL, json=payload, stream=True, timeout=120) as r:
                r.raise_for_status()
                for line in r.iter_lines():
                    if line:
                        chunk = json.loads(line)
                        token = chunk.get("message", {}).get("content", "")
                        full_response += token
                        yield token
            
            # Save to DB after stream finishes
            new_db = database.SessionLocal()
            try:
                user_msg = database.ChatMessage(session_id=session_id, role="user", content=prompt)
                ai_msg = database.ChatMessage(session_id=session_id, role="assistant", content=full_response)
                new_db.add(user_msg)
                new_db.add(ai_msg)
                new_db.commit()
            finally:
                new_db.close()
                
        except Exception as e:
            print(f"Ollama stream error: {e}")
            yield f"\n[AI model error: {str(e)}]"

    return StreamingResponse(event_generator(), media_type="text/plain")

# Intake Flow
INTAKE_SYSTEM_PROMPT = """You are DocOc, a helpful AI medical receptionist. Your goal is to gather EXACTLY 4 pieces of information from the doctor about a new patient:
1. Patient's Full Name
2. Patient's Age
3. Patient's Gender
4. Patient's Medical History (Specifically ask about past diseases like diabetes, high blood pressure, asthma, etc.)

Instructions for the conversation:
- Be polite, concise, and professional.
- Ask one or two questions at a time.
- DO NOT output JSON blocks or XML tags while you are asking questions.
- If the doctor's answer is unclear, ask for clarification.

CRITICAL INSTRUCTION FOR COMPLETION:
When (and ONLY when) you have gathered ALL 4 pieces of information to your satisfaction, you must output a special completion token.
Your VERY LAST message must start EXACTLY with the string "__DONE__" followed by a JSON block, like this:
__DONE__{"name": "Jane Doe", "age": 45, "gender": "Female", "medical_history": "Type 2 Diabetes, High Blood Pressure"}

Do not output __DONE__ until you have all 4 pieces of information.
"""

from pydantic import BaseModel
class IntakeMessage(BaseModel):
    role: str
    content: str
    
class IntakeRequest(BaseModel):
    messages: List[IntakeMessage]

@app.post("/chat/intake")
def handle_intake(request: IntakeRequest):
    messages = [{"role": "system", "content": INTAKE_SYSTEM_PROMPT}]
    for m in request.messages:
        messages.append({"role": "user" if m.role == "user" else "assistant", "content": m.content})
    
    def event_generator():
        payload = {
            "model": MODEL_NAME,
            "messages": messages,
            "stream": True,
            "keep_alive": "1h",
            "options": { "num_predict": 250 } # Keep receptionist short and quick
        }
        
        full_response = ""
        tag_detected = False
        
        try:
            with requests.post(OLLAMA_CHAT_URL, json=payload, stream=True, timeout=120) as r:
                r.raise_for_status()
                for line in r.iter_lines():
                    if line:
                        chunk = json.loads(line)
                        token = chunk.get("message", {}).get("content", "")
                        full_response += token
                        
                        # Stop yielding visible text if we hit the JSON tag
                        if "__DONE__" in full_response:
                            tag_detected = True
                            
                        # Only yield to the user if we aren't writing the secret JSON tag
                        if not tag_detected:
                            # Strip accidental backticks from response
                            yield token.replace("```json", "").replace("```", "")

            # Once the stream finishes completely, check if the JSON tag was generated
            if "__DONE__" in full_response:
                try:
                    # Extract JSON
                    json_str = full_response.split("__DONE__")[1].strip()
                    json_str = json_str.replace("```json", "").replace("```", "").strip()
                    data = json.loads(json_str)
                    
                    new_db = database.SessionLocal()
                    try:
                        # Create patient in DB
                        db_patient = database.Patient(
                            name=data.get("name", "Unknown"),
                            age=int(data.get("age", 0)),
                            gender=data.get("gender", "Unknown"),
                            medical_history=data.get("medical_history", "None reported")
                        )
                        new_db.add(db_patient)
                        new_db.commit()
                        new_db.refresh(db_patient)
                        
                        # Create initial session
                        session = database.ChatSession(patient_id=db_patient.id, title="Initial Consultation")
                        new_db.add(session)
                        new_db.commit()
                        new_db.refresh(session)
                        
                        complete_data = {
                            "status": "complete",
                            "patient": {
                                "id": db_patient.id,
                                "name": db_patient.name,
                                "age": db_patient.age,
                                "gender": db_patient.gender,
                                "medical_history": db_patient.medical_history
                            },
                            "session_id": session.id
                        }
                        # Yield a special identifiable token for the frontend to parse
                        yield f"__INTAKE_COMPLETE__{json.dumps(complete_data)}"
                    finally:
                        new_db.close()
                except Exception as parse_error:
                    print(f"Failed to parse intake JSON: {parse_error}. Text was: {full_response}")
                    yield "\nCould you clarify the name, age, gender, and medical history again? I missed something."
                    
        except Exception as e:
            print(f"Intake stream error: {e}")
            yield f"\n[AI model error: {str(e)}]"

    return StreamingResponse(event_generator(), media_type="text/plain")

# Patient Management
@app.post("/patients/")
def create_patient(name: str, age: int, gender: str, medical_history: Optional[str] = None, db: Session = Depends(get_db)):
    try:
        db_patient = database.Patient(name=name, age=age, gender=gender, medical_history=medical_history)
        db.add(db_patient)
        db.commit()
        db.refresh(db_patient)
        return {
            "id": db_patient.id,
            "name": db_patient.name,
            "age": db_patient.age,
            "gender": db_patient.gender,
            "medical_history": db_patient.medical_history
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/patients/")
def list_patients(db: Session = Depends(get_db)):
    try:
        print("Fetching patients from database...")
        patients = db.query(database.Patient).all()
        print(f"Found {len(patients)} patients.")
        return [
            {
                "id": p.id,
                "name": p.name,
                "age": p.age,
                "gender": p.gender,
                "medical_history": p.medical_history
            } for p in patients
        ]
    except Exception as e:
        import traceback
        error_msg = f"Error listing patients: {str(e)}\n{traceback.format_exc()}"
        print(error_msg)
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@app.post("/patients/{patient_id}/sessions/")
def create_session(patient_id: int, title: str = "New Consultation", db: Session = Depends(get_db)):
    session = database.ChatSession(patient_id=patient_id, title=title)
    db.add(session)
    db.commit()
    db.refresh(session)
    return {"id": session.id, "patient_id": session.patient_id, "title": session.title}

# Document Handling
@app.post("/patients/{patient_id}/documents/")
async def upload_document(patient_id: int, file: UploadFile = File(...), db: Session = Depends(get_db)):
    upload_dir = os.path.join("data", "documents", str(patient_id))
    os.makedirs(upload_dir, exist_ok=True)
    
    file_path = os.path.join(upload_dir, file.filename)
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    db_doc = database.Document(
        patient_id=patient_id,
        filename=file.filename,
        file_path=file_path,
        file_type=file.content_type
    )
    db.add(db_doc)
    db.commit()
    
    try:
        rag_engine.process_patient_document(patient_id, file_path)
    except Exception as e:
        print(f"RAG indexing error: {e}")
    
    return {"status": "success", "filename": file.filename}
