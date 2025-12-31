from datetime import datetime, timezone 
from .config import Config
# from google import genai

"""
Tracker tools for forMS SympBot MCP Server.

Tools:
    - log_symptoms: Log daily symptoms to BigQuery (tbl_trkr)
    - log_conversation: v1 log conversation to tbl converstaion 
    - (Next version) log_conversation_with_embedding: v2 Log conversation + embeddings to BigQuery (tbl_conv + tbl_embeddings)
    

Tables:
    - tbl_trkr: Symptom tracking data
    - tbl_conv: Conversation history
    - tbl_embeddings: Vector embeddings (FK to tbl_conv)
"""

project = Config.GOOGLE_CLOUD_PROJECT
dataset = Config.BIGQUERY_DATASET
#bq_creds_path = os.getenv("SA_BQ_CREDENTIALS")


# Table IDs
TABLE_TRKR = Config.TABLE_TRKR
TABLE_CONV = Config.TABLE_CONV
#TABLE_EMBEDDINGS = f"{project}.{dataset}.tbl_embd"

# Embedding model
#api_key = os.getenv("GOOGLE_GENAI_API_KEY")
#EMBEDDING_MODEL = "text-embedding-004"

# Valid values
VALID_PERIOD_STATUSES = {"started", "ongoing", "ended", None}
VALID_ROLES = {"user", "assistant"}
VALID_INPUT_TYPES = {"text", "audio"}
VALID_CONTENT_TYPES = {"user_message", "assistant_response", "search_result"}


class ToolError(Exception):
    """Custom exception for tool operations."""
    pass

# def get_genai_client():
#     """
#     Initialize and return the Gemini client for embeddings.
#     """
#     try:
        
#         if not api_key:
#             raise ToolError("GOOGLE_GENAI_API_KEY or GEMINI_API_KEY not set")
        
#         return genai.Client(api_key=api_key)
    
#     except Exception as e:
#         raise ToolError(f"Failed to initialize Gemini Client: {str(e)}")

# def generate_embedding(text: str) -> list[float]:
#     """
#     Generate embedding for text using Gemini text-embedding-004.
    
#     Args:
#         text: Text to embed
    
#     Returns:
#         List of floats (768 dimensions)
#     """
#     try:
#         client = get_genai_client()
        
#         response = client.models.embed_content(
#             model=EMBEDDING_MODEL,
#             content=text
#         )
        
#         return response.embeddings[0].values
    
#     except Exception as e:
#         print(f"⚠️ Embedding generation failed: {e}")
#         return []  # Return empty on failure, don't block conversation logging

# =============================================================================
# LOG SYMPTOMS - tbl_trkr
# =============================================================================
async def log_symptoms(
    mood: int, 
    fatigue: int, 
    symptoms: list[str] | None = None, 
    medications_taken: list[str] | None = None, 
    period_status: str | None = None, 
    notes: str = ""
) -> dict:
    """
    Log daily symptoms for the MS patient to BigQuery (tbl_trkr).
    
    Args:
        mood: Mood rating 1-10 (1=poor, 10=great)
        fatigue: Fatigue level 1-10 (1=energetic, 10=exhausted)
        symptoms: List of symptoms experienced
        medications_taken: Medications taken today
        period_status: Menstrual cycle status (started/ongoing/ended/null)
        notes: Free-form notes
    
    Returns:
        {"success": True, "message": "...", "entry_id": "..."}
        or {"success": False, "error": "..."}
    """
    
    try:
        # Input validation
        if not isinstance(mood, int) or not 1 <= mood <= 10:
            return {"success": False, "error": "Mood must be integer 1-10"}

        if not isinstance(fatigue, int) or not 1 <= fatigue <= 10:
            return {"success": False, "error": "Fatigue must be integer 1-10"}
        
        # if symptoms is not None and not isinstance(symptoms, list):
        #     return {"success": False, "error": "Symptoms must be a list"}

        # if medications_taken is not None and not isinstance(medications_taken, list):
        #     return {"success": False, "error": "medications_taken must be a list"}

        if period_status is not None:
            # if not isinstance(period_status, str):
            #     return {"success": False, "error": "period_status must be a string"}
            period_status = period_status.lower().strip()
            if period_status not in {"started", "ongoing", "ended"}:
                return {"success": False, "error": "period_status must be 'started', 'ongoing', or 'ended'"}

        # Get BQ client
        try: 
            client = Config.get_bq_client()

        except ToolError as e:
            return {"success": False, "error": str(e)}

        # Generate entry ID
        entry_id = f"sym{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}"

        row = {
            "entry_id": entry_id, 
            "entry_date": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S"),
            "mood": mood, 
            "fatigue": fatigue, 
            "symptoms": symptoms or [],
            "medications_taken": medications_taken or [],
            "period_status": period_status,
            "notes": notes or ""
        }

        # Insert to BigQuery
        errors = client.insert_rows_json(TABLE_TRKR, [row])

        if errors:
            return {"success": False, "error": f"BigQuery insert failed: {errors}"}
        
        # Build response message
        message_parts = [f"mood={mood}/10", f"fatigue={fatigue}/10"]
        if symptoms:
            message_parts.append(f"symptoms={symptoms}")
        if period_status:
            message_parts.append(f"period={period_status}")

        return {
            "success": True,
            "message": f"Logged: {', '.join(message_parts)}",
            "entry_id": entry_id
        }

    except Exception as e:
        return {"success": False, "error": f"Unexpected error: {str(e)}"}

# =============================================================================
# LOG CONVERSATION WITH EMBEDDING - tbl_conv + tbl_embeddings
# =============================================================================
# async def log_conversation_with_embedding(
#     session_id: str,
#     user_message: str,
#     assistant_response: str,
#     input_type: str = "text",
#     entry_id: str | None = None,
#     intent_detected: list[str] | None = None ) 
# -> dict:
    # """
    # Log a complete conversation exchange (user + assistant) with embeddings.
    
    # Saves to:
    #     - tbl_conv: Both user and assistant messages
    #     - tbl_embeddings: Embeddings for both messages
    
    # Args:
    #     session_id: Unique conversation session identifier
    #     user_message: The user's message
    #     assistant_response: The assistant's response
    #     input_type: How message was received ('text' or 'audio')
    #     entry_id: FK to tbl_trkr.entry_id if symptoms were logged
    #     intent_detected: List of detected intents
    
    # Returns:
    #     {"success": True, "message": "...", "session_id": "..."}
    #     or {"success": False, "error": "..."}
    # """
    
    # try:
    #     # Input validation
    #     if not session_id or not session_id.strip():
    #         return {"success": False, "error": "session_id is required"}
        
    #     if not user_message or not user_message.strip():
    #         return {"success": False, "error": "user_message is required"}
        
    #     if not assistant_response or not assistant_response.strip():
    #         return {"success": False, "error": "assistant_response is required"}
        
    #     if input_type not in VALID_INPUT_TYPES:
    #         return {"success": False, "error": f"input_type must be one of {VALID_INPUT_TYPES}"}

    #     # Get BQ client
    #     try:
    #         client = get_bq_client()
    #     except ToolError as e:
    #         return {"success": False, "error": str(e)}

    #     now = datetime.now(timezone.utc)
    #     timestamp = now.strftime("%Y-%m-%d %H:%M:%S")
        
    #     # ---------------------------------------------------------------------
    #     # 1. Insert user message to tbl_conv
    #     # ---------------------------------------------------------------------
    #     user_row = {
    #         "session_id": session_id.strip(),
    #         "entry_id": entry_id,
    #         "session_date": timestamp,
    #         "role": "user",
    #         "content": user_message.strip(),
    #         "input_type": input_type,
    #         "intent_detected": intent_detected or []
    #     }
        
    #     # ---------------------------------------------------------------------
    #     # 2. Insert assistant message to tbl_conv
    #     # ---------------------------------------------------------------------
    #     assistant_row = {
    #         "session_id": session_id.strip(),
    #         "entry_id": entry_id,
    #         "session_date": timestamp,
    #         "role": "assistant",
    #         "content": assistant_response.strip(),
    #         "input_type": "text",  # Assistant always outputs text
    #         "intent_detected": []
    #     }
        
    #     # Insert both to tbl_conv
    #     conv_errors = client.insert_rows_json(TABLE_CONV, [user_row, assistant_row])
        
    #     if conv_errors:
    #         return {"success": False, "error": f"tbl_conv insert failed: {conv_errors}"}
        
    # #     # ---------------------------------------------------------------------
    # #     # 3. Generate embeddings
    # #     # ---------------------------------------------------------------------
    # #     user_embedding = generate_embedding(user_message.strip())
    # #     assistant_embedding = generate_embedding(assistant_response.strip())
        
    # #     # ---------------------------------------------------------------------
    # #     # 4. Insert embeddings to tbl_embeddings
    # #     # ---------------------------------------------------------------------
    # #     embedding_rows = []
        
    # #     if user_embedding:
    # #         embedding_rows.append({
    # #             "embedding_id": f"emb{now.strftime('%Y%m%d%H%M%S')}u",
    # #             "session_id": session_id.strip(),
    # #             "content_type": "user_message",
    # #             "content_text": user_message.strip(),
    # #             "embedding": user_embedding,
    # #             "created_at": timestamp
    # #         })
        
    # #     if assistant_embedding:
    # #         embedding_rows.append({
    # #             "embedding_id": f"emb{now.strftime('%Y%m%d%H%M%S')}a",
    # #             "session_id": session_id.strip(),
    # #             "content_type": "assistant_response",
    # #             "content_text": assistant_response.strip(),
    # #             "embedding": assistant_embedding,
    # #             "created_at": timestamp
    # #         })
        
    # #     if embedding_rows:
    # #         emb_errors = client.insert_rows_json(TABLE_EMBEDDINGS, embedding_rows)
    # #         if emb_errors:
    # #             print(f"⚠️ tbl_embeddings insert failed (conversation still saved): {emb_errors}")
        
    # #     return {
    # #         "success": True,
    # #         "message": f"Logged conversation with embeddings",
    # #         "session_id": session_id,
    # #         "embeddings_saved": len(embedding_rows)
    # #     }

    # except Exception as e:
    #     return {"success": False, "error": f"Unexpected error: {str(e)}"}

# =============================================================================
# LOG CONVERSATION - tbl_conv
# =============================================================================
async def log_conversation(
    session_id: str,
    user_message: str,
    assistant_message: str,
    input_type: str = "text"
) -> dict:
    """
    Log a conversation exchange to BigQuery (tbl_conv).
    
    Args:
        session_id: Unique conversation session identifier
        user_message: The user's message
        assistant_message: The assistant's response
        input_type: 'text' or 'audio'
    
    Returns:
        {"success": True, "session_id": "..."} or {"success": False, "error": "..."}
    """
    try:
        # Validation
        if not session_id or not session_id.strip():
            return {"success": False, "error": "No valid session ID provided"}
        
        if not user_message or not user_message.strip():
            return {"success": False, "error": "user_message is required"}
        
        if not assistant_message or not assistant_message.strip():
            return {"success": False, "error": "assistant_message is required"}

        client = Config.get_bq_client()
        
        now = datetime.now(timezone.utc)
        timestamp = now.strftime("%Y-%m-%d %H:%M:%S")
        
        # Insert both messages
        rows = [
            {
                "session_id": session_id.strip(),
                "entry_id": None,
                "session_date": timestamp,
                "role": "user",
                "content": user_message.strip(),
                "input_type": input_type,
                "intent_detected": []
            },
            {
                "session_id": session_id.strip(),
                "entry_id": None,
                "session_date": timestamp,
                "role": "assistant",
                "content": assistant_message.strip(),
                "input_type": "text",
                "intent_detected": []
            }
        ]
        
        errors = client.insert_rows_json(TABLE_CONV, rows)
        
        if errors:
            return {"success": False, "error": f"BigQuery insert failed: {errors}"}
        
        return {
            "success": True,
            "message": "Conversation logged",
            "session_id": session_id
        }

    except Exception as e:
        return {"success": False, "error": f"Unexpected error: {str(e)}"}