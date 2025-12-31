// =============================================================================
// SERVICES/ELEVENLABS.TS - ElevenLabs TTS Service
// =============================================================================

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "https://for-ms-backend-22097057568.us-west1.run.app/";

let currentAudio: HTMLAudioElement | null = null;

// -----------------------------------------------------------------------------
// SPEAK TEXT
// -----------------------------------------------------------------------------
export async function speakText(text: string): Promise<void> {
  // Stop any current playback
  stopSpeaking();

  try {
    const response = await fetch(`${BACKEND_URL}/speak`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text }),
    });

    if (!response.ok) {
      throw new Error(`TTS failed: ${response.statusText}`);
    }

    const audioBlob = await response.blob();
    const audioUrl = URL.createObjectURL(audioBlob);
    
    return new Promise((resolve, reject) => {
      const audio = new Audio(audioUrl);
      currentAudio = audio;
      
      audio.onended = () => {
        URL.revokeObjectURL(audioUrl);
        currentAudio = null;
        resolve();
      };
      
      audio.onerror = (e) => {
        URL.revokeObjectURL(audioUrl);
        currentAudio = null;
        reject(e);
      };
      
      audio.play().catch(reject);
    });
  } catch (err) {
    console.error('TTS error:', err);
    throw err;
  }
}

// -----------------------------------------------------------------------------
// STOP SPEAKING
// -----------------------------------------------------------------------------
export function stopSpeaking(): void {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
    currentAudio = null;
  }
}

// -----------------------------------------------------------------------------
// IS SPEAKING
// -----------------------------------------------------------------------------
export function isSpeaking(): boolean {
  return currentAudio !== null && !currentAudio.paused;
}