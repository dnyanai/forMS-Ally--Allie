import httpx
from .config import Config


"""
Search tools for MS SympBot.

This module provides search functionality for the agent to find
relevant information from Reddit and general web sources.

Tools:
    - search_reddit: Search r/MultipleSclerosis for community discussions
    - search_google: General web search for MS-related information

Why Reddit search matters:
    MS patients often seek community support and want to know
    "has anyone else experienced this?" Reddit's MS community
    is active and provides peer experiences that complement
    medical information.

Dependencies:
    - httpx: Async HTTP client
    - Environment variables: GOOGLE_SEARCH_API_KEY, GOOGLE_SEARCH_CX

Note on Reddit data:
    Per Reddit's data guidelines, we don't store scraped content.
    Each search is live via Google Custom Search API with
    site:reddit.com/r/MultipleSclerosis restriction.
"""
# === Check API Credentials ===
# Google Custom Search API requires both an API key and a Search Engine ID (cx)
api_key = Config.GOOGLE_SEARCH_API_KEY
cx = Config.GOOGLE_SEARCH_CX

class SearchError(Exception):
    """
    Custom exception for search operations.
    
    Raised when search-specific errors occur that should be
    handled differently from general exceptions.
    
    Example:
        raise SearchError("API key not configured")
    """
    pass


def get_search_credentials() -> tuple[str, str]:
    """
    Get and validate Google Search API credentials.
    
    Retrieves GOOGLE_SEARCH_API_KEY and GOOGLE_SEARCH_CX from
    environment variables and validates they are set.
    
    Returns:
        tuple[str, str]: (api_key, cx) if both are configured
        
    Raises:
        SearchError: If either credential is missing
    """

    if not api_key:
        raise SearchError("GOOGLE_SEARCH_API_KEY not configured")
    
    if not cx:
        raise SearchError("GOOGLE_SEARCH_CX not configured")
    
    return api_key, cx
    
async def search_reddit(query: str, limit: int = 5) -> dict:
    """
    Search r/MultipleSclerosis subreddit for relevant discussions.
    
    Uses Google Custom Search API with site restriction to find
    Reddit posts. This respects Reddit's data guidelines by not
    storing content - each search is live.
    
    Use cases:
        - "Has anyone experienced tingling after starting Tecfidera?"
        - "Tips for managing fatigue"
        - "Experience with Ocrevus infusions"
        - "Brain fog coping strategies"
    
    Args:
        query (str): Search query about MS experiences or symptoms
            Should be conversational, like how a patient would ask
            
        limit (int, optional): Maximum results to return. Default 5.
            Valid range: 1-10
    
    Returns:
        dict: Search results
            On success:
                {
                    "success": True,
                    "query": "fatigue tips",
                    "source": "r/MultipleSclerosis",
                    "result_count": 5,
                    "results": [
                        {
                            "title": "Post title",
                            "snippet": "Preview of post content...",
                            "link": "https://reddit.com/r/MultipleSclerosis/..."
                        },
                        ...
                    ]
                }
            On failure:
                {
                    "success": False,
                    "error": "Description of what went wrong"
                }
    
    Example:
        >>> await search_reddit("tips for managing brain fog", limit=3)
        {
            "success": True,
            "query": "tips for managing brain fog",
            "source": "r/MultipleSclerosis",
            "result_count": 3,
            "results": [...]
        }
    """
    try:
        # === Input Validation ===
        if not query or not query.strip():
            return {"success": False, "error": "query cannot be empty"}
        
        if not isinstance(limit, int) or not 1 <= limit <= 10:
            return {"success": False, "error": "limit must be between 1 and 10"}
        
        # === Get API Credentials ===
        try:
            api_key, cx = get_search_credentials()
        except SearchError as e:
            return {"success": False, "error": str(e)}
        
        # === Build Search Query ===
        # Restrict search to r/MultipleSclerosis subreddit
        search_query = f"site:reddit.com/r/MultipleSclerosis {query.strip()}"
        
        # === Make API Request ===
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(
                    "https://www.googleapis.com/customsearch/v1",
                    params={
                        "key": api_key,
                        "cx": cx,
                        "q": search_query,
                        "num": limit
                    }
                )
        except httpx.TimeoutException:
            return {"success": False, "error": "Search request timed out. Please try again."}
        except httpx.RequestError as e:
            return {"success": False, "error": f"Search request failed: {str(e)}"}
        
        # === Handle Response Status ===
        if response.status_code == 429:
            return {"success": False, "error": "API rate limit exceeded. Try again later."}
        
        if response.status_code == 403:
            return {"success": False, "error": "API access denied. Check API key permissions."}
        
        if response.status_code != 200:
            return {"success": False, "error": f"Search failed with status {response.status_code}"}
        
        # === Parse Response ===
        try:
            data = response.json()
        except Exception:
            return {"success": False, "error": "Failed to parse search response"}
        
        # === Extract Results ===
        results = []
        for item in data.get("items", []):
            results.append({
                "title": item.get("title", "No title"),
                "snippet": item.get("snippet", "No snippet"),
                "link": item.get("link", "")
            })
        
        # === Return Success ===
        return {
            "success": True,
            "query": query,
            "source": "r/MultipleSclerosis",
            "result_count": len(results),
            "results": results
        }
    
    except Exception as e:
        # Catch-all for unexpected errors
        return {"success": False, "error": f"Unexpected error in Reddit search: {str(e)}"}


async def search_google(query: str, limit: int = 5) -> dict:
    """
    General Google search for MS-related information.
    
    Use this for broader searches when Reddit-specific results
    aren't needed. Good for finding medical resources, research,
    and general information.
    
    Use cases:
        - "Multiple sclerosis symptoms"
        - "Tecfidera side effects"
        - "MS and vitamin D research"
        - "Neurologist near me" (though location won't be accurate)
    
    Args:
        query (str): Search query
            Can be any MS-related topic
            
        limit (int, optional): Maximum results to return. Default 5.
            Valid range: 1-10
    
    Returns:
        dict: Search results
            On success:
                {
                    "success": True,
                    "query": "MS fatigue research",
                    "result_count": 5,
                    "results": [
                        {
                            "title": "Page title",
                            "snippet": "Preview of page content...",
                            "link": "https://example.com/..."
                        },
                        ...
                    ]
                }
            On failure:
                {
                    "success": False,
                    "error": "Description of what went wrong"
                }
    
    Example:
        >>> await search_google("Ocrevus vs Kesimpta comparison", limit=5)
        {
            "success": True,
            "query": "Ocrevus vs Kesimpta comparison",
            "result_count": 5,
            "results": [...]
        }
    """
    try:
        # === Input Validation ===
        if not query or not query.strip():
            return {"success": False, "error": "query cannot be empty"}
        
        if not isinstance(limit, int) or not 1 <= limit <= 10:
            return {"success": False, "error": "limit must be between 1 and 10"}
        
        # === Make API Request ===
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(
                    "https://www.googleapis.com/customsearch/v1",
                    params={
                        "key": api_key,
                        "cx": cx,
                        "q": query.strip(),
                        "num": limit
                    }
                )
        except httpx.TimeoutException:
            return {"success": False, "error": "Search request timed out. Please try again."}
        except httpx.RequestError as e:
            return {"success": False, "error": f"Search request failed: {str(e)}"}
        
        # === Handle Response Status ===
        if response.status_code == 429:
            return {"success": False, "error": "API rate limit exceeded. Try again later."}
        
        if response.status_code == 403:
            return {"success": False, "error": "API access denied. Check API key permissions."}
        
        if response.status_code != 200:
            return {"success": False, "error": f"Search failed with status {response.status_code}"}
        
        # === Parse Response ===
        try:
            data = response.json()
        except Exception:
            return {"success": False, "error": "Failed to parse search response"}
        
        # === Extract Results ===
        results = []
        for item in data.get("items", []):
            results.append({
                "title": item.get("title", "No title"),
                "snippet": item.get("snippet", "No snippet"),
                "link": item.get("link", "")
            })
        
        # === Return Success ===
        return {
            "success": True,
            "query": query,
            "result_count": len(results),
            "results": results
        }
    
    except Exception as e:
        # Catch-all for unexpected errors
        return {"success": False, "error": f"Unexpected error in Google search: {str(e)}"}