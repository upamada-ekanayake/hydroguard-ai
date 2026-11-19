# backend/agents/graph.py
import os
from typing import Any, Dict, List, TypedDict

import joblib
import pandas as pd
from dotenv import load_dotenv
from langchain_google_genai import ChatGoogleGenerativeAI
from langgraph.graph import END, START, StateGraph

from database import fetch_all

load_dotenv()

# Load the trained XGBoost models at startup (created by ml/train_model.py)
MODEL_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "ml")

try:
    risk_model = joblib.load(os.path.join(MODEL_DIR, "risk_model.pkl"))
    cusecs_model = joblib.load(os.path.join(MODEL_DIR, "cusecs_model.pkl"))
    MODELS_LOADED = True
except Exception as _model_err:  # keep the API bootable if the .pkl files are missing
    risk_model = cusecs_model = None
    MODELS_LOADED = False
    print(f"[WARN] ML models not loaded ({_model_err}). Run ml/train_model.py")


# 1. Define the State (The "Memory" passed between agents)
class GraphState(TypedDict):
    rainfall_mm: float
    current_water_level: float
    threshold_exceeded: bool
    risk_level: str
    estimated_cusecs: int
    affected_gn_divisions: List[Dict[str, Any]]
    safe_shelters: List[Dict[str, Any]]
    alert_messages: Dict[str, str]  # Keys: 'en', 'si', 'ta'
    messages: List[str]


# 2. Initialize the LLM (Gemini)
#    Model names change: gemini-1.5-flash, gemini-2.0-flash-exp and gemini-2.5-flash
#    are all retired on this API, so the model is configurable and has fallbacks.
MODEL = os.getenv("GEMINI_MODEL", "gemini-flash-lite-latest")
FALLBACK_MODELS = ("gemini-flash-lite-latest", "gemini-flash-latest")


def _llm(model: str) -> ChatGoogleGenerativeAI:
    return ChatGoogleGenerativeAI(
        model=model,
        google_api_key=os.getenv("GOOGLE_API_KEY"),
        temperature=0.2,  # Low temperature for factual, consistent predictions
    )


def _text_of(content) -> str:
    """LangChain 1.x returns a list of content blocks; flatten it to plain text."""
    if isinstance(content, str):
        return content.strip()
    parts = []
    for block in content or []:
        if isinstance(block, str):
            parts.append(block)
        elif isinstance(block, dict):
            parts.append(block.get("text", ""))
    return "".join(parts).strip()


def _ask_gemini(prompt: str) -> str:
    """Ask Gemini, falling back through other models if one is overloaded/unavailable."""
    last_error = ""
    for model in dict.fromkeys((MODEL, *FALLBACK_MODELS)):
        try:
            return _text_of(_llm(model).invoke(prompt).content)
        except Exception as exc:  # 503s and retired models should not kill the pipeline
            last_error = f"{model}: {exc}"
    return f"(LLM unavailable -> {last_error})"


# --- AGENT 1: THE WATCHER ---
def agent_1_watcher(state: GraphState) -> GraphState:
    # ASCII only: the Windows console is cp1252 and crashes on emoji
    print("[Agent 1] Watcher: checking sensor data...")

    # Sensor readings come from the API request (Phase 5: admin sliders).
    # In a real app this would also call the Open-Meteo API for live rainfall.
    rainfall = state["rainfall_mm"]
    water_level = state["current_water_level"]

    # Baseline safety thresholds for Victoria Dam
    RAINFALL_THRESHOLD = 100.0
    WATER_LEVEL_THRESHOLD = 1140.0

    threshold_exceeded = (rainfall > RAINFALL_THRESHOLD) or (water_level > WATER_LEVEL_THRESHOLD)

    print(f"   -> Rainfall: {rainfall}mm, Level: {water_level}ft")
    print(f"   -> Threshold exceeded: {threshold_exceeded}")

    return {
        **state,
        "rainfall_mm": rainfall,
        "current_water_level": water_level,
        "threshold_exceeded": threshold_exceeded,
        "messages": state["messages"] + ["Agent 1: Data collected. Thresholds checked."],
    }


# --- AGENT 2: THE BRAIN ---
def agent_2_brain(state: GraphState) -> GraphState:
    print("[Agent 2] Brain: running XGBoost ML prediction...")

    if not state["threshold_exceeded"]:
        print("   -> Risk level: NORMAL. No spill expected.")
        return {
            **state,
            "risk_level": "NORMAL",
            "estimated_cusecs": 0,
            "messages": state["messages"] + ["Agent 2: Risk level NORMAL. No action needed."],
        }

    if not MODELS_LOADED:
        # Fallback so the pipeline still answers if the .pkl files are missing
        return {
            **state,
            "risk_level": "WARNING",
            "estimated_cusecs": 40000,
            "messages": state["messages"]
            + ["Agent 2: ML models missing - used heuristic estimate (40000 cusecs)."],
        }

    # Prepare features for the ML model
    features = pd.DataFrame(
        [
            {
                "rainfall_mm": state["rainfall_mm"],
                "water_level_ft": state["current_water_level"],
                "inflow_rate": state["rainfall_mm"] * 50,  # Simulated inflow correlation
            }
        ]
    )

    # Predict using the real trained models
    risk_pred = int(risk_model.predict(features)[0])
    cusecs_pred = int(cusecs_model.predict(features)[0])

    risk_map = {0: "NORMAL", 1: "WARNING", 2: "CRITICAL"}
    final_risk = risk_map.get(risk_pred, "WARNING")

    print(f"   -> ML predicted risk: {final_risk}")
    print(f"   -> ML predicted cusecs: {cusecs_pred}")

    return {
        **state,
        "risk_level": final_risk,
        "estimated_cusecs": cusecs_pred,
        "messages": state["messages"]
        + [f"Agent 2: ML prediction complete. Risk is {final_risk}."],
    }


# --- AGENT 3: THE MAPPER ---
def agent_3_mapper(state: GraphState) -> GraphState:
    print("[Agent 3] Mapper: identifying affected zones and shelters...")

    if state["risk_level"] == "NORMAL":
        print("   -> No zones at risk.")
        return {
            **state,
            "affected_gn_divisions": [],
            "safe_shelters": [],
            "messages": state["messages"] + ["Agent 3: No zones at risk."],
        }

    # Query DB for GN divisions matching the risk level (e.g., 'critical' or 'warning')
    target_risk = state["risk_level"].lower()
    gn_rows = fetch_all(
        "SELECT id, name, name_si, name_ta, district, elevation_meters FROM gn_divisions"
        " WHERE lower(risk_zone) = %s ORDER BY id",
        (target_risk,),
    )

    affected_gns = [dict(row) for row in gn_rows] if gn_rows else []
    gn_ids = [gn["id"] for gn in affected_gns]

    shelters = []
    if gn_ids:
        # Find shelters in those specific GN divisions
        shelter_rows = fetch_all(
            "SELECT name, name_si, name_ta, latitude, longitude, capacity FROM shelters"
            " WHERE gn_division_id = ANY(%s) ORDER BY id",
            (gn_ids,),
        )
        shelters = [dict(row) for row in shelter_rows] if shelter_rows else []

    print(f"   -> Found {len(affected_gns)} affected GN divisions.")
    print(f"   -> Found {len(shelters)} safe shelters.")

    return {
        **state,
        "affected_gn_divisions": affected_gns,
        "safe_shelters": shelters,
        "messages": state["messages"]
        + [f"Agent 3: Mapped {len(affected_gns)} zones and {len(shelters)} shelters."],
    }


# --- AGENT 4: THE COMMUNICATOR ---
def _pick_alert(text: str, label: str) -> str:
    """Pull the 'English: ...' style line out of the LLM output, tolerating markdown."""
    for line in text.splitlines():
        clean = line.strip().lstrip("*#- ").replace("**", "")
        if clean.lower().startswith(label.lower() + ":"):
            return clean.split(":", 1)[1].strip()
    return ""


def agent_4_communicator(state: GraphState) -> GraphState:
    print("[Agent 4] Communicator: drafting multilingual alerts...")

    if state["risk_level"] == "NORMAL":
        print("   -> Normal status communicated.")
        return {
            **state,
            "alert_messages": {
                "en": "All clear. Normal water levels.",
                "si": "සියල්ල හරි. ජල මට්ටම සාමාන්‍යයි.",
                "ta": "எல்லாம் சரி. நீர் மட்டம் சாதாரணமாக உள்ளது.",
            },
            "messages": state["messages"] + ["Agent 4: Normal status communicated."],
        }

    gn_names = ", ".join([gn["name"] for gn in state["affected_gn_divisions"]])
    shelter_names = (
        ", ".join([s["name"] for s in state["safe_shelters"]])
        if state["safe_shelters"]
        else "Nearest high ground"
    )

    # Native place names, falling back to the English name when a row has none
    gn_names_si = ", ".join([gn["name_si"] for gn in state["affected_gn_divisions"] if gn.get("name_si")]) or gn_names
    gn_names_ta = ", ".join([gn["name_ta"] for gn in state["affected_gn_divisions"] if gn.get("name_ta")]) or gn_names
    shelter_names_si = (
        ", ".join([s["name_si"] for s in state["safe_shelters"] if s.get("name_si")])
        or shelter_names
    )
    shelter_names_ta = (
        ", ".join([s["name_ta"] for s in state["safe_shelters"] if s.get("name_ta")])
        or shelter_names
    )
    cusecs = state["estimated_cusecs"]

    # FEW-SHOT PROMPTING: Giving the LLM perfect examples to copy
    prompt = f"""
    You are an emergency response AI for Sri Lanka.
    Generate a clear, calm, and urgent flood evacuation alert in English, Sinhala, and Tamil based on this data:
    - Risk Level: {state['risk_level']}
    - Predicted Release: {cusecs} cusecs
    - Affected Areas: {gn_names}
    - Safe Shelters: {shelter_names}

    Follow this EXACT format and tone (copy the style of these examples):

    EXAMPLE OUTPUT:
    English: URGENT FLOOD WARNING: Victoria Dam will release {cusecs} cusecs. Residents in {gn_names} must evacuate immediately to {shelter_names}. Avoid riverbanks.
    Sinhala: හදිසි ගංවතුර අනතුරු ඇඟවීම: වික්ටෝරියා වේල්ලෙන් {cusecs} ක්‍යුසෙක්ස් ජලය මුදා හරිනු ලැබේ. {gn_names_si} ප්‍රදේශවාසීන් වහාම {shelter_names_si} වෙත ආරක්ෂිතව ගමන් කරන්න. ගංගා ඉවුරු වලින් ඉවත් වන්න.
    Tamil: அவசர வெள்ள எச்சரிக்கை: விக்டோரியா அணையிலிருந்து {cusecs} கியூசெக்ஸ் நீர் வெளியிடப்படும். {gn_names_ta} பகுதி மக்கள் உடனடியாக {shelter_names_ta} க்கு பாதுகாப்பாக செல்லவும். ஆற்றங்கரைகளில் இருந்து விலகி இருங்கள்.

    Now, generate the alert for the current data. Output exactly three lines, each starting with
    English:, Sinhala:, Tamil:. No other text.
    """

    alert_text = _ask_gemini(prompt)

    en_msg = _pick_alert(alert_text, "English") or "Alert: Evacuate immediately."
    si_msg = _pick_alert(alert_text, "Sinhala") or "අනතුරු ඇඟවීම: වහාම ඉවත් වන්න."
    ta_msg = _pick_alert(alert_text, "Tamil") or "எச்சரிக்கை: உடனடியாக வெளியேறுங்கள்."

    if alert_text.startswith("(LLM unavailable"):
        print(f"   -> LLM error, sent fallback text: {alert_text[:100]}")
        messages = state["messages"] + ["Agent 4: LLM unavailable - used fallback alert text."]
    else:
        print("   -> Alerts generated in 3 languages.")
        messages = state["messages"] + ["Agent 4: Multilingual alerts generated."]

    return {
        **state,
        "alert_messages": {"en": en_msg, "si": si_msg, "ta": ta_msg},
        "messages": messages,
    }


# --- BUILD THE GRAPH ---
def build_hydroguard_graph():
    workflow = StateGraph(GraphState)

    # Add nodes (the agents)
    workflow.add_node("watcher", agent_1_watcher)
    workflow.add_node("brain", agent_2_brain)
    workflow.add_node("mapper", agent_3_mapper)
    workflow.add_node("communicator", agent_4_communicator)

    # Add edges (the flow)
    workflow.add_edge(START, "watcher")
    workflow.add_edge("watcher", "brain")
    workflow.add_edge("brain", "mapper")
    workflow.add_edge("mapper", "communicator")
    workflow.add_edge("communicator", END)

    # Compile the graph
    return workflow.compile()


# Create a global instance of the graph
hydroguard_graph = build_hydroguard_graph()
