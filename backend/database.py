from sqlalchemy import (
    create_engine, Column, Integer, String, Text,
    DateTime, Date, ForeignKey, event
)
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime, date
import os

# ─────────────────────────────────────────────────────────────
# DB Setup
# ─────────────────────────────────────────────────────────────
BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BACKEND_DIR, "data")
os.makedirs(DATA_DIR, exist_ok=True)

DATABASE_URL = f"sqlite:///{os.path.join(DATA_DIR, 'dococ.db')}"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})

# Enable WAL mode for better concurrent reads
@event.listens_for(engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.close()

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


# ─────────────────────────────────────────────────────────────
# Patient — core demographics + medical background
# ─────────────────────────────────────────────────────────────
class Patient(Base):
    __tablename__ = "patients"

    id                  = Column(Integer, primary_key=True, index=True)

    # ── Identity ──────────────────────────────────────────────
    name                = Column(String,  nullable=False, index=True)
    dob                 = Column(Date,    nullable=False)          # date of birth
    sex                 = Column(String,  nullable=False)          # Male / Female / Other

    # ── Contact ───────────────────────────────────────────────
    contact_number      = Column(String,  nullable=True)
    emergency_contact   = Column(String,  nullable=True)          # name + phone
    address             = Column(Text,    nullable=True)

    # ── Clinical background ────────────────────────────────────
    blood_group         = Column(String,  nullable=True)          # A+, B-, O+, AB+, …
    allergies           = Column(Text,    nullable=True)          # drug / food / environmental
    chronic_conditions  = Column(Text,    nullable=True)          # diabetes, hypertension, asthma …
    current_medications = Column(Text,    nullable=True)          # name + dosage free-text
    surgical_history    = Column(Text,    nullable=True)          # past surgeries / procedures
    family_history      = Column(Text,    nullable=True)          # hereditary conditions
    lifestyle_notes     = Column(Text,    nullable=True)          # smoking, alcohol, exercise, diet
    insurance_info      = Column(Text,    nullable=True)          # provider, policy number

    created_at          = Column(DateTime, default=datetime.utcnow)
    updated_at          = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # ── Relationships ──────────────────────────────────────────
    reports             = relationship("PatientReport", back_populates="patient",
                                       cascade="all, delete-orphan")
    documents           = relationship("Document",      back_populates="patient",
                                       cascade="all, delete-orphan")
    sessions            = relationship("ChatSession",   back_populates="patient",
                                       cascade="all, delete-orphan")

    # ── Computed property ─────────────────────────────────────
    @property
    def age(self) -> int:
        """Dynamically compute age from date of birth."""
        if self.dob is None:
            return 0
        today = date.today()
        return (
            today.year - self.dob.year
            - ((today.month, today.day) < (self.dob.month, self.dob.day))
        )

    def to_dict(self):
        return {
            "id":                   self.id,
            "name":                 self.name,
            "dob":                  self.dob.isoformat() if self.dob else None,
            "age":                  self.age,
            "sex":                  self.sex,
            "blood_group":          self.blood_group,
            "contact_number":       self.contact_number,
            "emergency_contact":    self.emergency_contact,
            "address":              self.address,
            "allergies":            self.allergies,
            "chronic_conditions":   self.chronic_conditions,
            "current_medications":  self.current_medications,
            "surgical_history":     self.surgical_history,
            "family_history":       self.family_history,
            "lifestyle_notes":      self.lifestyle_notes,
            "insurance_info":       self.insurance_info,
            "created_at":           self.created_at.isoformat() if self.created_at else None,
            "updated_at":           self.updated_at.isoformat() if self.updated_at else None,
        }


# ─────────────────────────────────────────────────────────────
# PatientReport — lab reports, scans, etc. (1 patient : many reports)
# ─────────────────────────────────────────────────────────────
class PatientReport(Base):
    __tablename__ = "patient_reports"

    id           = Column(Integer,  primary_key=True, index=True)
    patient_id   = Column(Integer,  ForeignKey("patients.id"), nullable=False, index=True)

    report_name  = Column(String,  nullable=False)                # e.g. "CBC Test – 28 Feb 2026"
    filename     = Column(String,  nullable=False)                # original upload filename
    file_path    = Column(String,  nullable=False)                # absolute path on disk
    file_type    = Column(String,  nullable=True)                 # MIME type

    ocr_text     = Column(Text,    nullable=True)                 # raw extracted text
    summary      = Column(Text,    nullable=True)                 # AI-generated summary
    insights     = Column(Text,    nullable=True)                 # JSON blob of structured insights

    uploaded_at  = Column(DateTime, default=datetime.utcnow)

    # ── Relationship ──────────────────────────────────────────
    patient      = relationship("Patient", back_populates="reports")

    def to_dict(self):
        return {
            "id":          self.id,
            "patient_id":  self.patient_id,
            "report_name": self.report_name,
            "filename":    self.filename,
            "file_type":   self.file_type,
            "ocr_text":    self.ocr_text,
            "summary":     self.summary,
            "insights":    self.insights,
            "uploaded_at": self.uploaded_at.isoformat() if self.uploaded_at else None,
        }


# ─────────────────────────────────────────────────────────────
# Document — general file uploads (prescriptions, letters, etc.)
# ─────────────────────────────────────────────────────────────
class Document(Base):
    __tablename__ = "documents"

    id          = Column(Integer,  primary_key=True, index=True)
    patient_id  = Column(Integer,  ForeignKey("patients.id"), index=True)
    filename    = Column(String,   nullable=False)
    file_path   = Column(String,   nullable=False)
    file_type   = Column(String,   nullable=True)
    upload_date = Column(DateTime, default=datetime.utcnow)

    patient     = relationship("Patient", back_populates="documents")

    def to_dict(self):
        return {
            "id":          self.id,
            "patient_id":  self.patient_id,
            "filename":    self.filename,
            "file_type":   self.file_type,
            "upload_date": self.upload_date.isoformat() if self.upload_date else None,
        }


# ─────────────────────────────────────────────────────────────
# ChatSession + ChatMessage — doctor ↔ AI conversation history
# ─────────────────────────────────────────────────────────────
class ChatSession(Base):
    __tablename__ = "chat_sessions"

    id          = Column(Integer,  primary_key=True, index=True)
    patient_id  = Column(Integer,  ForeignKey("patients.id"), index=True)
    title       = Column(String,   default="New Consultation")
    created_at  = Column(DateTime, default=datetime.utcnow)

    patient     = relationship("Patient",     back_populates="sessions")
    messages    = relationship("ChatMessage", back_populates="session",
                               cascade="all, delete-orphan",
                               order_by="ChatMessage.timestamp")

    def to_dict(self):
        return {
            "id":         self.id,
            "patient_id": self.patient_id,
            "title":      self.title,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "messages":   [m.to_dict() for m in self.messages],
        }


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id         = Column(Integer,  primary_key=True, index=True)
    session_id = Column(Integer,  ForeignKey("chat_sessions.id"), index=True)
    role       = Column(String,   nullable=False)   # 'user' | 'assistant'
    content    = Column(Text,     nullable=False)
    timestamp  = Column(DateTime, default=datetime.utcnow)

    session    = relationship("ChatSession", back_populates="messages")

    def to_dict(self):
        return {
            "id":        self.id,
            "role":      self.role,
            "content":   self.content,
            "timestamp": self.timestamp.isoformat() if self.timestamp else None,
        }


# ─────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────
def init_db():
    Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
