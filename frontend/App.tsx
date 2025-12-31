import React, { useState, useEffect, useRef } from 'react';
import { UserData, ChatMessage, SymptomLog, DailyMetrics } from './types';
import { chatWithAgent } from './services/api';
import { speakText } from './services/elevenlabs';
import Tracker from './components/Tracker';
import AnalyticsReport from './components/AnalyticsReport';
import VoiceAssistant from './components/VoiceAssistant';

// Backend URL
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "https://for-ms-backend-22097057568.us-west1.run.app/";

type AppTab = 'chat' | 'track' | 'report';

// Symptom data interface matching backend
interface SymptomData {
  mood: number;
  fatigue: number;
  symptoms: string[];
  medications_taken: string[];
  period_status: string | null;
  notes: string;
}

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<AppTab>('chat');
  const [isVoiceActive, setIsVoiceActive] = useState(false); 
  const [isSpeechEnabled, setIsSpeechEnabled] = useState(true); 
  const [isVoiceInputEnabled, setIsVoiceInputEnabled] = useState(true);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [thinkingMessage, setThinkingMessage] = useState('Thinking...');
  const [isSyncing, setIsSyncing] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  
  const [userData, setUserData] = useState<UserData>({
    logs: [],
    meds: [
      { id: 'm1', name: 'Kesimpta', dosage: '20mg', frequency: 'Monthly' }
    ],
    metrics: []
  });

  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, activeTab]);

  const handleSend = async (text: string) => {
    if (!text.trim()) return;
    
    const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', content: text, timestamp: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');

    setThinkingMessage('Agent is coordinating...');
    setIsThinking(true);

    try {
      // Convert messages to API format (just role + content)
      const chatHistory = messages.map(m => ({ role: m.role, content: m.content }));
      
      // Pass sessionId if we have one
      const agentResponse = await chatWithAgent(text, chatHistory, sessionId || undefined);
      
      // Store the session ID for future messages
      if (agentResponse.session_id) {
        setSessionId(agentResponse.session_id);
      }
      
      setMessages(prev => [...prev, { 
        id: Date.now().toString(), 
        role: 'assistant', 
        content: agentResponse.text, 
        timestamp: Date.now() 
      }]);

      if (isSpeechEnabled && !isVoiceActive) {
        await speakText(agentResponse.text);
      }

    } catch (err) {
      console.error('Chat error:', err);
      setMessages(prev => [...prev, { id: Date.now().toString(), role: 'assistant', content: "Connection error with Agent.", timestamp: Date.now() }]);
    } finally {
      setIsThinking(false);
    }
  };

  // Log symptoms to backend → MCP server → BigQuery
  const handleLogSymptom = async (data: SymptomData) => {
    setIsSyncing(true);
    
    try {
      const response = await fetch(`${BACKEND_URL}/log/symptoms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      
      const result = await response.json();
      
      if (result.success) {
        console.log('✅ Logged to BigQuery:', result.entry_id);
        
        // Update local state for analytics
        const newLog: SymptomLog = {
          id: result.entry_id || Date.now().toString(),
          timestamp: Date.now(),
          type: data.symptoms.join(', ') || 'General check-in',
          severity: data.fatigue >= 7 ? 'high' : data.fatigue >= 4 ? 'medium' : 'low',
          notes: data.notes
        };
        
        const newMetric: DailyMetrics = {
          id: Date.now().toString(),
          timestamp: Date.now(),
          mood: data.mood,
          fatigue: data.fatigue,
          sleepHours: 0,
          cognitiveFog: data.symptoms.includes('Brain Fog')
        };
        
        setUserData(prev => ({
          ...prev,
          logs: [...prev.logs, newLog],
          metrics: [...prev.metrics, newMetric]
        }));
        
      } else {
        console.error('❌ Log failed:', result.error);
        alert('Failed to log symptoms. Please try again.');
      }
      
    } catch (error) {
      console.error('❌ Network error:', error);
      alert('Connection error. Please check if backend is running.');
    } finally {
      setIsSyncing(false);
    }
  };

  const renderContent = () => {
    if (isVoiceActive) {
      return (
        <VoiceAssistant 
          isActive={isVoiceActive} 
          isSpeechEnabled={isSpeechEnabled}
          onToggle={() => setIsVoiceActive(false)}
          onDataLog={(category, data) => {
            if (category === 'symptom') {
              handleLogSymptom(data);
            }
          }}
          onTranscript={(text, role) => {
            setMessages(prev => [...prev, { id: Date.now().toString(), role, content: text, timestamp: Date.now() }]);
          }}
        />
      );
    }

    switch (activeTab) {
      case 'track':
        return <Tracker onLogSymptom={handleLogSymptom} />;
      case 'report':
        return <AnalyticsReport />;
      case 'chat':
      default:
        return (
          <div className="flex-1 flex flex-col p-4 space-y-4 overflow-y-auto">
            <div className="space-y-4 pb-20">
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full opacity-40 py-20 text-center">
                  <div className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center mb-6">
                    <i className="fas fa-comment-medical text-3xl text-orange-500"></i>
                  </div>
                  <h3 className="text-lg font-bold text-gray-800">Hello there.</h3>
                  <p className="text-sm font-medium text-gray-500">How can I support you today?<br/>Log a symptom or just tell me how you feel.</p>
                </div>
              )}
              {messages.map((m) => (
                <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] p-4 rounded-3xl ${m.role === 'user' ? 'bg-orange-500 text-white rounded-br-none shadow-md' : 'bg-white text-gray-800 rounded-bl-none border border-gray-100 shadow-sm'}`}>
                    <p className="text-sm leading-relaxed">{m.content}</p>
                    <p className="text-[10px] mt-1 opacity-50 font-bold uppercase tracking-widest">
                      {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              ))}
              {isThinking && (
                <div className="flex justify-start">
                  <div className="bg-white p-4 rounded-3xl border border-gray-100 shadow-sm flex items-center space-x-3">
                    <div className="flex space-x-1">
                      <div className="w-1.5 h-1.5 bg-orange-400 rounded-full animate-bounce"></div>
                      <div className="w-1.5 h-1.5 bg-orange-400 rounded-full animate-bounce delay-75"></div>
                      <div className="w-1.5 h-1.5 bg-orange-400 rounded-full animate-bounce delay-150"></div>
                    </div>
                    <span className="text-xs text-gray-400 italic font-medium">{thinkingMessage}</span>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full opacity-40 py-20 text-center">
                  <div className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center mb-6">
                    <i className="fas fa-comment-medical text-3xl text-orange-500"></i>
                  </div>
                  <h3 className="text-lg font-bold text-gray-800">Hello there.</h3>
                  <p className="text-sm font-medium text-gray-500">How can I support you today?<br/>Log a symptom or just tell me how you feel.</p>
                  
                  {/* Medical Disclaimer */}
                  <p className="text-xs text-gray-400 mt-6 max-w-xs">
                    <i className="fas fa-info-circle mr-1"></i>
                    Not medical advice. Always consult your doctor for medical decisions.
                  </p>
                </div>
              )}
            </div>
          </div>
        );
    }
  };

  return (
    <div className="flex flex-col h-screen bg-slate-50 text-gray-900 overflow-hidden font-sans">
      <header className="flex flex-col bg-white border-b border-gray-100 shadow-sm z-20">
        <div className="flex items-center justify-between px-6 py-3">
          <div className="flex items-center space-x-3">
            <div className="bg-ms-orange w-10 h-10 rounded-2xl flex items-center justify-center shadow-lg shadow-orange-200">
              <i className="fas fa-heartbeat text-white"></i>
            </div>
            <div>
              <h1 className="text-xl font-extrabold tracking-tight text-slate-800">MS Ally</h1>
              <div className="flex items-center space-x-2">
                  <div className={`w-1.5 h-1.5 rounded-full ${isSyncing ? 'bg-blue-500 animate-ping' : 'bg-green-500'}`}></div>
                  <p className="text-[9px] text-gray-400 uppercase font-black tracking-widest">Secure & Connected</p>
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button 
              onClick={() => {
                setIsVoiceInputEnabled(!isVoiceInputEnabled);
                if (isVoiceActive) setIsVoiceActive(false);
              }} 
              className={`p-2 w-10 h-10 rounded-xl transition-all flex items-center justify-center ${isVoiceInputEnabled ? 'bg-blue-50 text-blue-600' : 'bg-gray-50 text-gray-400'}`}
              title="Toggle Voice Input"
            >
              <i className={`fas ${isVoiceInputEnabled ? 'fa-microphone' : 'fa-microphone-slash'}`}></i>
            </button>
            <button 
              onClick={() => setIsSpeechEnabled(!isSpeechEnabled)} 
              className={`p-2 w-10 h-10 rounded-xl transition-all flex items-center justify-center ${isSpeechEnabled ? 'bg-orange-50 text-orange-600' : 'bg-gray-50 text-gray-400'}`}
              title="Toggle Speech Output"
            >
              <i className={`fas ${isSpeechEnabled ? 'fa-volume-up' : 'fa-volume-mute'}`}></i>
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <nav className="flex px-4 border-t border-gray-50">
          {(['chat', 'track', 'report'] as AppTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => { setActiveTab(tab); setIsVoiceActive(false); }}
              className={`flex-1 py-3 text-xs font-black uppercase tracking-widest transition-all relative ${
                activeTab === tab ? 'text-orange-600' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              <span className="flex items-center justify-center space-x-2">
                <i className={`fas ${tab === 'chat' ? 'fa-comment-alt' : tab === 'track' ? 'fa-plus-circle' : 'fa-chart-pie'}`}></i>
                <span>{tab}</span>
              </span>
              {activeTab === tab && (
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-orange-500 rounded-t-full"></div>
              )}
            </button>
          ))}
        </nav>
      </header>

      <main className="flex-1 relative overflow-hidden flex flex-col">
        {renderContent()}
      </main>

      <footer className="p-4 bg-white border-t border-gray-100 shadow-up">
        <div className="max-w-4xl mx-auto flex items-center space-x-2">
          {!isVoiceActive && activeTab === 'chat' && (
            <>
              {isVoiceInputEnabled && (
                <button 
                  onClick={() => setIsVoiceActive(true)} 
                  className="w-12 h-12 rounded-2xl bg-orange-50 text-orange-500 flex items-center justify-center shadow-inner hover:bg-orange-100 transition-all active:scale-95"
                >
                  <i className="fas fa-microphone text-lg"></i>
                </button>
              )}
              <div className="flex-1 relative">
                <input 
                  type="text" 
                  value={input} 
                  onChange={(e) => setInput(e.target.value)} 
                  onKeyPress={(e) => e.key === 'Enter' && handleSend(input)} 
                  placeholder="Message your Ally..."
                  className="w-full bg-slate-50 border-2 border-transparent focus:border-orange-100 rounded-2xl px-5 py-3 text-sm outline-none transition-all placeholder:text-gray-300 font-medium" 
                />
              </div>
              <button 
                onClick={() => handleSend(input)} 
                disabled={!input.trim()}
                className="w-12 h-12 rounded-2xl bg-slate-800 text-white flex items-center justify-center shadow-lg hover:bg-slate-900 disabled:opacity-20 disabled:shadow-none transition-all active:scale-95"
              >
                <i className="fas fa-paper-plane"></i>
              </button>
            </>
          )}
        </div>
      </footer>
    </div>
  );
};

export default App;