from fastapi import FastAPI, Depends, HTTPException, UploadFile, File
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
from datetime import date, datetime
import os
import requests
import json
import shutil
import sys
import re

# Ensure backend directory is in path for imports
sys.path.append(os.path.dirname(__file__))

import database
import rag_engine
import ocr_engine
from database import get_db, init_db

app = FastAPI(title="DocOc API")

# CORS for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def startup_event():
    try:
        init_db()
    except Exception as e:
        print(f"Database initialization failed: {e}")

# ─────────────────────────────────────────────────────────────
# Ollama config
# ─────────────────────────────────────────────────────────────
OLLAMA_URL      = os.getenv("OLLAMA_URL",      "http://localhost:11434/api/generate")
OLLAMA_CHAT_URL = os.getenv("OLLAMA_CHAT_URL", "http://localhost:11434/api/chat")
MODEL_NAME      = "phi3"

# ─────────────────────────────────────────────────────────────
# Greeting
# ─────────────────────────────────────────────────────────────
@app.get("/greeting")
def get_greeting():
    now = datetime.now()
    hour = now.hour
    if hour < 12:
        time_context = "morning"
    elif hour < 18:
        time_context = "afternoon"
    else:
        time_context = "evening"

    prompt = (
        f"Generate a very short, friendly, and professional one-line greeting for a doctor "
        f"from their medical AI assistant named DocOc. The current time is {time_context}. "
        f"Output ONLY the greeting, nothing else."
    )
    try:
        payload = {"model": MODEL_NAME, "prompt": prompt, "stream": False}
        response = requests.post(OLLAMA_URL, json=payload, timeout=10)
        response.raise_for_status()
        greeting = response.json().get("response", "").strip()
        return {"greeting": greeting}
    except Exception:
        if hour < 12:
            return {"greeting": "Good morning, Doctor. Ready for today's records?"}
        elif hour < 18:
            return {"greeting": "Good afternoon, Doctor. How can I help you today?"}
        else:
            return {"greeting": "Good evening, Doctor. Need help wrapping up?"}

# ─────────────────────────────────────────────────────────────
# Pydantic schemas
# ─────────────────────────────────────────────────────────────
class PatientCreate(BaseModel):
    name:                str
    dob:                 date               # YYYY-MM-DD
    sex:                 str                # Male / Female / Other
    blood_group:         Optional[str]  = None
    contact_number:      Optional[str]  = None
    emergency_contact:   Optional[str]  = None
    address:             Optional[str]  = None
    allergies:           Optional[str]  = None
    chronic_conditions:  Optional[str]  = None
    current_medications: Optional[str]  = None
    surgical_history:    Optional[str]  = None
    family_history:      Optional[str]  = None
    lifestyle_notes:     Optional[str]  = None
    insurance_info:      Optional[str]  = None

class PatientUpdate(BaseModel):
    name:                Optional[str]  = None
    dob:                 Optional[date] = None
    sex:                 Optional[str]  = None
    blood_group:         Optional[str]  = None
    contact_number:      Optional[str]  = None
    emergency_contact:   Optional[str]  = None
    address:             Optional[str]  = None
    allergies:           Optional[str]  = None
    chronic_conditions:  Optional[str]  = None
    current_medications: Optional[str]  = None
    surgical_history:    Optional[str]  = None
    family_history:      Optional[str]  = None
    lifestyle_notes:     Optional[str]  = None
    insurance_info:      Optional[str]  = None

class IntakeMessage(BaseModel):
    role:    str
    content: str

class IntakeRequest(BaseModel):
    messages: List[IntakeMessage]

# ─────────────────────────────────────────────────────────────
# Patient CRUD
# ─────────────────────────────────────────────────────────────
@app.post("/patients/")
def create_patient(payload: PatientCreate, db: Session = Depends(get_db)):
    """Create a new patient record."""
    try:
        db_patient = database.Patient(**payload.dict())
        db.add(db_patient)
        db.commit()
        db.refresh(db_patient)
        return db_patient.to_dict()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/patients/")
def list_patients(db: Session = Depends(get_db)):
    """Return all patients with full profile and computed age."""
    try:
        patients = db.query(database.Patient).order_by(database.Patient.name).all()
        return [p.to_dict() for p in patients]
    except Exception as e:
        import traceback
        print(f"Error listing patients: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@app.get("/patients/{patient_id}")
def get_patient(patient_id: int, db: Session = Depends(get_db)):
    """Return a single patient's full profile."""
    p = db.query(database.Patient).filter(database.Patient.id == patient_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Patient not found")
    return p.to_dict()

@app.put("/patients/{patient_id}")
def update_patient(patient_id: int, payload: PatientUpdate, db: Session = Depends(get_db)):
    """Partially update a patient record."""
    p = db.query(database.Patient).filter(database.Patient.id == patient_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Patient not found")
    for field, value in payload.dict(exclude_unset=True).items():
        setattr(p, field, value)
    p.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(p)
    return p.to_dict()

@app.delete("/patients/{patient_id}")
def delete_patient(patient_id: int, db: Session = Depends(get_db)):
    """Delete a patient and all related data."""
    p = db.query(database.Patient).filter(database.Patient.id == patient_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Patient not found")
    db.delete(p)
    db.commit()
    return {"status": "deleted", "patient_id": patient_id}

# ─────────────────────────────────────────────────────────────
# Sessions
# ─────────────────────────────────────────────────────────────
@app.post("/patients/{patient_id}/sessions/")
def create_session(patient_id: int, title: str = "New Consultation", db: Session = Depends(get_db)):
    p = db.query(database.Patient).filter(database.Patient.id == patient_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Patient not found")
    session = database.ChatSession(patient_id=patient_id, title=title)
    db.add(session)
    db.commit()
    db.refresh(session)
    return {"id": session.id, "patient_id": session.patient_id, "title": session.title}

@app.get("/patients/{patient_id}/conversations/")
def get_conversations(patient_id: int, db: Session = Depends(get_db)):
    """Return all chat sessions + messages for a patient (doctor↔AI history)."""
    p = db.query(database.Patient).filter(database.Patient.id == patient_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Patient not found")
    sessions = (
        db.query(database.ChatSession)
        .filter(database.ChatSession.patient_id == patient_id)
        .order_by(database.ChatSession.created_at.desc())
        .all()
    )
    return {
        "patient_id": patient_id,
        "patient_name": p.name,
        "sessions": [s.to_dict() for s in sessions],
    }

# ─────────────────────────────────────────────────────────────
# Reports (one-to-many: Patient → PatientReport)
# ─────────────────────────────────────────────────────────────
ALLOWED_EXTENSIONS = {
    "application/pdf",
    "image/png", "image/jpeg", "image/jpg",
    "image/tiff", "image/bmp", "image/webp",
}

@app.post("/patients/{patient_id}/upload-report/")
async def upload_report(
    patient_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """
    Upload a patient report (PDF or image).
    1. Save to disk.
    2. Run EasyOCR → extract text.
    3. Store as PatientReport row (ocr_text, summary, insights).
    4. Index into patient RAG vector store.
    5. Return insights JSON.
    """
    patient = db.query(database.Patient).filter(database.Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    upload_dir = os.path.join("data", "reports", str(patient_id))
    os.makedirs(upload_dir, exist_ok=True)
    file_path = os.path.join(upload_dir, file.filename)

    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"File save failed: {e}")

    # Run OCR
    try:
        result = ocr_engine.process_report(file_path)
    except ValueError as ve:
        raise HTTPException(status_code=415, detail=str(ve))
    except Exception as e:
        print(f"OCR processing error: {e}")
        raise HTTPException(status_code=500, detail=f"OCR failed: {str(e)}")

    ocr_text = result.get("ocr_text", "")
    summary  = result.get("summary", "")
    insights = result.get("insights", {})

    # Build a human-readable report name: filename + date
    report_name = f"{os.path.splitext(file.filename)[0]} — {datetime.utcnow().strftime('%d %b %Y')}"

    # Persist to PatientReport table
    db_report = database.PatientReport(
        patient_id  = patient_id,
        report_name = report_name,
        filename    = file.filename,
        file_path   = file_path,
        file_type   = file.content_type or "application/octet-stream",
        ocr_text    = ocr_text,
        summary     = summary,
        insights    = json.dumps(insights),
    )
    db.add(db_report)
    db.commit()
    db.refresh(db_report)

    # Index extracted text into the patient's RAG vector store
    if ocr_text.strip():
        try:
            txt_path = file_path + "_ocr.txt"
            with open(txt_path, "w", encoding="utf-8") as f:
                f.write(f"Patient Report: {file.filename}\n\n{ocr_text}")
            rag_engine.index_text_document(patient_id, txt_path, ocr_text)
        except Exception as e:
            print(f"RAG indexing error (non-fatal): {e}")

    return {
        "status":         "success",
        "report_id":      db_report.id,
        "report_name":    report_name,
        "filename":       file.filename,
        "page_count":     result.get("page_count", 1),
        "insights":       insights,
        "summary":        summary,
        "ocr_text_length": len(ocr_text),
    }

@app.get("/patients/{patient_id}/reports/")
def list_reports(patient_id: int, db: Session = Depends(get_db)):
    """List all uploaded reports for a patient."""
    patient = db.query(database.Patient).filter(database.Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    reports = (
        db.query(database.PatientReport)
        .filter(database.PatientReport.patient_id == patient_id)
        .order_by(database.PatientReport.uploaded_at.desc())
        .all()
    )
    return {
        "patient_id":   patient_id,
        "patient_name": patient.name,
        "reports":      [r.to_dict() for r in reports],
    }

@app.get("/patients/{patient_id}/reports/{report_id}")
def get_report(patient_id: int, report_id: int, db: Session = Depends(get_db)):
    """Get a single report's full details including OCR text."""
    report = (
        db.query(database.PatientReport)
        .filter(
            database.PatientReport.id == report_id,
            database.PatientReport.patient_id == patient_id
        )
        .first()
    )
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    return report.to_dict()

# ─────────────────────────────────────────────────────────────
# Document uploads (non-report: prescriptions, letters, etc.)
# ─────────────────────────────────────────────────────────────
@app.post("/patients/{patient_id}/documents/")
async def upload_document(patient_id: int, file: UploadFile = File(...), db: Session = Depends(get_db)):
    patient = db.query(database.Patient).filter(database.Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

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

# ─────────────────────────────────────────────────────────────
# AI Diagnostic Chat
# ─────────────────────────────────────────────────────────────
@app.post("/chat/generate")
def generate_response(prompt: str, session_id: int, db: Session = Depends(get_db)):
    session = db.query(database.ChatSession).filter(database.ChatSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    patient = db.query(database.Patient).filter(database.Patient.id == session.patient_id).first()

    # Build rich patient context for the AI
    patient_ctx = ""
    if patient:
        def val(x, default="Not recorded"):
            return x if x and str(x).strip() and str(x).strip().lower() not in ("none reported", "none", "") else default

        patient_ctx = f"""PATIENT PROFILE (from medical records — DO NOT ask the doctor for any of this):
  Name            : {val(patient.name)}
  Age             : {patient.age} years  (DOB: {patient.dob})
  Sex             : {val(patient.sex)}
  Blood Group     : {val(patient.blood_group)}
  Allergies       : {val(patient.allergies, 'None known')}
  Chronic Conditions: {val(patient.chronic_conditions, 'None known')}
  Current Medications: {val(patient.current_medications, 'None reported')}
  Surgical History: {val(patient.surgical_history, 'None')}
  Family History  : {val(patient.family_history)}
  Lifestyle Notes : {val(patient.lifestyle_notes)}"""

    # Pull all uploaded report summaries from the DB
    reports = (
        db.query(database.PatientReport)
        .filter(database.PatientReport.patient_id == session.patient_id)
        .order_by(database.PatientReport.uploaded_at.desc())
        .all()
    )
    report_ctx = ""
    if reports:
        report_lines = []
        for r in reports:
            summary = r.summary or ""
            ocr_preview = (r.ocr_text or "")[:400].strip()
            report_lines.append(
                f"  [{r.report_name}]\n"
                f"    Summary  : {summary or 'No summary available'}\n"
                f"    OCR Snippet: {ocr_preview or 'No text extracted'}..."
            )
        report_ctx = "UPLOADED PATIENT REPORTS:\n" + "\n".join(report_lines)
    else:
        report_ctx = "UPLOADED PATIENT REPORTS: None uploaded yet."

    # RAG context from indexed documents / reports
    engine = rag_engine.RAGEngine(session.patient_id)
    context_chunks = engine.query(prompt)
    rag_context = "\n".join(context_chunks) if context_chunks else "No additional indexed documents."

    system_prompt = f"""You are DocOc, an expert AI clinical decision support assistant helping a doctor during a live consultation.

{patient_ctx}

{report_ctx}

RELEVANT RAG CONTEXT (from indexed documents):
{rag_context}

CRITICAL INSTRUCTIONS — follow these exactly:
1. The patient profile above is authoritative. NEVER ask the doctor for demographic info (name, age, sex, DOB, blood group) — you already have it.
2. NEVER invent or assume medical data not present above. If a field says "Not recorded" or "None known", treat it as absent.
3. When the doctor describes symptoms, immediately reason clinically:
   a. List the most probable diagnosis and differential diagnoses (ranked by likelihood).
   b. Cite specific evidence from the patient profile or reports that supports each differential.
   c. Recommend confirmatory investigations or tests (e.g. CBC, LFT, CT scan, LP) with rationale.
   d. Flag any red flags, contraindications, or drug interactions relevant to this patient's history and allergies.
4. Be concise and structured. Use numbered lists and clear headings. No unnecessary pleasantries.
5. If the doctor asks a non-symptom question (e.g. drug dosage, lab reference ranges), answer it directly and clinically."""

    past_messages = (
        db.query(database.ChatMessage)
        .filter(database.ChatMessage.session_id == session_id)
        .order_by(database.ChatMessage.timestamp)
        .all()
    )

    messages = [{"role": "system", "content": system_prompt}]
    for msg in past_messages:
        messages.append({"role": msg.role, "content": msg.content})
    messages.append({"role": "user", "content": prompt})

    def event_generator():
        payload = {
            "model":      MODEL_NAME,
            "messages":   messages,
            "stream":     True,
            "keep_alive": "1h",
            "options":    {"num_predict": 500},
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

            new_db = database.SessionLocal()
            try:
                user_msg = database.ChatMessage(session_id=session_id, role="user",      content=prompt)
                ai_msg   = database.ChatMessage(session_id=session_id, role="assistant", content=full_response)
                new_db.add(user_msg)
                new_db.add(ai_msg)
                new_db.commit()
            finally:
                new_db.close()
        except Exception as e:
            print(f"Ollama stream error: {e}")
            yield f"\n[AI model error: {str(e)}]"

    return StreamingResponse(event_generator(), media_type="text/plain")

# ─────────────────────────────────────────────────────────────
# Patient Intake (conversational patient registration)
# ─────────────────────────────────────────────────────────────
INTAKE_SYSTEM_PROMPT = """You are DocOc, a medical data recorder having a short conversation with a doctor to register a new patient.

Your ONLY two jobs are:
  A) Ask for the next missing required field using a single plain-English question.
  B) When all required fields are known, output the magic tag __DONE__ followed by the JSON object.

REQUIRED fields (collect all 5 before finishing):
  1. Patient's Full Name
  2. Patient's Date of Birth
  3. Patient's Sex (Male / Female / Other)
  4. Chronic Medical Conditions (or "None" if none)
  5. Known Allergies (or "None" if none)

OPTIONAL — capture if the doctor mentions it:
  - Blood Group (e.g. O+, A-, B+)

STRICT OUTPUT RULES — violating these is a critical failure:
- Your reply must be ONE short plain-English question asking for the single next missing field.
- NEVER output curly braces {{ }} or any JSON before the __DONE__ tag. No exceptions.
- NEVER echo back, confirm, or summarise what the doctor told you. Just ask the next question.
- NEVER ask about a field the doctor already answered.
- If the doctor says there are no conditions / no allergies, accept it immediately — do not probe further.
- Convert any human-readable date ("1 Dec 1979", "Dec 1 1979", "01/12/1979") to YYYY-MM-DD yourself.
- Never fabricate data. Only use exactly what the doctor said.

FINAL OUTPUT (only after all 5 required fields are known):
Output EXACTLY this on one line — nothing before, nothing after:
__DONE__{"name": "VALUE", "dob": "YYYY-MM-DD", "sex": "VALUE", "chronic_conditions": "VALUE", "allergies": "VALUE"}

Include "blood_group" key only if the doctor provided it.
"""

@app.post("/chat/intake")
def handle_intake(request: IntakeRequest):
    messages = [{"role": "system", "content": INTAKE_SYSTEM_PROMPT}]
    for m in request.messages:
        messages.append({"role": "user" if m.role == "user" else "assistant", "content": m.content})

    def event_generator():
        payload = {
            "model":      MODEL_NAME,
            "messages":   messages,
            "stream":     True,
            "keep_alive": "1h",
            "options":    {"num_predict": 250},
        }
        full_response = ""
        tag_detected  = False

        try:
            with requests.post(OLLAMA_CHAT_URL, json=payload, stream=True, timeout=120) as r:
                r.raise_for_status()
                for line in r.iter_lines():
                    if line:
                        chunk = json.loads(line)
                        token = chunk.get("message", {}).get("content", "")
                        full_response += token

                        if "__DONE__" in full_response:
                            tag_detected = True

                        if not tag_detected:
                            # Strip any JSON blobs the model leaks before __DONE__
                            clean = re.sub(r'\{[^}]*\}', '', token)
                            clean = clean.replace("```json", "").replace("```", "")
                            if clean.strip():
                                yield clean

            if "__DONE__" in full_response:
                try:
                    json_str = full_response.split("__DONE__")[1].strip()
                    json_str = json_str.replace("```json", "").replace("```", "").strip()
                    data = json.loads(json_str)

                    new_db = database.SessionLocal()
                    try:
                        # Parse DOB — accept YYYY-MM-DD or fall back gracefully
                        dob_raw = data.get("dob", "")
                        try:
                            parsed_dob = datetime.strptime(dob_raw, "%Y-%m-%d").date()
                        except Exception:
                            parsed_dob = date(2000, 1, 1)   # fallback; doctor can update later

                        db_patient = database.Patient(
                            name=               data.get("name",               "Unknown"),
                            dob=                parsed_dob,
                            sex=                data.get("sex",                "Unknown"),
                            chronic_conditions= data.get("chronic_conditions", "None reported"),
                            allergies=          data.get("allergies",          "None reported"),
                            blood_group=        data.get("blood_group",        None),
                        )
                        new_db.add(db_patient)
                        new_db.commit()
                        new_db.refresh(db_patient)

                        session = database.ChatSession(
                            patient_id=db_patient.id,
                            title="Initial Consultation"
                        )
                        new_db.add(session)
                        new_db.commit()
                        new_db.refresh(session)

                        complete_data = {
                            "status":     "complete",
                            "patient":    db_patient.to_dict(),
                            "session_id": session.id,
                        }
                        yield f"__INTAKE_COMPLETE__{json.dumps(complete_data)}"
                    finally:
                        new_db.close()
                except Exception as parse_error:
                    print(f"Failed to parse intake JSON: {parse_error}. Text: {full_response}")
                    yield "\nCould you clarify the name, date of birth, sex, conditions, and allergies? I missed something."

        except Exception as e:
            print(f"Intake stream error: {e}")
            yield f"\n[AI model error: {str(e)}]"

    return StreamingResponse(event_generator(), media_type="text/plain")
