"""
MS Ally Configuration
All environment variables and settings in one place.
"""
from google import genai
from google.cloud import bigquery 
from elevenlabs import ElevenLabs

import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    GOOGLE_GENAI_API_KEY = os.getenv("GOOGLE_GENAI_API_KEY")
    GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")
    GOOGLE_CLOUD_PROJECT = os.getenv("GOOGLE_CLOUD_PROJECT")
    
    # === BigQuery ===
    BIGQUERY_DATASET = os.getenv("BIGQUERY_DATASET")
    SA_BQ_CREDENTIALS = os.getenv("SA_BQ_CREDENTIALS")
    
    # === MCP Server ===
    MCP_SERVER_URL = os.getenv("MCP_SERVER_URL")
    
    # === ElevenLabs ===
    ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY")
    ELEVENLABS_VOICE_ID = os.getenv("ELEVENLABS_VOICE_ID")
    ELEVENLABS_TTS_MODEL_ID = os.getenv("ELEVENLABS_TTS_MODEL_ID")
    ELEVENS_STT_MODEL_ID = os.getenv("ELEVENS_STT_MODEL_ID")    
    LANGUAGE_CODE= os.getenv("LANGUAGE_CODE")

    SYSTEM_PROMPT = """You are a friendly, conversational voice assistant for MS patients. 

Guidelines:
- Keep responses SHORT (1-3 sentences max) unless asked for detail
- Be warm and natural, like talking to a friend
- When sharing search results, format links inline like: [Title](url) - brief summary
- Example: "[Managing fatigue tips](https://reddit.com/...) - User shares how cold showers helped"
- Always include clickable links when referencing sources
- NEVER show code examples, code blocks, or tool call syntax in your responses
- Just speak naturally - tools are called automatically in the background

You have access to tools:
- log_symptoms: Log mood, fatigue, symptoms when the user shares how they feel
- search_reddit: Search r/MultipleSclerosis for community experiences  
- search_google: Search for MS medical information

When the user shares how they're feeling, ALWAYS use log_symptoms to record it.

"""

class Client:

    def get_gemini_client():
        return genai.Client(api_key=Config.GOOGLE_GENAI_API_KEY)

    def get_elevenlabs_client():
        return ElevenLabs(api_key=Config.ELEVENLABS_API_KEY)

    def get_bigquery_client():
        return bigquery.Client(project=Config.GOOGLE_CLOUD_PROJECT)