// =============================================================================
// TYPES.TS - Data Models (like Python dataclasses or TypedDicts)
// =============================================================================
// In TypeScript, we define the "shape" of our data using interfaces.
// Think of these like Python's @dataclass or TypedDict.

// Severity levels for symptoms - like Python's Literal["low", "medium", "high"]
export type Severity = 'low' | 'medium' | 'high';

// A single symptom log entry
export interface SymptomLog {
  id: string;           // Unique identifier (like uuid in Python)
  timestamp: number;    // Unix timestamp in milliseconds
  type: string;         // e.g., "Fatigue", "Numbness", "Pain"
  severity: Severity;   // low, medium, or high
  notes?: string;       // Optional field (the ? means it can be undefined)
}

// Medication tracking
export interface Medication {
  id: string;
  name: string;         // e.g., "Ocrevus"
  dosage: string;       // e.g., "600mg"
  frequency: string;    // e.g., "Every 6 months"
  takenAt?: number[];   // Optional: timestamps when taken
}

// Daily wellness metrics
export interface DailyMetrics {
  id: string;
  timestamp: number;
  mood: number;         // 1-10 scale
  fatigue: number;      // 1-10 scale
  sleepHours: number;
  cognitiveFog: boolean;
}

// All user data combined
export interface UserData {
  logs: SymptomLog[];      // Array of symptom logs (like Python list)
  meds: Medication[];      // Array of medications
  metrics: DailyMetrics[]; // Array of daily metrics
}

// A single chat message
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';  // Who sent it
  content: string;              // The message text
  timestamp: number;
  isThinking?: boolean;         // Optional: shows typing indicator
}

// Response from our agent API
export interface AgentResponse {
  text: string;                 // The assistant's reply
  action?: string;              // Optional: any action to take
  data?: any;                   // Optional: structured data returned
}
