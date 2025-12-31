"""
forMS Ally Agent
Handles conversation with Gemini and tool execution via MCP.
"""

import traceback
from google import genai
from google.genai import types
from config import Config
from mcp_client import call_mcp_tool


def get_gemini_client():
    """Initialize and return Gemini client."""
    return genai.Client(api_key=Config.GOOGLE_GENAI_API_KEY)

# =============================================================================
# TOOL DEFINITIONS
# =============================================================================
TOOL_DEFINITIONS = [
    {
        "name": "log_symptoms",
        "description": """Log daily symptoms for the MS patient. ALWAYS call this when the user mentions:
- How they're feeling (tired, good, bad, exhausted, etc.)
- Any mood or energy level (even vague ones - estimate a number)
- Physical symptoms (tingling, numbness, brain fog, vision issues, etc.)
- Fatigue levels
- Medications taken
- Period/menstrual status

Examples that MUST trigger this tool:
- "I'm tired" → Ask and help the user to identify what is their fatigue and mood levels. 
- "feeling exhausted today" → Ask and help the user to identify what is their fatigue and mood levels. 
- "My hand is tingling" → log symptoms=["tingling"], Ask and help the user to identify what is their fatigue and mood levels. 
- "Mood is 5, fatigue is 7" → Ask if they want to disucss what these numbers mean and then log exactly those values. 
- "Took my Kesimpta" → log medications_taken=["Kesimpta"]

If user doesn't give exact numbers, Ask and explain what the numbers mean.
After logging, confirm what you logged.""",
        "parameters": {
            "type": "object",
            "properties": {
                "mood": {
                    "type": "integer",
                    "description": "Mood rating 1-10 (1=very poor, 10=excellent)"
                },
                "fatigue": {
                    "type": "integer",
                    "description": "Fatigue level 1-10 (1=energetic, 10=exhausted)"
                },
                "symptoms": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "List of symptoms: tingling, brain fog, numbness, etc."
                },
                "medications_taken": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Medications taken today"
                },
                "period_status": {
                    "type": "string",
                    "enum": ["started", "ongoing", "ended"],
                    "description": "Menstrual cycle status if mentioned"
                },
                "notes": {
                    "type": "string",
                    "description": "Additional context"
                }
            },
            "required": ["mood", "fatigue", "symptoms"]
        }
    },
    {
        "name": "search_reddit",
        "description": """Search r/MultipleSclerosis subreddit for community discussions.
Use when user asks about others' experiences, tips from MS patients, or "has anyone else...".""",
        "parameters": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "Search query"},
                "limit": {"type": "integer", "description": "Number of results (1-10, default 5)"}
            },
            "required": ["query"]
        }
    },
    {
        "name": "search_google",
        "description": """Search Google for MS-related medical information.
Use for factual questions about MS, medications, treatments, or symptoms.""",
        "parameters": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "Search query"},
                "limit": {"type": "integer", "description": "Number of results (1-10, default 5)"}
            },
            "required": ["query"]
        }
    }
]


def build_tools_for_gemini() -> list:
    """Convert tool definitions to Gemini function declarations."""
    functions = [
        types.FunctionDeclaration(
            name=tool["name"],
            description=tool["description"],
            parameters=tool["parameters"]
        )
        for tool in TOOL_DEFINITIONS
    ]
    return [types.Tool(function_declarations=functions)]


# =============================================================================
# AGENT RESPONSE
# =============================================================================
async def get_response(user_text: str, history: list) -> str:
    """
    Process user input and return agent response.
    
    Args:
        user_text: Current user message
        history: List of previous messages [{"role": "user/assistant", "content": "..."}]
        
    Returns:
        Agent response text
    """
    try:
        client = get_gemini_client()
        
        # Build conversation history (using dicts for compatibility)
        messages = []
        for msg in history:
            role = "user" if msg["role"] == "user" else "model"
            messages.append({
                "role": role,
                "parts": [{"text": msg["content"]}]
            })
        
        # Add current user message
        messages.append({
            "role": "user",
            "parts": [{"text": user_text}]
        })
        
        # Call Gemini with tools
        tools = build_tools_for_gemini()
        response = client.models.generate_content(
            model=Config.GEMINI_MODEL,
            contents=messages,
            config=types.GenerateContentConfig(
                system_instruction=Config.SYSTEM_PROMPT,
                tools=tools,
                tool_config=types.ToolConfig(
                    function_calling_config=types.FunctionCallingConfig(mode="ANY")
                )
            )
        )
        
        # Check for function call
        if response.candidates and response.candidates[0].content.parts:
            for part in response.candidates[0].content.parts:
                if hasattr(part, 'function_call') and part.function_call:
                    return await _handle_tool_call(client, messages, part.function_call)
        
        # No function call, return direct response
        return response.text
        
    except Exception as e:
        print(f"❌ Agent error: {e}")
        traceback.print_exc()
        return "I'm having trouble processing that right now. Could you try again?"


async def _handle_tool_call(client, messages: list, func_call) -> str:
    """Handle a tool call from Gemini."""
    tool_name = func_call.name
    tool_args = dict(func_call.args) if func_call.args else {}
    
    print(f"🔧 Agent calling tool: {tool_name}")
    print(f"   Args: {tool_args}")
    
    # Fix array types if needed
    if "symptoms" in tool_args and isinstance(tool_args["symptoms"], str):
        tool_args["symptoms"] = [tool_args["symptoms"]]
    if "medications_taken" in tool_args and isinstance(tool_args["medications_taken"], str):
        tool_args["medications_taken"] = [tool_args["medications_taken"]]
    
    # Ensure defaults for log_symptoms
    if tool_name == "log_symptoms":
        tool_args.setdefault("symptoms", [])
        tool_args.setdefault("medications_taken", [])
    
    # Call MCP tool
    tool_result = await call_mcp_tool(tool_name, tool_args)
    print(f"   Tool result: {tool_result}")
    
    # Add tool call and result to messages
    messages.append({
        "role": "model",
        "parts": [{"function_call": {"name": tool_name, "args": tool_args}}]
    })
    messages.append({
        "role": "user",
        "parts": [{"function_response": {"name": tool_name, "response": {"result": tool_result}}}]
    })
    
    # Get final response from Gemini
    final_response = client.models.generate_content(
        model=Config.GEMINI_MODEL,
        contents=messages,
        config=types.GenerateContentConfig(system_instruction=Config.SYSTEM_PROMPT)
    )
    
    return final_response.text
