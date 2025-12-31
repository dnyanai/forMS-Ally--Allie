// =============================================================================
// SERVICES/API.TS - API Service for MS Ally Frontend
// =============================================================================

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "https://for-ms-backend-22097057568.us-west1.run.app/";

// -----------------------------------------------------------------------------
// TYPES
// -----------------------------------------------------------------------------
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatResponse {
  text: string;
  session_id: string;
}

export interface LogSymptomsRequest {
  mood: number;
  fatigue: number;
  symptoms: string[];
  medications_taken: string[];
  period_status?: string | null;
  notes?: string;
}

// -----------------------------------------------------------------------------
// CHAT WITH AGENT
// -----------------------------------------------------------------------------
export async function chatWithAgent(
  message: string,
  history: ChatMessage[] = [],
  sessionId?: string,
  inputType:string = "Text"
): Promise<ChatResponse> {
  const response = await fetch(`${BACKEND_URL}/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message,
      history,
      session_id: sessionId,
      inputType:inputType
    }),
  });

  if (!response.ok) {
    throw new Error(`Chat failed: ${response.statusText}`);
  }

  return response.json();
}

// -----------------------------------------------------------------------------
// LOG SYMPTOMS
// -----------------------------------------------------------------------------
export async function logSymptoms(data: LogSymptomsRequest): Promise<any> {
  const response = await fetch(`${BACKEND_URL}/log/symptoms`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error(`Log symptoms failed: ${response.statusText}`);
  }

  return response.json();
}

// -----------------------------------------------------------------------------
// SEARCH REDDIT
// -----------------------------------------------------------------------------
export async function searchReddit(query: string, limit: number = 5): Promise<any> {
  const response = await fetch(`${BACKEND_URL}/search/reddit`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, limit }),
  });

  if (!response.ok) {
    throw new Error(`Reddit search failed: ${response.statusText}`);
  }

  return response.json();
}

// -----------------------------------------------------------------------------
// SEARCH GOOGLE
// -----------------------------------------------------------------------------
export async function searchGoogle(query: string): Promise<any> {
  const response = await fetch(`${BACKEND_URL}/search/google`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  });

  if (!response.ok) {
    throw new Error(`Google search failed: ${response.statusText}`);
  }

  return response.json();
}