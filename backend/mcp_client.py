"""
MCP Client for forMS Backend
Handles communication with the MCP server (FastMCP 2.x HTTP transport).

MCP Server provides:
    - log_symptoms: Save symptom data to BigQuery
    - log_conversation: Save chat history to BigQuery
    - search_reddit: Search r/MultipleSclerosis
    - search_google: General MS information search

FastMCP 2.x requires:
    1. Session initialization before tool calls
    2. Mcp-Session-Id header on all requests
    3. Accept header with both application/json AND text/event-stream
    4. Responses are in SSE format (event: message\ndata: {...})
"""

import json
from fastapi import Request
import httpx
from config import Config

from google.auth.transport import requests
from google.oauth2 import id_token, service_account

# =============================================================================
# SESSION STATE
# =============================================================================
# MCP session ID - required for all tool calls after initialization

        
_session_id = None

auth_req = requests.Request()


# =============================================================================
# SSE PARSING
# =============================================================================
def _parse_sse_response(body: str) -> dict:
    """
    Parse Server-Sent Events (SSE) format response from MCP server.
    
    MCP returns responses like:
        event: message
        data: {"jsonrpc": "2.0", ...}
    
    This extracts the JSON from the data line.
    
    Args:
        body: Raw response body
        
    Returns:
        Parsed JSON dict
    """
    # If it's already plain JSON, parse directly
    if body.strip().startswith("{"):
        return json.loads(body)
    
    # Parse SSE format
    for line in body.split("\n"):
        if line.startswith("data: "):
            json_str = line[6:]  # Remove "data: " prefix
            return json.loads(json_str)
    
    # Fallback - try parsing as-is
    return json.loads(body)


# =============================================================================
# AUTHENTICATION
# =============================================================================
def get_id_token(target_url: str) -> str | None:
    """
    Get Google Cloud ID token for authenticated Cloud Run calls.
    
    Tries two methods:
        1. Metadata server (works on Cloud Run automatically)
        2. Service account file (works locally with SA_BQ_CREDENTIALS)
    
    Args:
        target_url: The Cloud Run URL to authenticate against
        
    Returns:
        ID token string or None if auth fails
    """
    # Skip auth for localhost
    if not target_url.startswith("https://"):
        return None
    
    # Method 1: Metadata server (Cloud Run)
    try:
        token = id_token.fetch_id_token(auth_req, target_url)
        print("✅ Got auth token (metadata server)")
        return token
    except Exception as e:
        print(f"⚠️ Metadata auth failed: {e}")
    
    # Method 2: Service account file (local development)
    if Config.SA_BQ_CREDENTIALS:
        try:
            creds = service_account.IDTokenCredentials.from_service_account_file(
                Config.SA_BQ_CREDENTIALS, 
                target_audience=target_url
            )
            creds.refresh(Request())
            print("✅ Got auth token (SA file)")
            return creds.token
        except Exception as e:
            print(f"❌ SA auth failed: {e}")
    
    return None


# =============================================================================
# REQUEST HEADERS
# =============================================================================
def _get_headers() -> dict:
    """
    Build headers for MCP server requests.
    
    Includes:
        - Content-Type: application/json
        - Accept: application/json, text/event-stream (required by FastMCP)
        - Mcp-Session-Id: session ID (if initialized)
        - Authorization: Bearer token (for Cloud Run)
    
    Returns:
        dict of HTTP headers
    """
    
    headers = {
        "Content-Type": "application/json",
        "Accept": "application/json, text/event-stream",
    }
    
    # Add session ID if we have one
    if _session_id:
        headers["Mcp-Session-Id"] = _session_id
    
    # Add auth token for Cloud Run
    token = get_id_token(Config.MCP_SERVER_URL)
    if token:
        headers["Authorization"] = f"Bearer {token}"
    
    return headers


# =============================================================================
# SESSION INITIALIZATION
# =============================================================================
async def _initialize() -> bool:
    """
    Initialize MCP session with the server.
    
    Must be called before any tool calls. Gets a session ID from
    the server which is required for subsequent requests.
    
    Returns:
        True if initialization succeeded, False otherwise
    """
    global _session_id

    url = f"{Config.MCP_SERVER_URL.rstrip('/')}/mcp"
    
    payload = {
        "jsonrpc": "2.0",
        "method": "initialize",
        "params": {
            "protocolVersion": "2024-11-05",
            "capabilities": {},
            "clientInfo": {
                "name": "for-ms-backend",
                "version": "1.0.0"
            }
        },
        "id": 1
    }
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(url, headers=_get_headers(), json=payload)
            
            # Session ID comes from response header
            _session_id = response.headers.get("mcp-session-id")
            
            if _session_id:
                print(f"✅ MCP initialized (session: {_session_id[:8]}...)")
                return True
            
            print(f"❌ No session ID in response")
            print(f"   Headers: {dict(response.headers)}")
            return False
            
    except Exception as e:
        print(f"❌ MCP init error: {e}")
        return False


# =============================================================================
# TOOL CALLING
# =============================================================================
async def call_mcp_tool(tool_name: str, arguments: dict) -> dict:
    """
    Call a tool on the MCP server.
    
    Available tools:
        - log_symptoms: Log mood, fatigue, symptoms to tbl_trkr
        - log_conversation: Log chat messages to tbl_conv
        - search_reddit: Search r/MultipleSclerosis subreddit
        - search_google: Search for MS information
    
    Args:
        tool_name: Name of the tool to call
        arguments: Dict of arguments for the tool
        
    Returns:
        Tool result dict with 'success' key
        
    Example:
        result = await call_mcp_tool("log_symptoms", {
            "mood": 7,
            "fatigue": 5,
            "symptoms": ["tingling"]
        })
    """    
    print(f"🔧 Calling MCP tool: {tool_name}")
    print(f"   Args: {arguments}")
    
    global _session_id
    # Auto-initialize if no session
    if not _session_id:
        if not await _initialize():
            return {"success": False, "error": "Failed to initialize MCP session"}
    
    url = f"{Config.MCP_SERVER_URL.rstrip('/')}/mcp"
    
    payload = {
        "jsonrpc": "2.0",
        "method": "tools/call",
        "params": {
            "name": tool_name,
            "arguments": arguments
        },
        "id": 2
    }
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(url, headers=_get_headers(), json=payload)
            
            # Debug logging
            print(f"   📥 Status: {response.status_code}")
            print(f"   📥 Body preview: {response.text[:200]}")
            
            # Handle HTTP errors
            if response.status_code != 200:
                error_msg = f"HTTP {response.status_code}: {response.text[:100]}"
                print(f"   ❌ {error_msg}")
                return {"success": False, "error": error_msg}
            
            # Parse SSE format response
            result = _parse_sse_response(response.text)
            
            # Handle JSON-RPC errors
            if "error" in result:
                error_msg = result["error"]
                if isinstance(error_msg, dict):
                    error_msg = error_msg.get("message", str(error_msg))
                print(f"   ❌ {error_msg}")
                return {"success": False, "error": error_msg}
            
            # Parse MCP response format
            # MCP returns: {"result": {"content": [{"text": "{...json...}"}]}}
            if "result" in result:
                content = result["result"].get("content", [])
                if content and len(content) > 0:
                    text = content[0].get("text", "{}")
                    try:
                        parsed = json.loads(text)
                        print(f"   ✅ Result: {parsed}")
                        return parsed
                    except json.JSONDecodeError:
                        print(f"   ✅ Result: {text}")
                        return {"success": True, "message": text}
                return result["result"]
            
            return {"success": False, "error": "Unknown response format"}
            
    except httpx.TimeoutException:
        print("   ❌ MCP timeout")
        return {"success": False, "error": "MCP server timed out"}
    except Exception as e:
        print(f"   ❌ MCP error: {e}")
        return {"success": False, "error": str(e)}


# =============================================================================
# SESSION MANAGEMENT
# =============================================================================
def reset_session():
    """
    Reset the MCP session.
    
    Call this if you get session-related errors.
    The next tool call will re-initialize automatically.
    """
    global _session_id
    
    _session_id = None
    print("🔄 MCP session reset")