from tools.tracker import log_symptoms, log_conversation 
from tools.search import search_reddit, search_google
from tools.config import Config
from fastmcp import FastMCP
import traceback
import sys

# =============================================================================
# SERVER.PY - MS Ally MCP Server
# =============================================================================
# FastMCP server providing tools for:
#   - log_symptoms: Track daily MS symptoms → tbl_trkr
#   - log_conversation: Log conversations → tbl_conv
#   - search_reddit: Search r/MultipleSclerosis
#   - search_google: Search Google
#   - (Next version) log_conversation_with_embedding: Log conversations with embeddings → tbl_conv + tbl_embeddings
"""
forMS SympBot MCP Server

This is the main entry point for the Model Context Protocol (MCP) server.
It exposes tools that the root agent can call to perform actions like
logging symptoms and searching for information.

Architecture:
    Streamlit App → Root Agent (Gemini) → MCP Server (this) → Tools → BigQuery/APIs

Transport:
    Uses HTTP transport for Cloud Run deployment.
    Endpoint: POST /mcp

Tools exposed:
    - log_symptoms: Log daily symptoms to BigQuery
    -#   - log_conversation: Log conversations → tbl_conv
    - search_reddit: Search r/MultipleSclerosis subreddit
    - search_google: General web search

Deployment:
    Deployed to Cloud Run with authentication required.
    Service account needs BigQuery Data Editor role.

Environment variables required:
    - PORT: Server port (default 8080)
    - GOOGLE_CLOUD_PROJECT: GCP project ID
    - BIGQUERY_DATASET: BigQuery dataset name
    - SA_BQ_CREDENTIALS: Path to service account JSON (local only)
    - GOOGLE_SEARCH_API_KEY: Google Custom Search API key
    - GOOGLE_SEARCH_CX: Google Custom Search Engine ID

Usage:
    Local:
        python server.py
    
    Cloud Run:
        Deployed via gcloud run deploy
"""

# Checking for GENAI env vars for embeddings:
# if not os.getenv("GOOGLE_GENAI_API_KEY") and not os.getenv("GEMINI_API_KEY"):
#     print("⚠️  WARNING: GOOGLE_GENAI_API_KEY not set! Embeddings will fail.")


# =============================================================================
# FASTMCP SERVER
# =============================================================================
mcp = FastMCP(
    name="for-ms-ally",
    instructions="MCP server forMS Ally - AI assistant for Ms patients for encouraging self-awareness"
)

# =============================================================================
# REGISTER TOOLS
# =============================================================================
try:
    
    mcp.tool(log_symptoms)
    mcp.tool(log_conversation)
    #mcp.tool(log_conversation_with_embedding)
    mcp.tool(search_reddit)
    mcp.tool(search_google)
    
    print("✅ Tools registered: log_symptoms, log_conversation, search_reddit, search_google")
    
except Exception as e:
    print(f"❌ Failed to import tools: {e}", file=sys.stderr)
    traceback.print_exc()

# =============================================================================
# RUN SERVER
# =============================================================================
if __name__ == "__main__":
    port = int(Config.PORT)
    
    print(f"🚀 Starting forMS Ally MCP server...")
    print(f"   Port: {port}")
    print(f"   Transport: HTTP")
    print(f"   Endpoint: http://0.0.0.0:{port}/mcp")
    
    mcp.run(transport="http", host="0.0.0.0", port=port)