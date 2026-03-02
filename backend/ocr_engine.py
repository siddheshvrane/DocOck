"""
ocr_engine.py — FAST local OCR for DocOc patient reports.

Performance target: < 10 seconds for any file.

Strategy (in order of speed):
  1. PDFs with embedded/selectable text  → PyMuPDF direct extraction  (~0.1–0.5s per page) ✅
  2. Image files OR scanned PDFs         → Tesseract via pytesseract   (~1–3s per page)     ✅
     (requires Tesseract binary at default Windows install path)
  3. Last-resort fallback (rare)         → EasyOCR at low resolution   (~5–10s per page)    ⚠️

NO neural-network model downloads happen for path 1 or 2.
"""

import os
import re
import logging
import shutil
from typing import Optional

logger = logging.getLogger(__name__)

# ─── Tesseract binary detection ───────────────────────────────────────────────
# Common Windows install paths (Tesseract installer default)
_TESSERACT_CANDIDATES = [
    r"C:\Program Files\Tesseract-OCR\tesseract.exe",
    r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
    shutil.which("tesseract") or "",          # honour PATH
]

def _find_tesseract() -> Optional[str]:
    for path in _TESSERACT_CANDIDATES:
        if path and os.path.isfile(path):
            return path
    return None

TESSERACT_PATH = _find_tesseract()
if TESSERACT_PATH:
    import pytesseract
    pytesseract.pytesseract.tesseract_cmd = TESSERACT_PATH
    logger.info(f"Tesseract found at: {TESSERACT_PATH}")
else:
    logger.info("Tesseract not found — will use PyMuPDF for PDFs; EasyOCR fallback for images.")


# ─── EasyOCR singleton (only initialised if we actually need it) ───────────────
_easyocr_reader = None

def _get_easyocr_reader():
    global _easyocr_reader
    if _easyocr_reader is None:
        import easyocr
        logger.info("Initialising EasyOCR (fallback, CPU mode)…")
        _easyocr_reader = easyocr.Reader(["en"], gpu=False, verbose=False)
    return _easyocr_reader


# ─── Supported extensions ─────────────────────────────────────────────────────
IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".tiff", ".tif", ".bmp", ".webp"}
PDF_EXT    = ".pdf"


# ═════════════════════════════════════════════════════════════════════════════
# Core text extraction
# ═════════════════════════════════════════════════════════════════════════════

def _extract_pdf_pymupdf(file_path: str) -> tuple[str, int]:
    """
    Extract text from a PDF using PyMuPDF.
    Returns (text, page_count).
    For digital PDFs this is near-instant (<0.5s for 10 pages).
    For truly blank/scanned pages, returns empty string.
    """
    import fitz  # PyMuPDF
    doc = fitz.open(file_path)
    pages_text = []
    for page in doc:
        text = page.get_text("text")          # fast C-level extraction
        pages_text.append(text)
    doc.close()
    return "\n\n--- PAGE BREAK ---\n\n".join(pages_text), len(pages_text)


def _pdf_is_digital(text: str, threshold: int = 80) -> bool:
    """Return True if the PyMuPDF-extracted text has enough content to be useful."""
    # Strip whitespace, count meaningful characters
    meaningful = re.sub(r'\s+', '', text)
    return len(meaningful) >= threshold


def _render_pdf_to_images_pymupdf(file_path: str, dpi: int = 150) -> list:
    """
    Render PDF pages to PIL Images at low DPI for image-based OCR.
    150 DPI is sufficient for Tesseract while being ~2x faster than 300 DPI.
    """
    import fitz
    from PIL import Image
    import io
    doc = fitz.open(file_path)
    images = []
    mat = fitz.Matrix(dpi / 72, dpi / 72)   # scale factor
    for page in doc:
        pix = page.get_pixmap(matrix=mat, colorspace=fitz.csRGB)
        img = Image.open(io.BytesIO(pix.tobytes("png")))
        images.append(img)
    doc.close()
    return images


def _ocr_images_with_tesseract(images: list) -> str:
    """Run Tesseract OCR on a list of PIL Images. Fast: ~1-3s per page on CPU."""
    import pytesseract
    parts = []
    for img in images:
        # PSM 6 = assume a uniform block of text (good for reports)
        text = pytesseract.image_to_string(img, config="--psm 6")
        parts.append(text)
    return "\n\n--- PAGE BREAK ---\n\n".join(parts)


def _ocr_images_with_easyocr(images: list) -> str:
    """Fallback: EasyOCR at reduced resolution (~5–8s per page). Last resort."""
    import numpy as np
    from PIL import Image
    reader = _get_easyocr_reader()
    parts = []
    for img in images:
        # Resize to max 1200px wide to speed up inference
        max_w = 1200
        if img.width > max_w:
            ratio = max_w / img.width
            img = img.resize((max_w, int(img.height * ratio)), Image.LANCZOS)
        arr = np.array(img.convert("RGB"))
        results = reader.readtext(arr, detail=0, paragraph=True)
        parts.append("\n".join(results))
    return "\n\n--- PAGE BREAK ---\n\n".join(parts)


def _ocr_single_image_file(file_path: str) -> tuple[str, int]:
    """OCR a single image file (JPG/PNG/etc). Returns (text, 1)."""
    from PIL import Image
    img = Image.open(file_path).convert("RGB")

    if TESSERACT_PATH:
        text = _ocr_images_with_tesseract([img])
    else:
        text = _ocr_images_with_easyocr([img])
    return text, 1


# ═════════════════════════════════════════════════════════════════════════════
# Medical insight extraction  (unchanged from v1)
# ═════════════════════════════════════════════════════════════════════════════

def _extract_medical_insights(text: str) -> dict:
    insights = {
        "patient_name":      _find_first(r"(?i)(?:patient\s*(?:name)?[:\-]?\s*)([A-Z][a-zA-Z\s]+)", text),
        "report_date":       _find_first(r"(?i)(?:date[:\-]?\s*)(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})", text),
        "report_type":       _detect_report_type(text),
        "blood_pressure":    _find_first(r"(?i)(?:B\.?P\.?|blood\s*pressure)[:\-]?\s*(\d{2,3}\s*/\s*\d{2,3})", text),
        "heart_rate":        _find_first(r"(?i)(?:pulse|heart\s*rate|HR)[:\-]?\s*(\d{2,3})\s*(?:bpm)?", text),
        "temperature":       _find_first(r"(?i)(?:temp(?:erature)?)[:\-]?\s*(\d{2,3}(?:\.\d)?)\s*°?(?:F|C)?", text),
        "oxygen_saturation": _find_first(r"(?i)(?:SpO2|oxygen\s*sat(?:uration)?)[:\-]?\s*(\d{2,3})\s*%?", text),
        "weight":            _find_first(r"(?i)(?:weight|wt\.?)[:\-]?\s*(\d{2,3}(?:\.\d)?)\s*(?:kg|lbs?)?", text),
        "height":            _find_first(r"(?i)(?:height|ht\.?)[:\-]?\s*(\d{2,3}(?:\.\d)?)\s*(?:cm|ft|in)?", text),
        "haemoglobin":       _find_first(r"(?i)(?:h(?:a?e)?moglobin|Hb|HGB)[:\-]?\s*(\d{1,2}(?:\.\d)?)\s*(?:g/dL|g%)?", text),
        "blood_glucose":     _find_first(r"(?i)(?:glucose|blood\s*sugar|FBS|RBS|HbA1c)[:\-]?\s*(\d{2,4}(?:\.\d)?)\s*(?:mg/dL|mmol)?", text),
        "wbc":               _find_first(r"(?i)(?:WBC|TLC|white\s*blood)[:\-]?\s*(\d[\d,\.]+)\s*(?:cells)?", text),
        "platelets":         _find_first(r"(?i)(?:platelet|PLT)[:\-]?\s*(\d[\d,\.]+)", text),
        "creatinine":        _find_first(r"(?i)(?:creatinine|Cr)[:\-]?\s*(\d+(?:\.\d)?)\s*(?:mg/dL)?", text),
        "cholesterol":       _find_first(r"(?i)(?:cholesterol|LDL|HDL|VLDL)[:\-]?\s*(\d{2,3})\s*(?:mg/dL)?", text),
        "diagnosis":         _find_block(r"(?i)(?:diagnosis|impression|conclusion|assessment)[:\-]?\s*([\s\S]{5,200}?)(?:\n\n|$)", text),
        "recommendations":   _find_block(r"(?i)(?:recommendation|advice|plan|treatment)[:\-]?\s*([\s\S]{5,200}?)(?:\n\n|$)", text),
    }
    return {k: v for k, v in insights.items() if v}


def _find_first(pattern: str, text: str) -> Optional[str]:
    m = re.search(pattern, text)
    return m.group(1).strip() if m else None


def _find_block(pattern: str, text: str) -> Optional[str]:
    m = re.search(pattern, text)
    if not m:
        return None
    return " ".join(m.group(1).split())[:300]


def _detect_report_type(text: str) -> str:
    t = text.lower()
    if any(k in t for k in ["blood", "cbc", "haemoglobin", "platelet", "wbc", "rbc"]):
        return "Blood Report / CBC"
    if any(k in t for k in ["x-ray", "xray", "radiology", "mri", "ct scan", "ultrasound", "sonography"]):
        return "Radiology / Imaging Report"
    if any(k in t for k in ["ecg", "ekg", "electrocardiogram"]):
        return "ECG Report"
    if any(k in t for k in ["urine", "urinalysis", "culture"]):
        return "Urine / Microbiology Report"
    if any(k in t for k in ["thyroid", "tsh", "t3", "t4"]):
        return "Thyroid Function Report"
    if any(k in t for k in ["liver", "sgpt", "sgot", "bilirubin", "lft"]):
        return "Liver Function Report"
    if any(k in t for k in ["kidney", "creatinine", "urea", "rft"]):
        return "Kidney Function Report"
    if any(k in t for k in ["glucose", "hba1c", "diabetes", "insulin"]):
        return "Diabetes / Glucose Report"
    if any(k in t for k in ["prescription", "tablets", "capsules", "mg", "ml"]):
        return "Prescription"
    return "Medical Report"


def _build_summary(insights: dict, raw_text: str) -> str:
    lines = []
    if insights.get("report_type"):
        lines.append(f"**Report Type:** {insights['report_type']}")
    if insights.get("report_date"):
        lines.append(f"**Date:** {insights['report_date']}")
    if insights.get("patient_name"):
        lines.append(f"**Patient on Report:** {insights['patient_name']}")
    lines.append("")

    vitals = {k.replace("_", " ").title(): insights[k]
              for k in ["blood_pressure","heart_rate","temperature","oxygen_saturation","weight","height"]
              if insights.get(k)}
    if vitals:
        lines.append("**📊 Vitals:**")
        for label, val in vitals.items():
            lines.append(f"  • {label}: {val}")
        lines.append("")

    labs = {k.replace("_", " ").title(): insights[k]
            for k in ["haemoglobin","blood_glucose","wbc","platelets","creatinine","cholesterol"]
            if insights.get(k)}
    if labs:
        lines.append("**🧪 Key Lab Values:**")
        for label, val in labs.items():
            lines.append(f"  • {label}: {val}")
        lines.append("")

    if insights.get("diagnosis"):
        lines.append(f"**🔍 Diagnosis / Impression:** {insights['diagnosis']}")
        lines.append("")
    if insights.get("recommendations"):
        lines.append(f"**💊 Recommendations:** {insights['recommendations']}")
        lines.append("")

    if len(lines) <= 2:
        snippet = raw_text[:500].strip()
        lines.append("**📄 OCR Text Snippet:**")
        lines.append(snippet + ("…" if len(raw_text) > 500 else ""))

    lines.append("\n*This report has been indexed into the patient's health context.*")
    return "\n".join(lines)


# ═════════════════════════════════════════════════════════════════════════════
# Public API
# ═════════════════════════════════════════════════════════════════════════════

def process_report(file_path: str) -> dict:
    """
    Main entry point. Accepts a PDF or image file path.
    Returns { ocr_text, insights, summary, page_count, method }.

    Speed:
      Digital PDF  →  PyMuPDF text extract  → < 1 second
      Scanned PDF  →  PyMuPDF render + Tesseract OCR → 1-5 seconds
      Image file   →  Tesseract / EasyOCR fallback → 2-8 seconds
    """
    ext = os.path.splitext(file_path)[1].lower()

    if ext not in (IMAGE_EXTS | {PDF_EXT}):
        raise ValueError(
            f"Unsupported file type: {ext}. "
            "Supported: PDF, PNG, JPG, JPEG, TIFF, BMP, WEBP"
        )

    method = "unknown"

    if ext == PDF_EXT:
        # ── Step 1: Try direct text extraction (near-instant) ──────────────
        raw_text, page_count = _extract_pdf_pymupdf(file_path)

        if _pdf_is_digital(raw_text):
            method = "pymupdf_text"
            logger.info(f"PDF text extracted via PyMuPDF ({page_count} pages, {len(raw_text)} chars)")
        else:
            # ── Step 2: Scanned PDF → render pages → OCR ───────────────────
            logger.info("PDF appears to be scanned — rendering pages for OCR…")
            images = _render_pdf_to_images_pymupdf(file_path, dpi=150)
            page_count = len(images)

            if TESSERACT_PATH:
                raw_text = _ocr_images_with_tesseract(images)
                method = "tesseract"
            else:
                raw_text = _ocr_images_with_easyocr(images)
                method = "easyocr_fallback"
    else:
        # ── Image file ──────────────────────────────────────────────────────
        raw_text, page_count = _ocr_single_image_file(file_path)
        method = "tesseract" if TESSERACT_PATH else "easyocr_fallback"

    insights = _extract_medical_insights(raw_text)
    summary  = _build_summary(insights, raw_text)

    return {
        "ocr_text":   raw_text,
        "insights":   insights,
        "summary":    summary,
        "page_count": page_count,
        "method":     method,
    }
