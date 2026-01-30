from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import json
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timezone
from enum import Enum

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Load master checklist from JSON - AUTHORITATIVE SOURCE
CHECKLIST_PATH = Path(__file__).parent.parent / "src" / "config" / "implantMasterChecklist.v1.json"

def load_master_checklist():
    """Load master checklist from authoritative JSON file - READ ONLY"""
    try:
        with open(CHECKLIST_PATH, 'r') as f:
            return json.load(f)
    except Exception as e:
        logger.error(f"Failed to load master checklist from {CHECKLIST_PATH}: {e}")
        return None

MASTER_CHECKLIST = load_master_checklist()

def derive_planning_conditions(case_data: dict) -> dict:
    """
    Derive planning conditions from case data to match checklist conditions.
    This function translates case data into the format expected by checklist conditions.
    """
    planning_data = case_data.get("planningData", {})
    risk_assessment = case_data.get("riskAssessment", {})
    
    conditions = {
        # Imaging requirements
        "requiresImaging": True,  # Always true for implant cases
        
        # Esthetic zone
        "estheticZone": planning_data.get("estheticZone") == "high",
        
        # Bone availability
        "gbr": planning_data.get("boneAvailability") == "insufficient",
        "needsGBR": planning_data.get("boneAvailability") == "insufficient",
        
        # Soft tissue
        "softTissueGraft": planning_data.get("softTissueBiotype") == "thin" and planning_data.get("estheticZone") == "high",
        
        # Surgical guide
        "guideRequired": planning_data.get("estheticZone") == "high",
        
        # Implant timing - infer from risk assessment
        "immediateProvisionalization": "immediate" in risk_assessment.get("implantTiming", "").lower() if risk_assessment.get("implantTiming") else False,
        
        # Restorative
        "prostheticType": planning_data.get("restorativeContext"),
        
        # Systemic factors
        "smoker": planning_data.get("smokingStatus") in ["current", "former"],
        "diabetic": planning_data.get("diabetesStatus") in ["controlled", "uncontrolled"],
        "anticoagulated": "anticoagulants" in planning_data.get("medications", []),
        "bisphosphonates": "bisphosphonates" in planning_data.get("medications", []),
        
        # Occlusal
        "bruxism": "bruxism" in risk_assessment.get("riskModifiers", []) if risk_assessment.get("riskModifiers") else False,
    }
    
    # Clean up None values and false booleans for cleaner output
    return {k: v for k, v in conditions.items() if v is not None and v is not False}

def matches_conditions(item_conditions: dict, case_conditions: dict) -> bool:
    """
    Check if all item conditions match the case conditions.
    Returns True if item has no conditions OR all conditions match exactly.
    """
    if not item_conditions:
        return True
    
    for key, expected_value in item_conditions.items():
        case_value = case_conditions.get(key)
        
        # Handle different value types
        if isinstance(expected_value, bool):
            # For boolean conditions, must match exactly
            if case_value != expected_value:
                return False
        elif isinstance(expected_value, str):
            # For string conditions, case-insensitive match
            if str(case_value).lower() != expected_value.lower():
                return False
        elif isinstance(expected_value, list):
            # For list conditions, all expected items must be in case value
            if not isinstance(case_value, list):
                return False
            if not all(item in case_value for item in expected_value):
                return False
        else:
            # Exact match for other types
            if case_value != expected_value:
                return False
    
    return True

def get_auto_complete_mappings():
    """
    Define mappings between checklist item IDs and planning engine fields.
    These items represent planning decisions already made during planning.
    
    ONLY planning/decision items should be auto-completed.
    Physical actions, time-dependent steps, or surgical execution must NOT be auto-completed.
    """
    return {
        # Planning decisions
        "implant_system_selected": "planningData.boneAvailability",  # Implant system decided during planning
        "esthetic_risk_assessed": "planningData.estheticZone",  # Esthetic assessment done
        "occlusal_scheme_decided": "planningData.occlusion",  # Occlusion documented
        "restorative_plan_defined": "planningData.restorativeContext",  # Restoration type chosen
        "smoking_status_documented": "planningData.smokingStatus",  # Systemic factors recorded
        "medical_history_reviewed": "planningData.diabetesStatus",  # Medical review done
        "bone_assessment_complete": "planningData.boneAvailability",  # Bone evaluated
        "soft_tissue_evaluation": "planningData.softTissueBiotype",  # Tissue assessed
        "medications_reviewed": "planningData.medications",  # Medications documented
        
        # Risk assessment decisions
        "timing_protocol_decided": "riskAssessment.implantTiming",  # Timing decision made
        "case_complexity_assessed": "riskAssessment.caseComplexity",  # Complexity evaluated
        "risk_modifiers_identified": "riskAssessment.riskModifiers",  # Risk factors identified
    }

def get_nested_value(data: dict, path: str):
    """Get nested dictionary value using dot notation path"""
    keys = path.split('.')
    value = data
    for key in keys:
        if isinstance(value, dict):
            value = value.get(key)
        else:
            return None
        if value is None:
            return None
    return value

def should_auto_complete(item_id: str, case_data: dict) -> tuple[bool, str]:
    """
    Check if a checklist item should be auto-completed based on planning data.
    
    Returns:
        (should_complete: bool, reason: str)
    """
    mappings = get_auto_complete_mappings()
    
    if item_id not in mappings:
        return False, None
    
    planning_field = mappings[item_id]
    value = get_nested_value(case_data, planning_field)
    
    # Auto-complete if field has a non-null, non-empty value
    if value is not None and value != "" and value != []:
        return True, "Completed during planning"
    
    return False, None

def apply_auto_completion(filtered_checklist: dict, case_data: dict, stored_checklist: dict = None) -> dict:
    """
    Apply auto-completion to eligible checklist items.
    
    Auto-completion runs ONLY if:
    1. Item has never been manually interacted with
    2. Planning data exists for the mapped field
    
    Manual user actions always override auto-completion.
    """
    for phase_key, phase_data in filtered_checklist.items():
        stored_phase = stored_checklist.get(phase_key, {}) if stored_checklist else {}
        
        for section_idx, section in enumerate(phase_data.get("sections", [])):
            stored_sections = stored_phase.get("sections", [])
            stored_section = stored_sections[section_idx] if section_idx < len(stored_sections) else {}
            
            for item in section.get("items", []):
                # Check if item was previously stored (user interaction exists)
                stored_items = stored_section.get("items", [])
                matching_stored = next((si for si in stored_items if si.get("id") == item["id"]), None)
                
                # Only auto-complete if no previous user interaction
                if not matching_stored or matching_stored.get("completed") is None:
                    should_complete, reason = should_auto_complete(item["id"], case_data)
                    
                    if should_complete:
                        item["completed"] = True
                        item["completedAt"] = datetime.now(timezone.utc).isoformat()
                        item["autoCompleted"] = True
                        item["autoCompleteReason"] = reason
    
    return filtered_checklist
    """
    Filter master checklist based on case planning conditions.
    Returns only phases, sections, and items that are relevant for this case.
    
    CRITICAL: This is rendering + filtering ONLY. No clinical reasoning.
    """
    if not master_checklist:
        return {}
    
    case_conditions = derive_planning_conditions(case_data)
    filtered_phases = {}
    
    for phase in master_checklist.get("phases", []):
        filtered_sections = []
        
        for section in phase.get("sections", []):
            filtered_items = []
            
            for item in section.get("items", []):
                item_conditions = item.get("conditions", {})
                
                # Only include item if conditions match
                if matches_conditions(item_conditions, case_conditions):
                    # Create a copy without the conditions field for client
                    item_copy = {
                        "id": item["id"],
                        "text": item["text"],
                        "importance": item.get("importance", "advanced"),
                        "completed": False,
                        "completedAt": None
                    }
                    filtered_items.append(item_copy)
            
            # Only include section if it has visible items
            if filtered_items:
                filtered_sections.append({
                    "id": section.get("id"),
                    "name": section.get("name"),
                    "title": section.get("name"),  # Alias for compatibility
                    "isLabSection": section.get("isLabSection", False),
                    "items": filtered_items
                })
        
        # Only include phase if it has visible sections
        if filtered_sections:
            filtered_phases[phase["id"]] = {
                "id": phase["id"],
                "name": phase.get("name"),
                "title": phase.get("name"),  # Alias for compatibility
                "description": phase.get("description", ""),
                "order": phase.get("order", 0),
                "sections": filtered_sections
            }
    
    return filtered_phases

# ============ ENUMS ============
class BoneAvailability(str, Enum):
    ADEQUATE = "adequate"
    MODERATE = "moderate"
    LIMITED = "limited"
    INSUFFICIENT = "insufficient"

class EsteticZone(str, Enum):
    HIGH = "high"
    MODERATE = "moderate"
    LOW = "low"

class SoftTissueBiotype(str, Enum):
    THICK = "thick"
    MODERATE = "moderate"
    THIN = "thin"

class ChecklistPhase(str, Enum):
    PRE_TREATMENT = "pre_treatment"
    TREATMENT = "treatment"
    POST_TREATMENT = "post_treatment"

class CaseStatus(str, Enum):
    PLANNING = "planning"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"

# ============ MODELS ============
class ChecklistItemBase(BaseModel):
    id: str
    text: str
    completed: bool = False
    notes: Optional[str] = None
    completedAt: Optional[str] = None

class ChecklistItem(ChecklistItemBase):
    isCustom: bool = False

class ChecklistItemCreate(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    text: str
    completed: bool = False
    notes: Optional[str] = None
    completedAt: Optional[str] = None
    isCustom: bool = True

class PlanningData(BaseModel):
    boneAvailability: Optional[BoneAvailability] = None
    boneHeight: Optional[str] = None
    boneWidth: Optional[str] = None
    estheticZone: Optional[EsteticZone] = None
    softTissueBiotype: Optional[SoftTissueBiotype] = None
    systemicModifiers: List[str] = []
    restorativeContext: Optional[str] = None
    adjacentTeeth: Optional[str] = None
    occlusion: Optional[str] = None
    smokingStatus: Optional[str] = None
    diabetesStatus: Optional[str] = None
    medications: List[str] = []
    additionalNotes: Optional[str] = None

class Feedback(BaseModel):
    whatWasUnexpected: Optional[str] = None
    whatToDoubleCheckNextTime: Optional[str] = None
    customChecklistSuggestions: List[str] = []
    reflectionCompletedAt: Optional[str] = None

class Attachments(BaseModel):
    images: List[str] = []
    cbctLinks: List[str] = []
    stlLinks: List[str] = []

class TimelineEntry(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    timestamp: str
    action: str
    details: Optional[str] = None
    phase: Optional[str] = None

class RiskAssessment(BaseModel):
    # Standard mode fields
    overallRisk: str = "moderate"
    factors: List[str] = []
    considerations: List[str] = []
    plainLanguageSummary: str = ""
    
    # Standard mode additions
    primaryIssue: str = ""
    caseComplexity: str = "Moderate"  # Simple / Moderate / Complex
    implantTiming: str = ""
    briefRationale: str = ""
    
    # Detailed mode fields
    primaryIssueExpanded: str = ""
    complexityDrivers: List[str] = []
    immediatePlacementEligible: Optional[bool] = None
    immediatePlacementReasons: List[str] = []
    riskModifiers: List[str] = []
    clinicalRationale: List[str] = []
    backupAwareness: Optional[str] = None

class Case(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    caseName: str
    toothNumber: str
    optionalAge: Optional[int] = None
    optionalSex: Optional[str] = None
    status: CaseStatus = CaseStatus.PLANNING
    planningData: PlanningData = Field(default_factory=PlanningData)
    preTreatmentChecklist: List[ChecklistItem] = []
    treatmentChecklist: List[ChecklistItem] = []
    postTreatmentChecklist: List[ChecklistItem] = []
    prostheticChecklist: Optional[dict] = None  # New 4-phase prosthetic checklist
    feedback: Feedback = Field(default_factory=Feedback)
    attachments: Attachments = Field(default_factory=Attachments)
    timeline: List[TimelineEntry] = []
    riskAssessment: Optional[RiskAssessment] = None
    consentAcknowledged: bool = False
    createdAt: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updatedAt: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class CaseCreate(BaseModel):
    caseName: str
    toothNumber: str
    optionalAge: Optional[int] = None
    optionalSex: Optional[str] = None

class CaseUpdate(BaseModel):
    caseName: Optional[str] = None
    toothNumber: Optional[str] = None
    optionalAge: Optional[int] = None
    optionalSex: Optional[str] = None
    status: Optional[CaseStatus] = None
    planningData: Optional[PlanningData] = None
    consentAcknowledged: Optional[bool] = None

class ChecklistUpdate(BaseModel):
    phase: ChecklistPhase
    items: List[ChecklistItem]

class FeedbackUpdate(BaseModel):
    whatWasUnexpected: Optional[str] = None
    whatToDoubleCheckNextTime: Optional[str] = None
    customChecklistSuggestions: List[str] = []

class AttachmentAdd(BaseModel):
    type: str  # "images", "cbctLinks", "stlLinks"
    url: str

# ============ DEFAULT CHECKLISTS ============
# ============ IMPLANT PROSTHETIC CHECKLIST (4-PHASE) ============
DEFAULT_PROSTHETIC_CHECKLIST = {
    "phase1": {
        "title": "PHASE 1 — PRE-Rx PLANNING",
        "description": "Comprehensive case assessment & prosthetic strategy",
        "sections": [
            {
                "title": "Clinical Assessment",
                "isLabSection": False,
                "items": [
                    {"text": "Review medical & surgical history", "id": str(uuid.uuid4()), "importance": "advanced"},
                    {"text": "Verify implant placement dates & implant specifications", "id": str(uuid.uuid4()), "importance": "essential"},  # ESSENTIAL #1
                    {"text": "Assess esthetics & patient expectations", "id": str(uuid.uuid4()), "importance": "essential"},  # ESSENTIAL #3
                    {"text": "Evaluate bone volume & jaw relation", "id": str(uuid.uuid4()), "importance": "advanced"},
                    {"text": "Document existing dentition status", "id": str(uuid.uuid4()), "importance": "advanced"},
                    {"text": "Confirm implant position & osseointegration", "id": str(uuid.uuid4()), "importance": "essential"},  # ESSENTIAL #2
                    {"text": "Radiographic verification (periapical, CBCT if needed)", "id": str(uuid.uuid4()), "importance": "advanced"},
                ]
            },
            {
                "title": "Lab Communication – Case Setup",
                "isLabSection": True,
                "items": [
                    {"text": "Send pre-case consultation form to lab", "id": str(uuid.uuid4()), "importance": "advanced"},
                    {"text": "Confirm lab can accommodate abutment selection", "id": str(uuid.uuid4()), "importance": "advanced"},
                    {"text": "Discuss margin location requirements", "id": str(uuid.uuid4()), "importance": "essential"},  # ESSENTIAL #5 - mapped to "Define margin location"
                    {"text": "Confirm turnaround time & remake policy", "id": str(uuid.uuid4()), "importance": "advanced"},
                    {"text": "Share esthetic photos & concerns", "id": str(uuid.uuid4()), "importance": "essential"},  # ESSENTIAL #6 - mapped to "Communicate esthetic expectations to lab"
                    {"text": "Establish lab point of contact", "id": str(uuid.uuid4()), "importance": "advanced"},
                ]
            },
            {
                "title": "Prosthetic Strategy & Planning",
                "isLabSection": False,
                "items": [
                    {"text": "Determine abutment approach", "id": str(uuid.uuid4()), "importance": "essential"},  # ESSENTIAL #4 - mapped to "Decide abutment type"
                    {"text": "Decide restoration material", "id": str(uuid.uuid4()), "importance": "advanced"},
                    {"text": "Plan emergence profile", "id": str(uuid.uuid4()), "importance": "advanced"},
                    {"text": "Define esthetic goals", "id": str(uuid.uuid4()), "importance": "advanced"},
                    {"text": "Establish occlusal scheme", "id": str(uuid.uuid4()), "importance": "advanced"},
                    {"text": "Document treatment plan", "id": str(uuid.uuid4()), "importance": "advanced"},
                    {"text": "Obtain informed consent", "id": str(uuid.uuid4()), "importance": "advanced"},
                ]
            }
        ]
    },
    "phase2": {
        "title": "PHASE 2 — Rx EXECUTION",
        "description": "Clinical preparation & prosthetic data capture",
        "sections": [
            {
                "title": "Pre-Prosthetic Clinical Preparation",
                "isLabSection": False,
                "items": [
                    {"text": "Implant stability assessment", "id": str(uuid.uuid4()), "importance": "essential"},  # ESSENTIAL #1
                    {"text": "Verify emergence profile", "id": str(uuid.uuid4()), "importance": "essential"},  # ESSENTIAL #2 - part of "soft tissue maturity"
                    {"text": "Check soft tissue maturity", "id": str(uuid.uuid4()), "importance": "essential"},  # ESSENTIAL #2
                    {"text": "Evaluate peri-implant mucosa", "id": str(uuid.uuid4()), "importance": "advanced"},
                    {"text": "Soft tissue contouring if needed", "id": str(uuid.uuid4()), "importance": "advanced"},
                    {"text": "Baseline photography", "id": str(uuid.uuid4()), "importance": "advanced"},
                    {"text": "Color documentation", "id": str(uuid.uuid4()), "importance": "advanced"},
                ]
            },
            {
                "title": "Impression & Data Capture Protocol",
                "isLabSection": False,
                "items": [
                    {"text": "Select impression technique", "id": str(uuid.uuid4()), "importance": "essential"},  # ESSENTIAL #3
                    {"text": "Confirm abutment selection", "id": str(uuid.uuid4()), "importance": "essential"},  # ESSENTIAL #4
                    {"text": "Tissue retraction", "id": str(uuid.uuid4()), "importance": "advanced"},
                    {"text": "Capture impression", "id": str(uuid.uuid4()), "importance": "essential"},  # ESSENTIAL #5
                    {"text": "Jaw relation", "id": str(uuid.uuid4()), "importance": "essential"},  # ESSENTIAL #6
                    {"text": "Bite registration", "id": str(uuid.uuid4()), "importance": "advanced"},
                    {"text": "Digital scans if applicable", "id": str(uuid.uuid4()), "importance": "advanced"},
                    {"text": "Shade documentation", "id": str(uuid.uuid4()), "importance": "advanced"},
                ]
            },
            {
                "title": "Lab Communication – Case Dispatch",
                "isLabSection": True,
                "items": [
                    {"text": "Prepare detailed lab prescription", "id": str(uuid.uuid4()), "importance": "essential"},  # ESSENTIAL #7
                    {"text": "Specify abutment & margin details", "id": str(uuid.uuid4()), "importance": "advanced"},
                    {"text": "Include esthetic parameters", "id": str(uuid.uuid4()), "importance": "advanced"},
                    {"text": "Define functional specs", "id": str(uuid.uuid4()), "importance": "advanced"},
                    {"text": "Attach photos", "id": str(uuid.uuid4()), "importance": "advanced"},
                    {"text": "Note special instructions", "id": str(uuid.uuid4()), "importance": "advanced"},
                    {"text": "Schedule try-in", "id": str(uuid.uuid4()), "importance": "advanced"},
                    {"text": "Confirm lab receipt", "id": str(uuid.uuid4()), "importance": "advanced"},
                ]
            }
        ]
    },
    "phase3": {
        "title": "PHASE 3 — POST-Rx PLANNING",
        "description": "Quality assurance & final clinical preparation",
        "sections": [
            {
                "title": "Lab Delivery & Quality Review",
                "isLabSection": False,
                "items": [
                    {"text": "Receive lab work", "id": str(uuid.uuid4()), "importance": "advanced"},
                    {"text": "Inspect model accuracy", "id": str(uuid.uuid4()), "importance": "essential"},  # ESSENTIAL #1
                    {"text": "Assess restoration fit", "id": str(uuid.uuid4()), "importance": "advanced"},
                    {"text": "Check shade under lighting", "id": str(uuid.uuid4()), "importance": "essential"},  # ESSENTIAL #2
                    {"text": "Inspect defects", "id": str(uuid.uuid4()), "importance": "advanced"},
                    {"text": "Assess margins", "id": str(uuid.uuid4()), "importance": "advanced"},
                    {"text": "Contact lab if discrepancies", "id": str(uuid.uuid4()), "importance": "advanced"},
                ]
            },
            {
                "title": "Clinical Try-In & Adjustment",
                "isLabSection": False,
                "items": [
                    {"text": "Isolate implant site", "id": str(uuid.uuid4()), "importance": "advanced"},
                    {"text": "Passive fit check", "id": str(uuid.uuid4()), "importance": "essential"},  # ESSENTIAL #3
                    {"text": "Margin evaluation", "id": str(uuid.uuid4()), "importance": "essential"},  # ESSENTIAL #4
                    {"text": "Occlusal check", "id": str(uuid.uuid4()), "importance": "essential"},  # ESSENTIAL #5
                    {"text": "Esthetic evaluation", "id": str(uuid.uuid4()), "importance": "advanced"},
                    {"text": "Soft tissue assessment", "id": str(uuid.uuid4()), "importance": "advanced"},
                    {"text": "Adjustments", "id": str(uuid.uuid4()), "importance": "advanced"},
                    {"text": "Document remakes", "id": str(uuid.uuid4()), "importance": "advanced"},
                ]
            },
            {
                "title": "Lab Communication – Adjustments & Approval",
                "isLabSection": True,
                "items": [
                    {"text": "Communicate adjustments", "id": str(uuid.uuid4()), "importance": "advanced"},
                    {"text": "Request refinements", "id": str(uuid.uuid4()), "importance": "advanced"},
                    {"text": "Approve final design", "id": str(uuid.uuid4()), "importance": "essential"},  # ESSENTIAL #6
                    {"text": "Confirm no modifications", "id": str(uuid.uuid4()), "importance": "advanced"},
                    {"text": "Discuss remakes", "id": str(uuid.uuid4()), "importance": "advanced"},
                    {"text": "Establish delivery timeline", "id": str(uuid.uuid4()), "importance": "advanced"},
                    {"text": "Confirm occlusal requirements", "id": str(uuid.uuid4()), "importance": "advanced"},
                ]
            }
        ]
    },
    "phase4": {
        "title": "PHASE 4 — PROSTHETIC REHABILITATION",
        "description": "Permanent restoration delivery & long-term care",
        "sections": [
            {
                "title": "Final Cementation & Seating",
                "isLabSection": False,
                "items": [
                    {"text": "Isolation & field prep", "id": str(uuid.uuid4()), "importance": "essential"},  # ESSENTIAL #1
                    {"text": "Cement selection", "id": str(uuid.uuid4()), "importance": "essential"},  # ESSENTIAL #2
                    {"text": "Abutment cleaning", "id": str(uuid.uuid4()), "importance": "advanced"},
                    {"text": "Controlled cement application", "id": str(uuid.uuid4()), "importance": "advanced"},
                    {"text": "Seating & alignment", "id": str(uuid.uuid4()), "importance": "advanced"},
                    {"text": "Cement removal", "id": str(uuid.uuid4()), "importance": "essential"},  # ESSENTIAL #3
                    {"text": "Ultrasonic margin cleaning", "id": str(uuid.uuid4()), "importance": "advanced"},
                    {"text": "Radiographic cement check", "id": str(uuid.uuid4()), "importance": "essential"},  # ESSENTIAL #4
                    {"text": "Final occlusion", "id": str(uuid.uuid4()), "importance": "essential"},  # ESSENTIAL #5
                ]
            },
            {
                "title": "Immediate Post-Delivery Assessment",
                "isLabSection": False,
                "items": [
                    {"text": "Patient comfort", "id": str(uuid.uuid4()), "importance": "advanced"},
                    {"text": "Phonetics", "id": str(uuid.uuid4()), "importance": "advanced"},
                    {"text": "Mastication", "id": str(uuid.uuid4()), "importance": "advanced"},
                    {"text": "Dynamic occlusion", "id": str(uuid.uuid4()), "importance": "advanced"},
                    {"text": "Lateral movements", "id": str(uuid.uuid4()), "importance": "advanced"},
                    {"text": "Sensitivity check", "id": str(uuid.uuid4()), "importance": "advanced"},
                    {"text": "Esthetic satisfaction", "id": str(uuid.uuid4()), "importance": "advanced"},
                ]
            },
            {
                "title": "Patient Education & Care Instructions",
                "isLabSection": False,
                "items": [
                    {"text": "Home care instruction", "id": str(uuid.uuid4()), "importance": "essential"},  # ESSENTIAL #6
                    {"text": "Interdental cleaning", "id": str(uuid.uuid4()), "importance": "advanced"},
                    {"text": "Chewing precautions", "id": str(uuid.uuid4()), "importance": "advanced"},
                    {"text": "Written instructions", "id": str(uuid.uuid4()), "importance": "advanced"},
                    {"text": "Dietary guidance", "id": str(uuid.uuid4()), "importance": "advanced"},
                    {"text": "Smoking counseling", "id": str(uuid.uuid4()), "importance": "advanced"},
                    {"text": "Emergency contact", "id": str(uuid.uuid4()), "importance": "advanced"},
                    {"text": "Healing timeline", "id": str(uuid.uuid4()), "importance": "advanced"},
                ]
            },
            {
                "title": "Follow-Up & Long-Term Monitoring",
                "isLabSection": False,
                "items": [
                    {"text": "1-week follow-up", "id": str(uuid.uuid4()), "importance": "essential"},  # ESSENTIAL #7 - Schedule follow-up visit
                    {"text": "3-month evaluation", "id": str(uuid.uuid4()), "importance": "advanced"},
                    {"text": "Annual radiographs", "id": str(uuid.uuid4()), "importance": "advanced"},
                    {"text": "Recall interval", "id": str(uuid.uuid4()), "importance": "advanced"},
                    {"text": "Baseline probing", "id": str(uuid.uuid4()), "importance": "advanced"},
                    {"text": "Maintenance protocol", "id": str(uuid.uuid4()), "importance": "advanced"},
                    {"text": "Crown renewal planning", "id": str(uuid.uuid4()), "importance": "advanced"},
                    {"text": "Document complications", "id": str(uuid.uuid4()), "importance": "advanced"},
                ]
            }
        ]
    }
}

# Legacy checklists for backward compatibility
DEFAULT_PRE_TREATMENT_CHECKLIST = [
    {"text": "CBCT scan reviewed", "id": str(uuid.uuid4())},
    {"text": "Bone quality and quantity assessed", "id": str(uuid.uuid4())},
    {"text": "Adjacent teeth evaluated", "id": str(uuid.uuid4())},
    {"text": "Medical history reviewed", "id": str(uuid.uuid4())},
    {"text": "Medications checked for contraindications", "id": str(uuid.uuid4())},
    {"text": "Esthetic expectations discussed", "id": str(uuid.uuid4())},
    {"text": "Treatment plan finalized", "id": str(uuid.uuid4())},
    {"text": "Informed consent obtained", "id": str(uuid.uuid4())},
    {"text": "Surgical guide prepared (if applicable)", "id": str(uuid.uuid4())},
]

DEFAULT_TREATMENT_CHECKLIST = [
    {"text": "Surgical site prepared and anesthetized", "id": str(uuid.uuid4())},
    {"text": "Osteotomy performed to planned depth", "id": str(uuid.uuid4())},
    {"text": "Implant placed at correct angulation", "id": str(uuid.uuid4())},
    {"text": "Primary stability achieved", "id": str(uuid.uuid4())},
    {"text": "Insertion torque recorded", "id": str(uuid.uuid4())},
    {"text": "Cover screw or healing abutment placed", "id": str(uuid.uuid4())},
    {"text": "Intra-operative radiograph taken (if needed)", "id": str(uuid.uuid4())},
    {"text": "Soft tissue closure completed", "id": str(uuid.uuid4())},
]

DEFAULT_POST_TREATMENT_CHECKLIST = [
    {"text": "Post-operative instructions provided", "id": str(uuid.uuid4())},
    {"text": "Pain management plan reviewed", "id": str(uuid.uuid4())},
    {"text": "Antibiotics prescribed (if indicated)", "id": str(uuid.uuid4())},
    {"text": "Follow-up appointment scheduled", "id": str(uuid.uuid4())},
    {"text": "Healing progress documented at 1 week", "id": str(uuid.uuid4())},
    {"text": "Integration verified before loading", "id": str(uuid.uuid4())},
    {"text": "Final restoration plan confirmed", "id": str(uuid.uuid4())},
    {"text": "Patient satisfaction assessed", "id": str(uuid.uuid4())},
]

# ============ PLANNING ENGINE ============
def calculate_risk_assessment(planning_data: PlanningData, tooth_number: str) -> RiskAssessment:
    """
    Enhanced risk stratification with toggle-based reasoning depth.
    Returns both Standard and Detailed mode outputs using existing inputs only.
    """
    factors = []
    considerations = []
    risk_modifiers = []
    complexity_drivers = []
    clinical_rationale = []
    risk_level = "low"
    complexity_score = 0
    
    # Determine if esthetic zone
    esthetic_teeth = ["7", "8", "9", "10", "6", "11", "22", "23", "24", "25", "26", "27"]
    is_esthetic_zone = tooth_number in esthetic_teeth or planning_data.estheticZone == EsteticZone.HIGH
    
    # Determine if posterior zone
    posterior_teeth = ["1", "2", "3", "14", "15", "16", "17", "18", "19", "30", "31", "32"]
    is_posterior = tooth_number in posterior_teeth
    
    # === BONE ASSESSMENT ===
    if planning_data.boneAvailability == BoneAvailability.INSUFFICIENT:
        factors.append("Limited bone availability")
        considerations.append("Consider bone augmentation procedures before or during implant placement")
        complexity_drivers.append("Insufficient bone volume requiring augmentation consideration")
        risk_modifiers.append("Bone deficiency detected")
        clinical_rationale.append("Limited bone availability typically requires staged approach or simultaneous grafting")
        risk_level = "high"
        complexity_score += 3
    elif planning_data.boneAvailability == BoneAvailability.LIMITED:
        factors.append("Moderate bone limitation")
        considerations.append("Be mindful of potential need for guided bone regeneration")
        complexity_drivers.append("Borderline bone dimensions")
        risk_level = "moderate" if risk_level != "high" else risk_level
        complexity_score += 2
    elif planning_data.boneAvailability == BoneAvailability.MODERATE:
        complexity_score += 1
    
    # === ESTHETIC ZONE ===
    if is_esthetic_zone:
        factors.append("High esthetic zone")
        considerations.append("Cases like this often require careful attention to soft tissue management")
        considerations.append("Consider provisionalization timeline for optimal esthetic outcomes")
        complexity_drivers.append("Esthetic zone demands precise positioning and soft tissue outcomes")
        clinical_rationale.append("Anterior placement requires meticulous attention to emergence profile and papilla preservation")
        risk_level = "moderate" if risk_level == "low" else risk_level
        complexity_score += 2
    
    # === SOFT TISSUE BIOTYPE ===
    if planning_data.softTissueBiotype == SoftTissueBiotype.THIN:
        factors.append("Thin soft tissue biotype")
        considerations.append("Be mindful of potential gingival recession risk")
        considerations.append("Consider soft tissue grafting if indicated")
        risk_modifiers.append("Thin biotype increases esthetic risk")
        if is_esthetic_zone:
            risk_modifiers.append("Thin biotype in esthetic zone warrants careful planning")
            clinical_rationale.append("Thin biotype in visible areas may benefit from connective tissue grafting")
        risk_level = "moderate" if risk_level == "low" else risk_level
        complexity_score += 1
    
    # === SMOKING STATUS ===
    if planning_data.smokingStatus == "current":
        factors.append("Active smoker")
        considerations.append("Smoking cessation counseling may improve outcomes")
        considerations.append("Consider extended healing time before loading")
        risk_modifiers.append("Active smoking impacts healing and osseointegration")
        clinical_rationale.append("Smoking is associated with higher implant failure rates; extended healing recommended")
        risk_level = "moderate" if risk_level == "low" else risk_level
        complexity_score += 2
    elif planning_data.smokingStatus == "former":
        risk_modifiers.append("Former smoker - monitor healing")
    
    # === DIABETES ===
    if planning_data.diabetesStatus == "uncontrolled":
        factors.append("Uncontrolled diabetes")
        considerations.append("Optimize glycemic control before surgery if possible")
        considerations.append("Be aware of potential healing complications")
        risk_modifiers.append("Uncontrolled diabetes significantly affects healing")
        complexity_drivers.append("Systemic condition requiring medical optimization")
        clinical_rationale.append("HbA1c optimization prior to surgery improves predictability")
        risk_level = "high"
        complexity_score += 3
    elif planning_data.diabetesStatus == "controlled":
        factors.append("Controlled diabetes")
        considerations.append("Monitor healing progress carefully")
        risk_modifiers.append("Well-controlled diabetes - standard precautions apply")
        complexity_score += 1
    
    # === MEDICATIONS ===
    if any(med.lower() in ["bisphosphonates", "denosumab", "antiresorptive"] for med in planning_data.medications):
        factors.append("Antiresorptive medication history")
        considerations.append("Consider MRONJ risk assessment")
        considerations.append("May require medical consultation before proceeding")
        risk_modifiers.append("Antiresorptive therapy requires MRONJ risk evaluation")
        complexity_drivers.append("Medication history requires interdisciplinary coordination")
        clinical_rationale.append("Drug holiday consideration and specialist consultation may be warranted")
        risk_level = "high"
        complexity_score += 3
    
    if any(med.lower() in ["warfarin", "anticoagulant", "blood thinner"] for med in planning_data.medications):
        factors.append("Anticoagulant therapy")
        considerations.append("Coordinate with physician regarding anticoagulation management")
        risk_modifiers.append("Anticoagulation requires perioperative management plan")
        complexity_score += 1
    
    # === OCCLUSION / BRUXISM ===
    if planning_data.occlusion and "brux" in planning_data.occlusion.lower():
        risk_modifiers.append("Bruxism may affect long-term implant success")
        clinical_rationale.append("Consider occlusal splint therapy post-restoration")
        complexity_score += 1
    
    # === RESTORATIVE CONTEXT ===
    if planning_data.restorativeContext == "bridge_abutment":
        complexity_drivers.append("Bridge abutment requires precise positioning for path of insertion")
        complexity_score += 1
    elif planning_data.restorativeContext == "fixed_prosthesis":
        complexity_drivers.append("Full arch rehabilitation increases planning complexity")
        complexity_score += 2
    
    # === DETERMINE CASE COMPLEXITY ===
    if complexity_score <= 2:
        case_complexity = "Simple"
    elif complexity_score <= 5:
        case_complexity = "Moderate"
    else:
        case_complexity = "Complex"
    
    # === PRIMARY ISSUE DETERMINATION ===
    primary_issue = determine_primary_issue(planning_data, tooth_number, is_esthetic_zone, is_posterior)
    primary_issue_expanded = expand_primary_issue(planning_data, tooth_number, is_esthetic_zone, factors)
    
    # === IMPLANT TIMING ===
    implant_timing, immediate_eligible, immediate_reasons = determine_implant_timing(
        planning_data, risk_level, complexity_score, is_esthetic_zone
    )
    
    # === BRIEF RATIONALE (Standard Mode) ===
    brief_rationale = generate_brief_rationale(case_complexity, primary_issue, implant_timing)
    
    # === PLAIN LANGUAGE SUMMARY ===
    if risk_level == "low":
        summary = "This case appears straightforward. Standard protocols should be appropriate, though individual patient factors should always be considered."
    elif risk_level == "moderate":
        summary = "This case has some factors that warrant additional attention. Consider reviewing the specific considerations below and plan accordingly."
    else:
        summary = "This case has several factors that may increase complexity. Careful planning and possibly specialist consultation may be beneficial."
    
    if not factors:
        factors.append("No significant risk factors identified")
        considerations.append("Standard implant protocols may be appropriate")
    
    # Limit complexity drivers to top 3
    complexity_drivers = complexity_drivers[:3] if complexity_drivers else ["Standard case parameters"]
    
    # === BACKUP AWARENESS (Complex cases only) ===
    backup_awareness = None
    if case_complexity == "Complex":
        backup_awareness = "If intraoperative findings differ from planning, consider staging the procedure. This is a reasonable approach that prioritizes long-term success."
    
    # Ensure clinical rationale has content
    if not clinical_rationale:
        clinical_rationale = ["Standard protocols are appropriate for this case profile"]
    
    return RiskAssessment(
        overallRisk=risk_level,
        factors=factors,
        considerations=considerations,
        plainLanguageSummary=summary,
        # Standard mode
        primaryIssue=primary_issue,
        caseComplexity=case_complexity,
        implantTiming=implant_timing,
        briefRationale=brief_rationale,
        # Detailed mode
        primaryIssueExpanded=primary_issue_expanded,
        complexityDrivers=complexity_drivers,
        immediatePlacementEligible=immediate_eligible,
        immediatePlacementReasons=immediate_reasons,
        riskModifiers=risk_modifiers if risk_modifiers else ["No significant risk modifiers identified"],
        clinicalRationale=clinical_rationale[:3],
        backupAwareness=backup_awareness
    )


def determine_primary_issue(planning_data: PlanningData, tooth_number: str, is_esthetic: bool, is_posterior: bool) -> str:
    """Generate concise primary issue label for Standard mode."""
    if planning_data.boneAvailability == BoneAvailability.INSUFFICIENT:
        return "Bone Deficiency"
    if is_esthetic and planning_data.softTissueBiotype == SoftTissueBiotype.THIN:
        return "Esthetic Zone + Thin Biotype"
    if is_esthetic:
        return "Esthetic Zone Placement"
    if is_posterior and planning_data.boneAvailability in [BoneAvailability.LIMITED, BoneAvailability.MODERATE]:
        return "Posterior Site"
    if planning_data.restorativeContext == "fixed_prosthesis":
        return "Full Arch Rehabilitation"
    if planning_data.smokingStatus == "current":
        return "Smoker - Modified Protocol"
    if planning_data.diabetesStatus == "uncontrolled":
        return "Systemic Optimization Needed"
    return "Standard Implant Placement"


def expand_primary_issue(planning_data: PlanningData, tooth_number: str, is_esthetic: bool, factors: List[str]) -> str:
    """Generate expanded primary issue description for Detailed mode."""
    parts = []
    
    # Location context
    if is_esthetic:
        parts.append(f"Implant planned for tooth #{tooth_number} in the esthetic zone")
    else:
        parts.append(f"Implant planned for tooth #{tooth_number}")
    
    # Bone context
    if planning_data.boneAvailability == BoneAvailability.INSUFFICIENT:
        parts.append("with insufficient bone volume that may require augmentation")
    elif planning_data.boneAvailability == BoneAvailability.LIMITED:
        parts.append("with limited bone that warrants careful dimension planning")
    elif planning_data.boneAvailability == BoneAvailability.ADEQUATE:
        parts.append("with adequate bone support")
    
    # Soft tissue context
    if planning_data.softTissueBiotype == SoftTissueBiotype.THIN and is_esthetic:
        parts.append("Thin gingival biotype in this visible area requires attention to soft tissue outcomes.")
    
    # Restorative context
    if planning_data.restorativeContext:
        resto_map = {
            "single_crown": "Final restoration will be a single crown.",
            "bridge_abutment": "Implant will serve as a bridge abutment.",
            "overdenture": "Implant will support an overdenture.",
            "fixed_prosthesis": "Part of a fixed full-arch prosthesis."
        }
        if planning_data.restorativeContext in resto_map:
            parts.append(resto_map[planning_data.restorativeContext])
    
    return " ".join(parts)


def determine_implant_timing(planning_data: PlanningData, risk_level: str, complexity_score: int, is_esthetic: bool) -> tuple:
    """Determine implant timing recommendation and immediate placement eligibility."""
    immediate_eligible = None
    immediate_reasons = []
    
    # Check for conditions that contraindicate immediate placement
    contraindications = []
    
    if planning_data.boneAvailability == BoneAvailability.INSUFFICIENT:
        contraindications.append("Insufficient bone requires augmentation first")
    
    if planning_data.diabetesStatus == "uncontrolled":
        contraindications.append("Systemic condition should be optimized before surgery")
    
    if any(med.lower() in ["bisphosphonates", "denosumab", "antiresorptive"] for med in planning_data.medications):
        contraindications.append("Antiresorptive medication history requires careful timing consideration")
    
    if planning_data.smokingStatus == "current" and is_esthetic:
        contraindications.append("Active smoking in esthetic zone increases immediate placement risk")
    
    # Determine timing recommendation
    if risk_level == "high" or complexity_score > 5:
        timing = "Delayed placement recommended"
        immediate_eligible = False
        immediate_reasons = contraindications if contraindications else ["Complex case factors favor staged approach"]
    elif contraindications:
        timing = "Conventional or delayed placement"
        immediate_eligible = False
        immediate_reasons = contraindications
    elif planning_data.boneAvailability == BoneAvailability.ADEQUATE and risk_level == "low":
        timing = "Immediate or early placement may be considered"
        immediate_eligible = True
        immediate_reasons = ["Favorable bone and risk profile support immediate consideration"]
    else:
        timing = "Conventional placement protocol"
        immediate_eligible = None  # Not applicable / case dependent
        immediate_reasons = []
    
    return timing, immediate_eligible, immediate_reasons


def generate_brief_rationale(complexity: str, primary_issue: str, timing: str) -> str:
    """Generate one-line rationale for Standard mode."""
    if complexity == "Simple":
        return f"{primary_issue} with favorable conditions supports {timing.lower()}."
    elif complexity == "Moderate":
        return f"{primary_issue} requires attention to specific factors; {timing.lower()} is appropriate."
    else:
        return f"{primary_issue} with multiple considerations; careful planning essential."

# ============ HELPER FUNCTIONS ============
def get_checklist_key(phase: ChecklistPhase) -> str:
    """Convert phase enum to camelCase checklist key"""
    key_map = {
        ChecklistPhase.PRE_TREATMENT: 'preTreatmentChecklist',
        ChecklistPhase.TREATMENT: 'treatmentChecklist',
        ChecklistPhase.POST_TREATMENT: 'postTreatmentChecklist',
    }
    return key_map[phase]

def add_timeline_entry(case: dict, action: str, details: str = None, phase: str = None) -> dict:
    entry = TimelineEntry(
        timestamp=datetime.now(timezone.utc).isoformat(),
        action=action,
        details=details,
        phase=phase
    )
    case["timeline"].append(entry.model_dump())
    return case

async def get_user_custom_checklist_items() -> List[str]:
    """Get custom checklist suggestions that have been approved from past cases."""
    cases = await db.cases.find(
        {"feedback.customChecklistSuggestions": {"$exists": True, "$ne": []}},
        {"_id": 0, "feedback.customChecklistSuggestions": 1}
    ).to_list(100)
    
    suggestions = []
    for case in cases:
        if case.get("feedback", {}).get("customChecklistSuggestions"):
            suggestions.extend(case["feedback"]["customChecklistSuggestions"])
    
    return list(set(suggestions))[:10]

# ============ ROUTES ============
@api_router.get("/")
async def root():
    return {"message": "Dental Implant Planning API", "disclaimer": "Decision support only. Final responsibility lies with the clinician."}

# Case CRUD
@api_router.post("/cases", response_model=Case)
async def create_case(input: CaseCreate):
    # Get custom checklist items from past learning
    custom_items = await get_user_custom_checklist_items()
    
    # Create default checklists with custom items
    pre_checklist = [ChecklistItem(**item) for item in DEFAULT_PRE_TREATMENT_CHECKLIST]
    treatment_checklist = [ChecklistItem(**item) for item in DEFAULT_TREATMENT_CHECKLIST]
    post_checklist = [ChecklistItem(**item) for item in DEFAULT_POST_TREATMENT_CHECKLIST]
    
    # Add custom items from learning loop
    for suggestion in custom_items:
        custom_item = ChecklistItem(
            text=suggestion,
            isCustom=True
        )
        pre_checklist.append(custom_item)
    
    case = Case(
        **input.model_dump(),
        preTreatmentChecklist=pre_checklist,
        treatmentChecklist=treatment_checklist,
        postTreatmentChecklist=post_checklist,
    )
    
    case = add_timeline_entry(
        case.model_dump(),
        "Case created",
        f"Tooth #{input.toothNumber}"
    )
    
    await db.cases.insert_one(case)
    return Case(**case)

@api_router.get("/cases", response_model=List[Case])
async def get_cases():
    cases = await db.cases.find({}, {"_id": 0}).to_list(1000)
    return [Case(**case) for case in cases]

@api_router.get("/cases/{case_id}", response_model=Case)
async def get_case(case_id: str):
    case = await db.cases.find_one({"id": case_id}, {"_id": 0})
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    return Case(**case)

@api_router.put("/cases/{case_id}", response_model=Case)
async def update_case(case_id: str, input: CaseUpdate):
    case = await db.cases.find_one({"id": case_id}, {"_id": 0})
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    
    update_data = input.model_dump(exclude_unset=True)
    
    if "planningData" in update_data and update_data["planningData"]:
        existing_planning = case.get("planningData", {})
        existing_planning.update(update_data["planningData"])
        update_data["planningData"] = existing_planning
    
    update_data["updatedAt"] = datetime.now(timezone.utc).isoformat()
    
    case.update(update_data)
    case = add_timeline_entry(case, "Case updated", str(list(update_data.keys())))
    
    await db.cases.update_one({"id": case_id}, {"$set": case})
    return Case(**case)

@api_router.delete("/cases/{case_id}")
async def delete_case(case_id: str):
    result = await db.cases.delete_one({"id": case_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Case not found")
    return {"message": "Case deleted successfully"}

# Planning Engine
@api_router.post("/cases/{case_id}/analyze", response_model=RiskAssessment)
async def analyze_case(case_id: str):
    case = await db.cases.find_one({"id": case_id}, {"_id": 0})
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    
    planning_data = PlanningData(**case.get("planningData", {}))
    risk_assessment = calculate_risk_assessment(planning_data, case.get("toothNumber", ""))
    
    case["riskAssessment"] = risk_assessment.model_dump()
    case["updatedAt"] = datetime.now(timezone.utc).isoformat()
    case = add_timeline_entry(case, "Risk assessment completed", f"Overall: {risk_assessment.overallRisk}")
    
    await db.cases.update_one({"id": case_id}, {"$set": case})
    return risk_assessment

# Checklist Management
@api_router.put("/cases/{case_id}/checklists", response_model=Case)
async def update_checklist(case_id: str, input: ChecklistUpdate):
    logger.info(f"Updating checklist for case {case_id}, phase {input.phase}")
    logger.info(f"Received {len(input.items)} items")
    if input.items:
        logger.info(f"First item: id={input.items[0].id}, completed={input.items[0].completed}")
    
    case = await db.cases.find_one({"id": case_id}, {"_id": 0})
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    
    checklist_key = get_checklist_key(input.phase)
    updated_items = [item.model_dump() for item in input.items]
    logger.info(f"Updated items to save: {len(updated_items)}, first completed: {updated_items[0].get('completed') if updated_items else 'N/A'}")
    
    case[checklist_key] = updated_items
    case["updatedAt"] = datetime.now(timezone.utc).isoformat()
    
    completed_count = sum(1 for item in input.items if item.completed)
    logger.info(f"Completed count: {completed_count}")
    case = add_timeline_entry(
        case, 
        "Checklist updated", 
        f"{completed_count}/{len(input.items)} completed",
        input.phase.value
    )
    
    # Log what we're about to save
    logger.info(f"Saving to DB - {checklist_key} has {len(case[checklist_key])} items")
    
    result = await db.cases.update_one({"id": case_id}, {"$set": case})
    logger.info(f"MongoDB update result: matched={result.matched_count}, modified={result.modified_count}")
    
    # Fetch fresh from DB to return
    updated_case = await db.cases.find_one({"id": case_id}, {"_id": 0})
    logger.info(f"Fresh from DB - {checklist_key} has {len(updated_case.get(checklist_key, []))} items")
    
    return Case(**updated_case)

@api_router.post("/cases/{case_id}/checklists/{phase}/item", response_model=Case)
async def add_checklist_item(case_id: str, phase: ChecklistPhase, item: ChecklistItemCreate):
    case = await db.cases.find_one({"id": case_id}, {"_id": 0})
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    
    checklist_key = get_checklist_key(phase)
    new_item = ChecklistItem(
        id=item.id,
        text=item.text,
        completed=item.completed,
        notes=item.notes,
        completedAt=item.completedAt,
        isCustom=True
    )
    case[checklist_key].append(new_item.model_dump())
    case["updatedAt"] = datetime.now(timezone.utc).isoformat()
    case = add_timeline_entry(case, "Checklist item added", item.text, phase.value)
    
    await db.cases.update_one({"id": case_id}, {"$set": case})
    return Case(**case)

# ============ PROSTHETIC CHECKLIST ENDPOINTS ============
@api_router.get("/cases/{case_id}/prosthetic-checklist")
async def get_prosthetic_checklist(case_id: str):
    """Get or initialize the dynamically filtered checklist for a case"""
    case = await db.cases.find_one({"id": case_id}, {"_id": 0})
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    
    # Check if case has a stored checklist with completion states
    stored_checklist = case.get("prostheticChecklist")
    
    # Generate filtered checklist based on case planning
    if MASTER_CHECKLIST:
        filtered_checklist = filter_checklist_for_case(MASTER_CHECKLIST, case)
        
        # If there's a stored checklist, merge completion states
        if stored_checklist:
            filtered_checklist = merge_completion_states(filtered_checklist, stored_checklist)
        
        # Store the filtered checklist structure
        case["prostheticChecklist"] = filtered_checklist
        case["updatedAt"] = datetime.now(timezone.utc).isoformat()
        await db.cases.update_one({"id": case_id}, {"$set": case})
        
        # Derive planning conditions for frontend display
        planning_conditions = derive_planning_conditions(case)
        
        return {
            "prostheticChecklist": filtered_checklist,
            "planningConditions": planning_conditions,
            "checklistVersion": MASTER_CHECKLIST.get("version", "1.0"),
            "isDynamic": True
        }
    else:
        # Fallback to legacy checklist if JSON not available
        if not stored_checklist:
            stored_checklist = DEFAULT_PROSTHETIC_CHECKLIST
        return {
            "prostheticChecklist": stored_checklist,
            "isDynamic": False
        }

def merge_completion_states(filtered_checklist: dict, stored_checklist: dict) -> dict:
    """Merge completion states from stored checklist into filtered checklist"""
    for phase_key, phase_data in filtered_checklist.items():
        stored_phase = stored_checklist.get(phase_key, {})
        
        for section_idx, section in enumerate(phase_data.get("sections", [])):
            stored_sections = stored_phase.get("sections", [])
            stored_section = stored_sections[section_idx] if section_idx < len(stored_sections) else {}
            
            for item_idx, item in enumerate(section.get("items", [])):
                stored_items = stored_section.get("items", [])
                # Find matching item by ID
                matching_stored = next((si for si in stored_items if si.get("id") == item["id"]), None)
                
                if matching_stored:
                    item["completed"] = matching_stored.get("completed", False)
                    item["completedAt"] = matching_stored.get("completedAt")
    
    return filtered_checklist

@api_router.get("/cases/{case_id}/prosthetic-checklist/master")
async def get_master_checklist(case_id: str):
    """Get the full master checklist (read-only, for reference)"""
    case = await db.cases.find_one({"id": case_id}, {"_id": 0})
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    
    if not MASTER_CHECKLIST:
        raise HTTPException(status_code=500, detail="Master checklist not available")
    
    return {
        "masterChecklist": MASTER_CHECKLIST,
        "version": MASTER_CHECKLIST.get("version", "1.0"),
        "isReadOnly": True
    }

@api_router.put("/cases/{case_id}/prosthetic-checklist")
async def update_prosthetic_checklist(case_id: str, checklist: dict):
    """Update the entire prosthetic checklist"""
    case = await db.cases.find_one({"id": case_id}, {"_id": 0})
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    
    case["prostheticChecklist"] = checklist
    case["updatedAt"] = datetime.now(timezone.utc).isoformat()
    
    # Count completed items (only visible items)
    total_items = 0
    completed_items = 0
    for phase_key, phase_data in checklist.items():
        for section in phase_data.get("sections", []):
            for item in section.get("items", []):
                total_items += 1
                if item.get("completed"):
                    completed_items += 1
    
    case = add_timeline_entry(
        case,
        "Prosthetic checklist updated",
        f"{completed_items}/{total_items} items completed"
    )
    
    await db.cases.update_one({"id": case_id}, {"$set": case})
    return {"message": "Checklist updated successfully", "progress": f"{completed_items}/{total_items}"}

# Learning Loop / Feedback
@api_router.put("/cases/{case_id}/feedback", response_model=Case)
async def update_feedback(case_id: str, input: FeedbackUpdate):
    case = await db.cases.find_one({"id": case_id}, {"_id": 0})
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    
    feedback_data = input.model_dump()
    feedback_data["reflectionCompletedAt"] = datetime.now(timezone.utc).isoformat()
    
    case["feedback"] = feedback_data
    case["updatedAt"] = datetime.now(timezone.utc).isoformat()
    case = add_timeline_entry(case, "Learning reflection completed", "Feedback recorded for future cases")
    
    await db.cases.update_one({"id": case_id}, {"$set": case})
    return Case(**case)

@api_router.get("/learning/suggestions")
async def get_learning_suggestions():
    """Get aggregated learning suggestions from past cases."""
    suggestions = await get_user_custom_checklist_items()
    return {
        "suggestions": suggestions,
        "disclaimer": "These suggestions are based on your past case reflections."
    }

# Attachments
@api_router.post("/cases/{case_id}/attachments", response_model=Case)
async def add_attachment(case_id: str, input: AttachmentAdd):
    case = await db.cases.find_one({"id": case_id}, {"_id": 0})
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    
    if input.type not in ["images", "cbctLinks", "stlLinks"]:
        raise HTTPException(status_code=400, detail="Invalid attachment type")
    
    if "attachments" not in case:
        case["attachments"] = {"images": [], "cbctLinks": [], "stlLinks": []}
    
    case["attachments"][input.type].append(input.url)
    case["updatedAt"] = datetime.now(timezone.utc).isoformat()
    case = add_timeline_entry(case, "Attachment added", f"Type: {input.type}")
    
    await db.cases.update_one({"id": case_id}, {"$set": case})
    return Case(**case)

@api_router.delete("/cases/{case_id}/attachments")
async def remove_attachment(case_id: str, type: str, url: str):
    case = await db.cases.find_one({"id": case_id}, {"_id": 0})
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    
    if type in case.get("attachments", {}):
        case["attachments"][type] = [u for u in case["attachments"][type] if u != url]
        case["updatedAt"] = datetime.now(timezone.utc).isoformat()
        await db.cases.update_one({"id": case_id}, {"$set": case})
    
    return {"message": "Attachment removed"}

# Status update
@api_router.put("/cases/{case_id}/status", response_model=Case)
async def update_status(case_id: str, status: CaseStatus):
    case = await db.cases.find_one({"id": case_id}, {"_id": 0})
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    
    case["status"] = status.value
    case["updatedAt"] = datetime.now(timezone.utc).isoformat()
    case = add_timeline_entry(case, "Status changed", f"New status: {status.value}")
    
    await db.cases.update_one({"id": case_id}, {"$set": case})
    return Case(**case)

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
