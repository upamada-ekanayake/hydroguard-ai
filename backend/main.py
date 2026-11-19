from typing import Optional

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from agents.graph import hydroguard_graph  # Import the graph
from database import fetch_all

app = FastAPI(title="HydroGuard AI API")


class AgentRequest(BaseModel):
    rainfall_mm: Optional[float] = 150.5  # Default to critical for easy testing
    current_water_level: Optional[float] = 1150.2

# Allow frontend to talk to backend (Important for Next.js later)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def read_root():
    return {"message": "HydroGuard AI Backend is running! 🌊"}


@app.get("/status")
def get_status():
    return {"status": "online", "dam_level": "normal"}


@app.get("/test-db")
def test_database():
    try:
        # Try to fetch data from the gn_divisions table
        rows = fetch_all("SELECT * FROM gn_divisions")
        return {"message": "Database connected successfully!", "data_count": len(rows)}
    except Exception as e:
        return {"error": str(e)}


# NEW: Endpoint to trigger the AI Agents
@app.post("/run-agents")
def run_ai_agents(request: AgentRequest | None = None):
    try:
        # Body is optional: an empty POST is treated as the defaults above
        req = request or AgentRequest()

        # Initial state passed into the graph
        initial_state = {
            "rainfall_mm": req.rainfall_mm,
            "current_water_level": req.current_water_level,
            "threshold_exceeded": False,
            "risk_level": "UNKNOWN",
            "estimated_cusecs": 0,
            "affected_gn_divisions": [],
            "safe_shelters": [],
            "alert_messages": {},
            "messages": [],
        }

        # Execute the LangGraph workflow
        final_state = hydroguard_graph.invoke(initial_state)

        return {
            "status": "success",
            "input_data": {
                "rainfall_mm": req.rainfall_mm,
                "water_level": req.current_water_level,
            },
            "final_risk_level": final_state["risk_level"],
            "estimated_cusecs": final_state["estimated_cusecs"],
            "affected_areas": final_state["affected_gn_divisions"],
            "safe_shelters": final_state["safe_shelters"],
            "multilingual_alerts": final_state["alert_messages"],
            "agent_log": final_state["messages"],
        }
    except Exception as e:
        return {"status": "error", "message": str(e)}
