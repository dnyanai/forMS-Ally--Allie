// =============================================================================
// COMPONENTS/REPORT.TSX - Analytics Report Component
// =============================================================================

import React, { useState, useEffect } from 'react';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "https://for-ms-backend-22097057568.us-west1.run.app/";

// -----------------------------------------------------------------------------
// TYPES
// -----------------------------------------------------------------------------
interface SymptomLog {
  entry_id: string;
  entry_date: string;
  mood: number;
  fatigue: number;
  symptoms: string[];
  medications_taken: string[];
  period_status: string | null;
  notes: string;
}

interface Summary {
  total_entries: number;
  avg_mood: number | null;
  avg_fatigue: number | null;
  mood_range: [number, number];
  fatigue_range: [number, number];
  top_symptoms: { symptom: string; count: number }[];
  days: number;
}

// -----------------------------------------------------------------------------
// MAIN COMPONENT
// -----------------------------------------------------------------------------
const AnalyticsReport: React.FC = () => {
  const [logs, setLogs] = useState<SymptomLog[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(7);
  const [lastFetched, setLastFetched] = useState<string | null>(null);

  // Load cached data on mount (no API call)
  useEffect(() => {
    const cachedLogs = sessionStorage.getItem('msally_report_logs');
    const cachedSummary = sessionStorage.getItem('msally_report_summary');
    const cachedDays = sessionStorage.getItem('msally_report_days');
    const cachedTime = sessionStorage.getItem('msally_report_time');
    
    if (cachedLogs && cachedSummary) {
      setLogs(JSON.parse(cachedLogs));
      setSummary(JSON.parse(cachedSummary));
      if (cachedDays) setDays(Number(cachedDays));
      if (cachedTime) setLastFetched(cachedTime);
    }
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [logsRes, summaryRes] = await Promise.all([
        fetch(`${BACKEND_URL}/report/symptoms?days=${days}`),
        fetch(`${BACKEND_URL}/report/summary?days=${days}`)
      ]);

      const logsData = await logsRes.json();
      const summaryData = await summaryRes.json();

      if (logsData.success) {
        setLogs(logsData.logs);
        sessionStorage.setItem('msally_report_logs', JSON.stringify(logsData.logs));
      }
      if (summaryData.success) {
        setSummary(summaryData.summary);
        sessionStorage.setItem('msally_report_summary', JSON.stringify(summaryData.summary));
      }
      
      // Cache the days and timestamp
      sessionStorage.setItem('msally_report_days', String(days));
      const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      sessionStorage.setItem('msally_report_time', now);
      setLastFetched(now);
      
      if (!logsData.success && !summaryData.success) setError('Failed to fetch report data');

    } catch (err) {
      console.error('Report fetch error:', err);
      setError('Failed to connect to server');
    } finally {
      setIsLoading(false);
    }
  };

  // -----------------------------------------------------------------------------
  // HELPERS
  // -----------------------------------------------------------------------------
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getMoodEmoji = (mood: number) => {
    if (mood <= 3) return '😔';
    if (mood <= 5) return '😐';
    if (mood <= 7) return '🙂';
    return '😊';
  };

  const getMoodColor = (mood: number) => {
    if (mood <= 3) return 'text-red-500';
    if (mood <= 5) return 'text-yellow-500';
    if (mood <= 7) return 'text-blue-500';
    return 'text-green-500';
  };

  const getFatigueColor = (fatigue: number) => {
    if (fatigue <= 3) return 'text-green-500';
    if (fatigue <= 5) return 'text-yellow-500';
    if (fatigue <= 7) return 'text-orange-500';
    return 'text-red-500';
  };

  // -----------------------------------------------------------------------------
  // RENDER
  // -----------------------------------------------------------------------------
  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Health Report</h2>
          <p className="text-slate-400 text-sm">
            {lastFetched ? `Last updated at ${lastFetched}` : 'Click refresh to load data'}
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="bg-white text-slate-700 px-3 py-2 rounded-xl border border-gray-200 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100 text-sm font-medium"
          >
            <option value={7}>Last 7 days</option>
            <option value={14}>Last 14 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
          <button
            onClick={fetchData}
            disabled={isLoading}
            className="p-2.5 bg-orange-500 text-white rounded-xl hover:bg-orange-600 disabled:opacity-50 transition-all active:scale-95 shadow-sm"
          >
            <i className={`fas ${isLoading ? 'fa-spinner fa-spin' : 'fa-refresh'}`}></i>
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-100 rounded-2xl p-4 mb-6">
          <p className="text-red-600 text-sm">
            <i className="fas fa-exclamation-circle mr-2"></i>
            {error}
          </p>
        </div>
      )}

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          {/* Entries */}
          <div className="bg-gradient-to-br from-orange-50 to-orange-100/50 rounded-2xl p-4 border border-orange-100">
            <p className="text-orange-600/70 text-xs uppercase tracking-wider font-semibold mb-1">Entries</p>
            <p className="text-3xl font-bold text-orange-600">{summary.total_entries}</p>
          </div>

          {/* Avg Mood */}
          <div className="bg-gradient-to-br from-blue-50 to-blue-100/50 rounded-2xl p-4 border border-blue-100">
            <p className="text-blue-600/70 text-xs uppercase tracking-wider font-semibold mb-1">Avg Mood</p>
            <p className={`text-2xl font-bold ${summary.avg_mood ? getMoodColor(summary.avg_mood) : 'text-slate-400'}`}>
              {summary.avg_mood ? `${summary.avg_mood}/10` : 'N/A'}
              <span className="ml-1">{summary.avg_mood ? getMoodEmoji(summary.avg_mood) : ''}</span>
            </p>
          </div>

          {/* Avg Fatigue */}
          <div className="bg-gradient-to-br from-purple-50 to-purple-100/50 rounded-2xl p-4 border border-purple-100">
            <p className="text-purple-600/70 text-xs uppercase tracking-wider font-semibold mb-1">Avg Fatigue</p>
            <p className={`text-2xl font-bold ${summary.avg_fatigue ? getFatigueColor(summary.avg_fatigue) : 'text-slate-400'}`}>
              {summary.avg_fatigue ? `${summary.avg_fatigue}/10` : 'N/A'}
            </p>
          </div>

          {/* Top Symptom */}
          <div className="bg-gradient-to-br from-rose-50 to-rose-100/50 rounded-2xl p-4 border border-rose-100">
            <p className="text-rose-600/70 text-xs uppercase tracking-wider font-semibold mb-1">Top Symptom</p>
            <p className="text-lg font-bold text-rose-600 truncate">
              {summary.top_symptoms?.[0]?.symptom || 'None'}
            </p>
            {summary.top_symptoms?.[0] && (
              <p className="text-rose-400 text-xs">{summary.top_symptoms[0].count} times</p>
            )}
          </div>
        </div>
      )}

      {/* Two Column Layout for larger screens */}
      <div className="grid lg:grid-cols-2 gap-4">
        
        {/* Most Reported Symptoms */}
        {summary && summary.top_symptoms?.length > 0 && (
          <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
            <h3 className="text-slate-700 font-semibold mb-4 flex items-center text-sm">
              <span className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center mr-3">
                <i className="fas fa-chart-bar text-orange-500 text-xs"></i>
              </span>
              Most Reported Symptoms
            </h3>
            <div className="space-y-3">
              {summary.top_symptoms.slice(0, 5).map((item, idx) => (
                <div key={idx} className="flex items-center gap-3">
                  <span className="text-slate-600 text-sm w-28 truncate font-medium">{item.symptom}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-2.5 overflow-hidden">
                    <div 
                      className="bg-gradient-to-r from-orange-400 to-orange-500 h-full rounded-full transition-all duration-700"
                      style={{ width: `${(item.count / summary.top_symptoms[0].count) * 100}%` }}
                    ></div>
                  </div>
                  <span className="text-slate-400 text-sm w-6 text-right font-semibold">{item.count}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Medications Taken - if we have data */}
        {logs.length > 0 && (
          <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
            <h3 className="text-slate-700 font-semibold mb-4 flex items-center text-sm">
              <span className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center mr-3">
                <i className="fas fa-pills text-blue-500 text-xs"></i>
              </span>
              Medications Logged
            </h3>
            <div className="flex flex-wrap gap-2">
              {(() => {
                const medCounts: { [key: string]: number } = {};
                logs.forEach(log => {
                  log.medications_taken.forEach(med => {
                    medCounts[med] = (medCounts[med] || 0) + 1;
                  });
                });
                const meds = Object.entries(medCounts).sort((a, b) => b[1] - a[1]);
                
                if (meds.length === 0) {
                  return <p className="text-slate-400 text-sm">No medications logged</p>;
                }
                
                return meds.map(([med, count]) => (
                  <span key={med} className="px-3 py-1.5 bg-blue-50 text-blue-600 text-sm rounded-full font-medium border border-blue-100">
                    💊 {med} <span className="text-blue-400">×{count}</span>
                  </span>
                ));
              })()}
            </div>
          </div>
        )}
      </div>

      {/* Recent Logs - Full Width */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm mt-4 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-50 bg-gray-50/50">
          <h3 className="text-slate-700 font-semibold flex items-center text-sm">
            <span className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center mr-3">
              <i className="fas fa-history text-green-500 text-xs"></i>
            </span>
            Recent Logs
          </h3>
        </div>
        
        {isLoading ? (
          <div className="p-8 text-center">
            <i className="fas fa-spinner fa-spin text-2xl text-orange-500"></i>
            <p className="text-slate-400 mt-2 text-sm">Loading...</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="p-8 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <i className="fas fa-clipboard-list text-2xl text-gray-300"></i>
            </div>
            <p className="text-slate-500 font-medium">No data loaded</p>
            <p className="text-slate-400 text-sm mt-1">
              {lastFetched ? 'No logs found for this period' : 'Click the refresh button to load your report'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50 max-h-[400px] overflow-y-auto">
            {logs.map((log) => (
              <div key={log.entry_id} className="p-4 hover:bg-orange-50/30 transition-colors">
                <div className="flex items-start justify-between mb-2">
                  <span className="text-slate-400 text-xs font-medium bg-gray-100 px-2 py-1 rounded-md">
                    {formatDate(log.entry_date)}
                  </span>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-slate-500">
                      Mood: <span className={`font-semibold ${getMoodColor(log.mood)}`}>{log.mood}/10</span>
                      <span className="ml-1">{getMoodEmoji(log.mood)}</span>
                    </span>
                    <span className="text-slate-500">
                      Fatigue: <span className={`font-semibold ${getFatigueColor(log.fatigue)}`}>{log.fatigue}/10</span>
                    </span>
                  </div>
                </div>
                
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {log.symptoms.map((symptom, idx) => (
                    <span key={idx} className="px-2.5 py-1 bg-red-50 text-red-600 text-xs rounded-full font-medium">
                      {symptom}
                    </span>
                  ))}
                  
                  {log.medications_taken.map((med, idx) => (
                    <span key={idx} className="px-2.5 py-1 bg-blue-50 text-blue-600 text-xs rounded-full font-medium">
                      💊 {med}
                    </span>
                  ))}
                  
                  {log.period_status && (
                    <span className="px-2.5 py-1 bg-purple-50 text-purple-600 text-xs rounded-full font-medium">
                      Period: {log.period_status}
                    </span>
                  )}
                </div>
                
                {log.notes && (
                  <p className="text-slate-500 text-sm mt-2 italic bg-gray-50 p-2 rounded-lg">"{log.notes}"</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AnalyticsReport;