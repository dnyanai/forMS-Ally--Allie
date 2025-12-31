// =============================================================================
// COMPONENTS/TRACKER.TSX - Daily Health Tracker
// =============================================================================
// Matches backend schema: mood, fatigue, symptoms[], medications_taken[], 
// period_status, notes

import React, { useState } from 'react';

// -----------------------------------------------------------------------------
// COMPONENT PROPS
// -----------------------------------------------------------------------------
interface TrackerProps {
  onLogSymptom: (data: SymptomData) => void;
}

interface SymptomData {
  mood: number;
  fatigue: number;
  symptoms: string[];
  medications_taken: string[];
  period_status: string | null;
  notes: string;
}

// -----------------------------------------------------------------------------
// COMMON MS SYMPTOMS
// -----------------------------------------------------------------------------
const COMMON_SYMPTOMS = [
  { name: 'Fatigue', icon: 'fa-battery-quarter' },
  { name: 'Numbness', icon: 'fa-hand' },
  { name: 'Tingling', icon: 'fa-hand-sparkles' },
  { name: 'Spasticity', icon: 'fa-person-walking' },
  { name: 'Pain', icon: 'fa-bolt' },
  { name: 'Vision Issues', icon: 'fa-eye' },
  { name: 'Brain Fog', icon: 'fa-cloud' },
  { name: 'Balance Issues', icon: 'fa-scale-balanced' },
  { name: 'Heat Sensitivity', icon: 'fa-temperature-high' },
  { name: 'Bladder Issues', icon: 'fa-droplet' },
];

// -----------------------------------------------------------------------------
// COMMON MS MEDICATIONS
// -----------------------------------------------------------------------------
const COMMON_MEDICATIONS = [
  'Ocrevus', 'Kesimpta', 'Tecfidera', 'Tysabri', 'Copaxone',
  'Rebif', 'Aubagio', 'Gilenya', 'Mavenclad', 'Vitamin D',
  'Baclofen', 'Gabapentin', 'Modafinil', 'Ampyra'
];

// -----------------------------------------------------------------------------
// MAIN COMPONENT
// -----------------------------------------------------------------------------
const Tracker: React.FC<TrackerProps> = ({ onLogSymptom }) => {
  // Form state
  const [mood, setMood] = useState(5);
  const [fatigue, setFatigue] = useState(5);
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const [selectedMeds, setSelectedMeds] = useState<string[]>([]);
  const [periodStatus, setPeriodStatus] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [customSymptom, setCustomSymptom] = useState('');
  const [customMed, setCustomMed] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);

  // Toggle symptom selection
  const toggleSymptom = (symptom: string) => {
    setSelectedSymptoms(prev => 
      prev.includes(symptom) 
        ? prev.filter(s => s !== symptom)
        : [...prev, symptom]
    );
  };

  // Toggle medication selection
  const toggleMed = (med: string) => {
    setSelectedMeds(prev =>
      prev.includes(med)
        ? prev.filter(m => m !== med)
        : [...prev, med]
    );
  };

  // Add custom symptom
  const addCustomSymptom = () => {
    if (customSymptom.trim() && !selectedSymptoms.includes(customSymptom.trim())) {
      setSelectedSymptoms(prev => [...prev, customSymptom.trim()]);
      setCustomSymptom('');
    }
  };

  // Add custom medication
  const addCustomMed = () => {
    if (customMed.trim() && !selectedMeds.includes(customMed.trim())) {
      setSelectedMeds(prev => [...prev, customMed.trim()]);
      setCustomMed('');
    }
  };

  // Submit form
  const handleSubmit = () => {
    const data: SymptomData = {
      mood,
      fatigue,
      symptoms: selectedSymptoms,
      medications_taken: selectedMeds,
      period_status: periodStatus,
      notes: notes.trim()
    };

    onLogSymptom(data);
    
    // Show success and reset
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 2000);
    
    // Reset form
    setSelectedSymptoms([]);
    setSelectedMeds([]);
    setPeriodStatus(null);
    setNotes('');
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-6 pb-24">
      {/* Success Toast */}
      {showSuccess && (
        <div className="fixed top-20 left-1/2 transform -translate-x-1/2 bg-green-500 text-white px-6 py-3 rounded-2xl shadow-lg z-50 animate-bounce">
          <i className="fas fa-check-circle mr-2"></i>
          Logged successfully!
        </div>
      )}

      {/* Mood & Fatigue Section */}
      <section className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100">
        <h2 className="text-sm font-black text-gray-400 uppercase tracking-widest mb-4">
          <i className="fas fa-heart mr-2 text-pink-500"></i>
          How are you feeling?
        </h2>

        {/* Mood Slider */}
        <div className="mb-5">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-gray-600">Mood</span>
            <span className="text-lg font-black text-orange-500">{mood}/10</span>
          </div>
          <input
            type="range"
            min="1"
            max="10"
            value={mood}
            onChange={(e) => setMood(parseInt(e.target.value))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-orange-500"
          />
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>😔 Low</span>
            <span>😊 Great</span>
          </div>
        </div>

        {/* Fatigue Slider */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-gray-600">Fatigue Level</span>
            <span className="text-lg font-black text-orange-500">{fatigue}/10</span>
          </div>
          <input
            type="range"
            min="1"
            max="10"
            value={fatigue}
            onChange={(e) => setFatigue(parseInt(e.target.value))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-orange-500"
          />
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>Energized</span>
            <span>Exhausted</span>
          </div>
        </div>
      </section>

      {/* Symptoms Section */}
      <section className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100">
        <h2 className="text-sm font-black text-gray-400 uppercase tracking-widest mb-4">
          <i className="fas fa-stethoscope mr-2 text-blue-500"></i>
          Symptoms Today
        </h2>
        
        {/* Symptom Grid */}
        <div className="flex flex-wrap gap-2 mb-4">
          {COMMON_SYMPTOMS.map((symptom) => (
            <button
              key={symptom.name}
              onClick={() => toggleSymptom(symptom.name)}
              className={`px-3 py-2 rounded-xl flex items-center space-x-2 transition-all text-sm ${
                selectedSymptoms.includes(symptom.name)
                  ? 'bg-blue-500 text-white shadow-md'
                  : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
              }`}
            >
              <i className={`fas ${symptom.icon}`}></i>
              <span>{symptom.name}</span>
            </button>
          ))}
        </div>

        {/* Custom Symptom Input */}
        <div className="flex space-x-2">
          <input
            type="text"
            value={customSymptom}
            onChange={(e) => setCustomSymptom(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && addCustomSymptom()}
            placeholder="Add other symptom..."
            className="flex-1 bg-gray-50 rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-200"
          />
          <button
            onClick={addCustomSymptom}
            className="px-4 py-2 bg-blue-100 text-blue-600 rounded-xl text-sm font-bold hover:bg-blue-200"
          >
            Add
          </button>
        </div>

        {/* Selected Symptoms */}
        {selectedSymptoms.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1">
            {selectedSymptoms.map(s => (
              <span key={s} className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                {s} ✓
              </span>
            ))}
          </div>
        )}
      </section>

      {/* Medications Section */}
      <section className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100">
        <h2 className="text-sm font-black text-gray-400 uppercase tracking-widest mb-4">
          <i className="fas fa-pills mr-2 text-purple-500"></i>
          Medications Taken
        </h2>
        
        {/* Common Meds Grid */}
        <div className="flex flex-wrap gap-2 mb-4">
          {COMMON_MEDICATIONS.map((med) => (
            <button
              key={med}
              onClick={() => toggleMed(med)}
              className={`px-3 py-2 rounded-xl transition-all text-sm ${
                selectedMeds.includes(med)
                  ? 'bg-purple-500 text-white shadow-md'
                  : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
              }`}
            >
              {med}
            </button>
          ))}
        </div>

        {/* Custom Med Input */}
        <div className="flex space-x-2">
          <input
            type="text"
            value={customMed}
            onChange={(e) => setCustomMed(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && addCustomMed()}
            placeholder="Add other medication..."
            className="flex-1 bg-gray-50 rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-purple-200"
          />
          <button
            onClick={addCustomMed}
            className="px-4 py-2 bg-purple-100 text-purple-600 rounded-xl text-sm font-bold hover:bg-purple-200"
          >
            Add
          </button>
        </div>

        {/* Selected Meds */}
        {selectedMeds.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1">
            {selectedMeds.map(m => (
              <span key={m} className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full">
                {m} ✓
              </span>
            ))}
          </div>
        )}
      </section>

      {/* Period Tracking (Optional) */}
      <section className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100">
        <h2 className="text-sm font-black text-gray-400 uppercase tracking-widest mb-4">
          <i className="fas fa-calendar mr-2 text-red-400"></i>
          Cycle Tracking (Optional)
        </h2>
        
        <div className="flex space-x-2">
          {['started', 'ongoing', 'ended'].map((status) => (
            <button
              key={status}
              onClick={() => setPeriodStatus(periodStatus === status ? null : status)}
              className={`flex-1 py-2 rounded-xl text-sm font-bold capitalize transition-all ${
                periodStatus === status
                  ? 'bg-red-400 text-white'
                  : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </section>

      {/* Notes Section */}
      <section className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100">
        <h2 className="text-sm font-black text-gray-400 uppercase tracking-widest mb-4">
          <i className="fas fa-sticky-note mr-2 text-yellow-500"></i>
          Notes
        </h2>
        
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Anything else you want to note? (sleep, stress, weather, etc.)"
          rows={3}
          className="w-full bg-gray-50 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-yellow-200 resize-none"
        />
      </section>

      {/* Submit Button */}
      <button
        onClick={handleSubmit}
        className="w-full py-4 bg-gradient-to-r from-orange-500 to-pink-500 text-white rounded-2xl font-bold text-sm hover:opacity-90 transition-all active:scale-95 shadow-lg"
      >
        <i className="fas fa-save mr-2"></i>
        Log Today's Entry
      </button>
    </div>
  );
};

export default Tracker;