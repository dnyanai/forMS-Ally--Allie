"""
forMS Ally Backend API
FastAPI server connecting frontend to Gemini Agent and MCP Server.

Architecture:
    Frontend (React) → Backend (FastAPI) → MCP Server (Cloud Run) → BigQuery

Endpoints:
    - GET  /                  Health check
    - POST /chat              Chat with AI agent
    - POST /speak             Text-to-speech (ElevenLabs)
    - POST /log/symptoms      Log symptoms via MCP
    - GET  /report/symptoms   Get symptom history from BigQuery
    - GET  /report/summary    Get summary stats from BigQuery
    - POST /search/reddit     Search r/MultipleSclerosis via MCP
    - POST /search/google     Search Google via MCP
"""

import uuid
import traceback
import uvicorn

from datetime import datetime
from typing import Optional, List
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel
import httpx

from config import Config, Client
from mcp_client import call_mcp_tool
from services.agent import get_response


# =============================================================================
# FASTAPI APP INITIALIZATION
# =============================================================================
print(f"🚀 Starting forMS Ally API")
print(f"   Port: 8080")
print(f"   MCP Server: {Config.MCP_SERVER_URL}")

app = FastAPI(
    title="forMS Ally API",
    description="Backend API for MS symptom tracking and AI companion",
    version="2.0.0"
)

# CORS middleware - allows frontend to call backend

origins = origins = [
    "http://localhost:3000",  # For local development
    "http://localhost:8000",  # If you test your frontend with a different local port
    "https://for-ms-frontend-a66z2lnrya-uw.a.run.app", # Your deployed frontend URL
    # Add any other frontend URLs if you have multiple environments (staging, dev)
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    
)


# =============================================================================
# REQUEST/RESPONSE MODELS
# =============================================================================
class ChatMessage(BaseModel):
    """Single message in conversation history."""
    role: str       # 'user' or 'assistant'
    content: str    # Message text


class ChatRequest(BaseModel):
    """Request body for /chat endpoint."""
    message: str                                    # Current user message
    history: Optional[List[ChatMessage]] = []       # Previous messages
    session_id: Optional[str] = None                # Conversation session ID
    input_type: str = "text"                        # 'text' or 'audio'


class ChatResponse(BaseModel):
    """Response body for /chat endpoint."""
    text: str           # Assistant's response
    session_id: str     # Session ID for conversation tracking


class SpeakRequest(BaseModel):
    """Request body for /speak endpoint."""
    text: str   # Text to convert to speech


class LogSymptomsRequest(BaseModel):
    """Request body for /log/symptoms endpoint."""
    mood: int                                       # 1-10 scale
    fatigue: int                                    # 1-10 scale
    symptoms: Optional[List[str]] = []              # e.g., ["tingling", "brain fog"]
    medications_taken: Optional[List[str]] = []     # e.g., ["Kesimpta", "Vitamin D"]
    period_status: Optional[str] = None             # "started", "ongoing", "ended"
    notes: Optional[str] = ""                       # Free-form notes


class SearchRequest(BaseModel):
    """Request body for search endpoints."""
    query: str                      # Search query
    limit: Optional[int] = 5        # Max results (1-10)


# =============================================================================
# HEALTH CHECK
# =============================================================================
@app.get("/")
async def health_check():
    """
    Health check endpoint.
    
    Returns:
        Service status and configuration info
    """
    return {
        "status": "healthy",
        "service": "forMS Ally API",
        "mcp_server": Config.MCP_SERVER_URL
    }


# =============================================================================
# CHAT ENDPOINT
# =============================================================================
@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """
    Chat with the AI agent.
    
    The agent can:
        - Log symptoms when user describes how they feel
        - Search Reddit for community experiences
        - Search Google for MS information
        - Provide supportive conversation
    
    Args:
        request: ChatRequest with message, history, session_id
        
    Returns:
        ChatResponse with assistant's response and session_id
        
    Raises:
        HTTPException: 500 if agent fails
    """
    try:
        # Convert history to format agent expects
        history = [{"role": msg.role, "content": msg.content} for msg in request.history]
        
        # Generate or use existing session ID
        session_id = request.session_id or f"conv_{datetime.now().strftime('%Y%m%d%H%M%S')}_{uuid.uuid4().hex[:8]}"
        
        # Call the Gemini agent
        response_text = await get_response(request.message, history)
        
        # Handle None response
        if not response_text:
            response_text = "I'm sorry, I couldn't process that. Please try again."
        
        # Log conversation to BigQuery via MCP
        try:
            await call_mcp_tool("log_conversation", {
                "session_id": session_id,
                "user_message": request.message,
                "assistant_message": response_text,
                "input_type": "text"
            })
            print(f"✅ Logged conversation: {session_id[:20]}...")
        except Exception as e:
            print(f"⚠️ Conversation log failed: {e}")
        
        return ChatResponse(text=response_text, session_id=session_id)
        
    except Exception as e:
        print(f"❌ Chat error: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# TEXT-TO-SPEECH (ELEVENLABS)
# =============================================================================
@app.post("/speak")
async def speak(request: SpeakRequest):
    """
    Convert text to speech using ElevenLabs API.
    
    Args:
        request: SpeakRequest with text to convert
        
    Returns:
        Audio file (audio/mpeg)
        
    Raises:
        HTTPException: 400 if no text, 500 if not configured, 502 if ElevenLabs fails
    """
    # Validate configuration
    if not Config.ELEVENLABS_API_KEY:
        raise HTTPException(status_code=500, detail="ElevenLabs API key not configured")
    
    # Validate input
    if not request.text.strip():
        raise HTTPException(status_code=400, detail="No text provided")
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"https://api.elevenlabs.io/v1/text-to-speech/{Config.ELEVENLABS_VOICE_ID}",
                headers={
                    "xi-api-key": Config.ELEVENLABS_API_KEY,
                    "Content-Type": "application/json"
                },
                json={
                    "text": request.text,
                    "model_id": Config.ELEVENLABS_TTS_MODEL_ID,
                    "voice_settings": {
                        "stability": 0.5,
                        "similarity_boost": 0.75
                    }
                },
                timeout=30.0
            )
            response.raise_for_status()
            return Response(content=response.content, media_type="audio/mpeg")
            
    except httpx.HTTPStatusError as e:
        print(f"❌ ElevenLabs error: {e}")
        raise HTTPException(status_code=502, detail="TTS service error")
    except Exception as e:
        print(f"❌ TTS error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# SYMPTOM LOGGING (VIA MCP)
# =============================================================================
@app.post("/log/symptoms")
async def log_symptoms(request: LogSymptomsRequest):
    """
    Log symptoms via MCP server to BigQuery (tbl_trkr).
    
    Called by the Track tab in the frontend for manual symptom entry.
    The chat agent also calls this automatically when users describe symptoms.
    
    Args:
        request: LogSymptomsRequest with mood, fatigue, symptoms, etc.
        
    Returns:
        {"success": True, "entry_id": "..."} or {"success": False, "error": "..."}
    """
    print(f"📝 Logging symptoms: mood={request.mood}, fatigue={request.fatigue}")
    
    result = await call_mcp_tool("log_symptoms", {
        "mood": request.mood,
        "fatigue": request.fatigue,
        "symptoms": request.symptoms or [],
        "medications_taken": request.medications_taken or [],
        "period_status": request.period_status,
        "notes": request.notes or ""
    })
    
    if result.get("success"):
        print(f"✅ Logged to BigQuery: {result.get('entry_id')}")
        return {"success": True, "entry_id": result.get("entry_id")}
    else:
        print(f"❌ Log failed: {result.get('error')}")
        return {"success": False, "error": result.get("error", "Unknown error")}


# =============================================================================
# REPORT ENDPOINTS (DIRECT BIGQUERY)
# =============================================================================
@app.get("/report/symptoms")
async def get_symptoms_report(days: int = 7):
    """
    Get symptom logs from BigQuery.
    
    Queries tbl_trkr directly for the Report tab in frontend.
    
    Args:
        days: Number of days to look back (default 7)
        
    Returns:
        {"success": True, "logs": [...]} with symptom entries
    """
    try:
        client = Client.get_bigquery_client()
        
        query = f"""
            SELECT * 
            FROM `{Config.GOOGLE_CLOUD_PROJECT}.{Config.BIGQUERY_DATASET}.tbl_trkr`
            WHERE entry_date >= DATETIME_SUB(CURRENT_DATETIME(), INTERVAL {days} DAY)
            ORDER BY entry_date DESC
            LIMIT 100
        """
        
        results = client.query(query).result()
        logs = [dict(row) for row in results]
        
        return {"success": True, "logs": logs}
        
    except Exception as e:
        print(f"❌ Report error: {e}")
        return {"success": True, "logs": []}


@app.get("/report/summary")
async def get_summary_report(days: int = 7):
    """
    Get summary statistics from BigQuery.
    
    Calculates:
        - Total entries
        - Average mood
        - Average fatigue
        - Top 5 symptoms
    
    Args:
        days: Number of days to look back (default 7)
        
    Returns:
        {"success": True, "summary": {...}} with stats
    """
    try:
        client = Client.get_bigquery_client()
        
        # Basic stats query
        stats_query = f"""
            SELECT 
                COUNT(*) as total_entries,
                ROUND(AVG(mood), 1) as avg_mood,
                ROUND(AVG(fatigue), 1) as avg_fatigue
            FROM `{Config.GOOGLE_CLOUD_PROJECT}.{Config.BIGQUERY_DATASET}.tbl_trkr`
            WHERE entry_date >= DATETIME_SUB(CURRENT_DATETIME(), INTERVAL {days} DAY)
        """
        result = list(client.query(stats_query).result())[0]
        
        # Top symptoms query
        symptom_query = f"""
            SELECT symptom, COUNT(*) as count
            FROM `{Config.GOOGLE_CLOUD_PROJECT}.{Config.BIGQUERY_DATASET}.tbl_trkr`,
            UNNEST(symptoms) as symptom
            WHERE entry_date >= DATETIME_SUB(CURRENT_DATETIME(), INTERVAL {days} DAY)
            GROUP BY symptom
            ORDER BY count DESC
            LIMIT 5
        """
        top_symptoms = [
            {"symptom": row.symptom, "count": row.count}
            for row in client.query(symptom_query).result()
        ]
        
        return {
            "success": True,
            "summary": {
                "total_entries": result.total_entries,
                "avg_mood": float(result.avg_mood) if result.avg_mood else None,
                "avg_fatigue": float(result.avg_fatigue) if result.avg_fatigue else None,
                "top_symptoms": top_symptoms,
                "days": days
            }
        }
        
    except Exception as e:
        print(f"❌ Summary error: {e}")
        return {
            "success": True,
            "summary": {
                "total_entries": 0,
                "avg_mood": None,
                "avg_fatigue": None,
                "top_symptoms": [],
                "days": days
            }
        }


# =============================================================================
# SEARCH ENDPOINTS (VIA MCP)
# =============================================================================
@app.post("/search/reddit")
async def search_reddit(request: SearchRequest):
    """
    Search r/MultipleSclerosis subreddit via MCP server.
    
    Uses Google Custom Search API restricted to Reddit.
    Good for finding community experiences and peer support.
    
    Args:
        request: SearchRequest with query and limit
        
    Returns:
        {"success": True, "results": [...]} with Reddit posts
    """
    try:
        result = await call_mcp_tool("search_reddit", {
            "query": request.query,
            "limit": request.limit or 5
        })
        return result
    except Exception as e:
        print(f"❌ Reddit search error: {e}")
        return {"success": False, "error": str(e)}


@app.post("/search/google")
async def search_google(request: SearchRequest):
    """
    Search Google for MS information via MCP server.
    
    Uses Google Custom Search API for general web search.
    Good for medical information and research.
    
    Args:
        request: SearchRequest with query and limit
        
    Returns:
        {"success": True, "results": [...]} with search results
    """
    try:
        result = await call_mcp_tool("search_google", {
            "query": request.query,
            "limit": request.limit or 5
        })
        return result
    except Exception as e:
        print(f"❌ Google search error: {e}")
        return {"success": False, "error": str(e)}


# =============================================================================
# RUN SERVER
# =============================================================================
if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8080)