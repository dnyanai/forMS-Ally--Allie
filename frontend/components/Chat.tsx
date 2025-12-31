// =============================================================================
// COMPONENTS/CHAT.TSX - Text Chat Component with History
// =============================================================================

import React, { useState, useRef, useEffect } from 'react';
import { chatWithAgent, ChatMessage } from '../services/api';
import ReactMarkdown from 'react-markdown';

// -----------------------------------------------------------------------------
// COMPONENT PROPS
// -----------------------------------------------------------------------------
interface ChatProps {
  isSpeechEnabled?: boolean;
  onClose?: () => void;
}

// -----------------------------------------------------------------------------
// MAIN COMPONENT
// -----------------------------------------------------------------------------
const Chat: React.FC<ChatProps> = ({ isSpeechEnabled = false, onClose }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // -----------------------------------------------------------------------------
  // SEND MESSAGE
  // -----------------------------------------------------------------------------
  const sendMessage = async () => {
    if (!inputText.trim() || isLoading) return;

    const userMessage = inputText.trim();
    setInputText('');
    setError(null);
    setIsLoading(true);

    // Add user message to UI immediately
    const updatedMessages: ChatMessage[] = [
      ...messages,
      { role: 'user', content: userMessage }
    ];
    setMessages(updatedMessages);

    try {
      // Send to backend with history (exclude the message we just added)
      const result = await chatWithAgent(userMessage, messages, sessionId, 'text');

      // Update session ID
      if (result.session_id) {
        setSessionId(result.session_id);
      }

      // Add assistant response
      setMessages([
        ...updatedMessages,
        { role: 'assistant', content: result.text }
      ]);

      // Play TTS if enabled
      if (isSpeechEnabled) {
        playTTS(result.text);
      }

    } catch (err) {
      console.error('Chat error:', err);
      setError('Failed to send message. Please try again.');
      // Remove the user message on error
      setMessages(messages);
    } finally {
      setIsLoading(false);
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

      if (!response.ok) return;

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      audio.onended = () => URL.revokeObjectURL(audioUrl);
      await audio.play();
    } catch (err) {
      console.error('TTS error:', err);
    }
  };

  // -----------------------------------------------------------------------------
  // CLEAR CHAT
  // -----------------------------------------------------------------------------
  const clearChat = () => {
    setMessages([]);
    setSessionId(undefined);
    setError(null);
  };

  // -----------------------------------------------------------------------------
  // HANDLE KEY PRESS
  // -----------------------------------------------------------------------------
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // -----------------------------------------------------------------------------
  // RENDER
  // -----------------------------------------------------------------------------
  return (
    <div className="flex flex-col h-full bg-slate-900 rounded-2xl overflow-hidden">
      
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-800 border-b border-slate-700">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center">
            <i className="fas fa-robot text-white"></i>
          </div>
          <div>
            <h3 className="text-white font-semibold">MS Ally</h3>
            <p className="text-white/50 text-xs">
              {sessionId ? `Session: ${sessionId.slice(0, 12)}...` : 'Ready to chat'}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {messages.length > 0 && (
            <button
              onClick={clearChat}
              className="px-3 py-1 rounded-lg bg-white/10 text-white/70 text-sm hover:bg-white/20 transition-all"
            >
              <i className="fas fa-trash-alt mr-1"></i>
              Clear
            </button>
          )}
          {onClose && (
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/10 text-white/70 hover:bg-white/20 transition-all"
            >
              <i className="fas fa-times"></i>
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 rounded-full bg-orange-500/20 flex items-center justify-center mb-4">
              <i className="fas fa-comments text-orange-400 text-2xl"></i>
            </div>
            <h4 className="text-white font-medium mb-2">Start a conversation</h4>
            <p className="text-white/50 text-sm max-w-xs">
              Ask me about your symptoms, medications, or anything related to managing MS.
            </p>
          </div>
        ) : (
          messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] px-4 py-3 rounded-2xl ${
                  msg.role === 'user'
                    ? 'bg-orange-500 text-white rounded-br-md'
                    : 'bg-slate-700 text-white/90 rounded-bl-md'
                }`}
              >
             <div className="text-sm whitespace-pre-wrap">
                  <ReactMarkdown
                    components={{
                      a: ({ href, children }) => (
                        <a 
                          href={href} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="text-blue-400 underline hover:text-blue-300"
                        >
                          {children}
                        </a>
                      ),
                      p: ({ children }) => <span>{children}</span>
                    }}
                  >
                    {msg.content}
                  </ReactMarkdown>
                </div>
              </div>
            </div>
          ))
        )}
        
        {/* Loading indicator */}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-slate-700 px-4 py-3 rounded-2xl rounded-bl-md">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-white/50 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                <span className="w-2 h-2 bg-white/50 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                <span className="w-2 h-2 bg-white/50 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Error Display */}
      {error && (
        <div className="mx-4 mb-2 px-3 py-2 bg-red-500/20 border border-red-500/30 rounded-lg">
          <p className="text-red-300 text-sm">
            <i className="fas fa-exclamation-circle mr-2"></i>
            {error}
          </p>
        </div>
      )}

      {/* Input */}
      <div className="p-4 bg-slate-800 border-t border-slate-700">
        <div className="flex items-center gap-3">
          <input
            ref={inputRef}
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type your message..."
            disabled={isLoading}
            className="flex-1 px-4 py-3 bg-slate-700 text-white rounded-xl border border-slate-600 focus:border-orange-500 focus:outline-none placeholder-white/30 disabled:opacity-50"
          />
          <button
            onClick={sendMessage}
            disabled={!inputText.trim() || isLoading}
            className="w-12 h-12 rounded-xl bg-orange-500 text-white flex items-center justify-center hover:bg-orange-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <i className={`fas ${isLoading ? 'fa-spinner fa-spin' : 'fa-paper-plane'}`}></i>
          </button>
        </div>
      </div>
    </div>
  );
};

export default Chat;