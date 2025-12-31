// =============================================================================
// COMPONENTS/VOICEASSISTANT.TSX - Voice Conversation Mode with History
// =============================================================================

import React, { useState, useEffect, useRef } from 'react';
import { chatWithAgent, ChatMessage } from '../services/api';

// -----------------------------------------------------------------------------
// COMPONENT PROPS
// -----------------------------------------------------------------------------
interface VoiceAssistantProps {
  isActive: boolean;
  isSpeechEnabled: boolean;
  onToggle: () => void;
  onDataLog: (category: string, data: any) => void;
  onTranscript: (text: string, role: 'user' | 'assistant') => void;
}

// -----------------------------------------------------------------------------
// VOICE STATE ENUM
// -----------------------------------------------------------------------------
type VoiceState = 'idle' | 'listening' | 'processing' | 'speaking';

// -----------------------------------------------------------------------------
// MAIN COMPONENT
// -----------------------------------------------------------------------------
const VoiceAssistant: React.FC<VoiceAssistantProps> = ({
  isActive,
  isSpeechEnabled,
  onToggle,
  onTranscript,
  onDataLog
}) => {
  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [transcript, setTranscript] = useState('');
  const [response, setResponse] = useState('');
  const [error, setError] = useState<string | null>(null);
  
  // Conversation state
  const [history, setHistory] = useState<ChatMessage[]>([]);
  const [sessionId, setSessionId] = useState<string | undefined>(undefined);
  
  // Refs
  const recognitionRef = useRef<any>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // -----------------------------------------------------------------------------
  // SPEECH RECOGNITION SETUP
  // -----------------------------------------------------------------------------
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      setError('Speech recognition is not supported in this browser. Try Chrome or Edge.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event: any) => {
      const current = event.resultIndex;
      const result = event.results[current];
      const transcriptText = result[0].transcript;
      
      setTranscript(transcriptText);
      
      if (result.isFinal) {
        handleUserSpeech(transcriptText);
      }
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      if (event.error === 'no-speech') {
        setError('No speech detected. Try again.');
      } else if (event.error === 'not-allowed') {
        setError('Microphone access denied. Click the lock icon 🔒 in your address bar to allow microphone access.');
      } else if (event.error === 'audio-capture') {
        setError('No microphone found. Please connect a microphone and try again.');
      }
      setVoiceState('idle');
    };

    recognition.onend = () => {
      if (voiceState === 'listening') {
        setVoiceState('processing');
      }
    };

    recognitionRef.current = recognition;

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, []);

  // -----------------------------------------------------------------------------
  // START LISTENING
  // -----------------------------------------------------------------------------
  const startListening = () => {
    setError(null);
    setTranscript('');
    setResponse('');
    
    if (recognitionRef.current) {
      try {
        recognitionRef.current.start();
        setVoiceState('listening');
      } catch (e) {
        console.error('Failed to start recognition:', e);
        setError('Failed to start microphone. Please try again.');
      }
    }
  };

  // -----------------------------------------------------------------------------
  // STOP LISTENING
  // -----------------------------------------------------------------------------
  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
  };

  // -----------------------------------------------------------------------------
  // STOP SPEAKING
  // -----------------------------------------------------------------------------
  const stopSpeaking = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setVoiceState('idle');
  };

  // -----------------------------------------------------------------------------
  // HANDLE USER SPEECH - Send to agent with history
  // -----------------------------------------------------------------------------
  const handleUserSpeech = async (text: string) => {
    if (!text.trim()) {
      setVoiceState('idle');
      return;
    }

    onTranscript(text, 'user');
    setVoiceState('processing');

    try {
      // Call API with history and session ID
      const result = await chatWithAgent(text, history, sessionId, 'audio');
      
      // Update session ID (use the one from backend)
      if (result.session_id) {
        setSessionId(result.session_id);
      }
      
      // Update history with both messages
      const newHistory: ChatMessage[] = [
        ...history,
        { role: 'user', content: text },
        { role: 'assistant', content: result.text }
      ];
      setHistory(newHistory);
      
      setResponse(result.text);
      onTranscript(result.text, 'assistant');

      // Speak the response if enabled
      if (isSpeechEnabled) {
        setVoiceState('speaking');
        await playTTS(result.text);
      }

      setVoiceState('idle');

    } catch (err) {
      console.error('Agent error:', err);
      setError('Failed to get response. Please try again.');
      setVoiceState('idle');
    }
  };

  // -----------------------------------------------------------------------------
  // PLAY TTS
  // -----------------------------------------------------------------------------
  const playTTS = async (text: string) => {
    try {
      const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';
      const response = await fetch(`${BACKEND_URL}/speak`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });

      if (!response.ok) throw new Error('TTS failed');

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      
      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      
      audio.onended = () => {
        setVoiceState('idle');
        URL.revokeObjectURL(audioUrl);
      };
      
      await audio.play();
    } catch (err) {
      console.error('TTS error:', err);
      setVoiceState('idle');
    }
  };

  // -----------------------------------------------------------------------------
  // CLEAR CONVERSATION
  // -----------------------------------------------------------------------------
  const clearConversation = () => {
    setHistory([]);
    setSessionId(undefined);
    setTranscript('');
    setResponse('');
    setError(null);
  };

  // -----------------------------------------------------------------------------
  // RENDER
  // -----------------------------------------------------------------------------
  return (
    <div className="absolute inset-0 bg-gradient-to-b from-slate-900 to-slate-800 flex flex-col items-center justify-center p-6 z-30">
      
      {/* Close Button */}
      <button
        onClick={() => {
          stopSpeaking();
          if (recognitionRef.current) recognitionRef.current.abort();
          onToggle();
        }}
        className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-all"
      >
        <i className="fas fa-times"></i>
      </button>

      {/* Clear Conversation Button */}
      {history.length > 0 && (
        <button
          onClick={clearConversation}
          className="absolute top-4 left-4 px-3 py-2 rounded-lg bg-white/10 text-white text-sm flex items-center gap-2 hover:bg-white/20 transition-all"
        >
          <i className="fas fa-trash-alt"></i>
          Clear
        </button>
      )}

      {/* Conversation Counter */}
      {history.length > 0 && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-orange-500/20 text-orange-300 text-xs">
          {history.length / 2} exchanges
        </div>
      )}

      {/* Status Indicator */}
      <div className="mb-8 text-center">
        <h2 className="text-white text-lg font-bold mb-1">
          {voiceState === 'idle' && 'Tap to speak'}
          {voiceState === 'listening' && 'Listening...'}
          {voiceState === 'processing' && 'Thinking...'}
          {voiceState === 'speaking' && 'Speaking...'}
        </h2>
        <p className="text-white/50 text-sm">
          {voiceState === 'idle' && (history.length > 0 ? 'Continue your conversation' : 'Your MS Ally is ready to help')}
          {voiceState === 'listening' && 'Tell me how you\'re feeling'}
          {voiceState === 'processing' && 'Processing your message'}
          {voiceState === 'speaking' && 'Playing response'}
        </p>
      </div>

      {/* Main Voice Button */}
      <button
        onClick={voiceState === 'listening' ? stopListening : (voiceState === 'speaking' ? stopSpeaking : startListening)}
        disabled={voiceState === 'processing'}
        className={`
          w-32 h-32 rounded-full flex items-center justify-center transition-all duration-300
          ${voiceState === 'idle' ? 'bg-orange-500 hover:bg-orange-600 hover:scale-105' : ''}
          ${voiceState === 'listening' ? 'bg-red-500 animate-pulse scale-110' : ''}
          ${voiceState === 'processing' ? 'bg-blue-500 opacity-75' : ''}
          ${voiceState === 'speaking' ? 'bg-green-500 hover:bg-green-600' : ''}
          disabled:opacity-50 disabled:cursor-not-allowed
          shadow-2xl
        `}
      >
        <i className={`fas text-white text-4xl ${
          voiceState === 'listening' ? 'fa-stop' :
          voiceState === 'processing' ? 'fa-spinner fa-spin' :
          voiceState === 'speaking' ? 'fa-stop' :
          'fa-microphone'
        }`}></i>
      </button>

      {/* Pulsing Ring Animation */}
      {voiceState === 'listening' && (
        <>
          <div className="absolute w-40 h-40 rounded-full border-4 border-red-400/30 animate-ping"></div>
          <div className="absolute w-48 h-48 rounded-full border-2 border-red-400/20 animate-pulse"></div>
        </>
      )}

      {/* Transcript Display */}
      {transcript && (
        <div className="mt-8 max-w-md text-center">
          <p className="text-white/70 text-xs uppercase tracking-widest mb-2">You said:</p>
          <p className="text-white text-lg font-medium">{transcript}</p>
        </div>
      )}

      {/* Response Display */}
      {response && voiceState !== 'listening' && (
        <div className="mt-6 max-w-md text-center">
          <p className="text-orange-400/70 text-xs uppercase tracking-widest mb-2">MS Ally:</p>
          <p className="text-white/80 text-sm leading-relaxed">{response}</p>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="mt-6 bg-red-500/20 border border-red-500/30 rounded-xl px-4 py-3 max-w-md">
          <p className="text-red-300 text-sm text-center">
            <i className="fas fa-exclamation-circle mr-2"></i>
            {error}
          </p>
        </div>
      )}

      {/* Recent History (last 2 exchanges) */}
      {history.length > 2 && voiceState === 'idle' && (
        <div className="absolute bottom-20 left-4 right-4 max-h-32 overflow-y-auto">
          <p className="text-white/30 text-xs uppercase tracking-widest mb-2 text-center">Recent:</p>
          <div className="space-y-2">
            {history.slice(-4).map((msg, idx) => (
              <div 
                key={idx} 
                className={`text-xs px-3 py-1 rounded-lg ${
                  msg.role === 'user' 
                    ? 'bg-blue-500/20 text-blue-200 ml-8' 
                    : 'bg-orange-500/20 text-orange-200 mr-8'
                }`}
              >
                {msg.content.length > 60 ? msg.content.slice(0, 60) + '...' : msg.content}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tips */}
      <div className="absolute bottom-8 left-0 right-0 text-center">
        <p className="text-white/30 text-xs">
          <i className="fas fa-lightbulb mr-1"></i>
          Try saying: "I'm feeling tired today" or "My fatigue is 7 out of 10"
        </p>
      </div>
    </div>
  );
};

export default VoiceAssistant;