import React, { useState, useEffect } from 'react';
import { useAppState } from '../store/AppContext.jsx';
import { testConnection } from '../services/groqService.js';
import LanguageSelector from './LanguageSelector.jsx';

/**
 * SettingsModal — Groq API key, default language, save dir, toggles.
 */
export default function SettingsModal({ onClose }) {
  const { state, dispatch, ActionTypes, notify } = useAppState();
  const { settings } = state;

  const [apiKey, setApiKey] = useState(settings.apiKey || '');
  const [defaultSaveDir, setDefaultSaveDir] = useState(settings.defaultSaveDir || '');
  const [retainAudio, setRetainAudio] = useState(settings.retainAudio);
  const [aiPostProcessing, setAiPostProcessing] = useState(settings.aiPostProcessing);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const handleSave = async () => {
    // Update state
    dispatch({
      type: ActionTypes.SET_SETTINGS,
      payload: {
        apiKey,
        defaultSaveDir,
        retainAudio,
        aiPostProcessing,
      },
    });

    // Persist securely
    try {
      if (window.electronAPI) {
        await window.electronAPI.saveSecureSetting('groq_api_key', apiKey);
        await window.electronAPI.saveSetting('app_settings', {
          defaultSaveDir,
          retainAudio,
          aiPostProcessing,
          language: settings.language,
        });
      }
    } catch (e) {
      console.warn('Failed to persist settings:', e);
    }

    notify('Settings saved', 'success');
    onClose();
  };

  const handleTestConnection = async () => {
    if (!apiKey) {
      setTestResult({ success: false, error: 'Please enter an API key' });
      return;
    }
    setIsTesting(true);
    setTestResult(null);
    const result = await testConnection(apiKey);
    setTestResult(result);
    setIsTesting(false);
  };

  const handlePickDir = async () => {
    // In a real Electron app we'd use a directory picker here
    // For now we use a text input
    notify('Type a directory path manually', 'info');
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
      <div className="glass-card w-full max-w-lg mx-4 p-0 shadow-2xl max-h-[85vh] overflow-y-auto">
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between sticky top-0 bg-navy-800/90 backdrop-blur-lg z-10 rounded-t-xl">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <h2 className="text-lg font-semibold text-white">Settings</h2>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white/60 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-5 space-y-6">
          {/* API Key */}
          <div>
            <label className="block text-sm font-medium text-white/70 mb-1.5">Groq API Key</label>
            <div className="flex gap-2">
              <input
                type="password"
                value={apiKey}
                onChange={(e) => { setApiKey(e.target.value); setTestResult(null); }}
                placeholder="gsk_..."
                className="input-field flex-1 font-mono text-sm"
                id="api-key-input"
              />
              <button
                onClick={handleTestConnection}
                disabled={isTesting}
                className="btn-secondary text-sm whitespace-nowrap flex items-center gap-1.5 disabled:opacity-50"
                id="test-connection-button"
              >
                {isTesting ? (
                  <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                ) : (
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                )}
                Test
              </button>
            </div>
            {testResult && (
              <div className={`mt-2 text-xs flex items-center gap-1.5 ${testResult.success ? 'text-green-400' : 'text-red-400'}`}>
                {testResult.success ? (
                  <>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Connected to Groq API successfully!
                  </>
                ) : (
                  <>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    {testResult.error}
                  </>
                )}
              </div>
            )}
            <p className="text-xs text-white/30 mt-2">
              Get a free API key at{' '}
              <a href="https://console.groq.com" target="_blank" rel="noopener noreferrer" className="text-amber-400/60 hover:text-amber-400">
                console.groq.com
              </a>
            </p>
          </div>

          {/* Default Save Directory */}
          <div>
            <label className="block text-sm font-medium text-white/70 mb-1.5">Default Save Directory</label>
            <input
              type="text"
              value={defaultSaveDir}
              onChange={(e) => setDefaultSaveDir(e.target.value)}
              placeholder="C:\Documents"
              className="input-field text-sm font-mono"
              id="save-dir-input"
            />
          </div>

          {/* Language */}
          <LanguageSelector />

          {/* Toggles */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-white/70">Options</h3>
            
            {/* Retain Audio Toggle */}
            <label className="flex items-center justify-between cursor-pointer group" id="retain-audio-toggle">
              <div>
                <p className="text-sm text-white/80 group-hover:text-white transition-colors">Retain audio for audit trail</p>
                <p className="text-xs text-white/30">Keep audio recordings attached to the audit trail</p>
              </div>
              <div
                className={`w-11 h-6 rounded-full relative transition-colors duration-200 ${retainAudio ? 'bg-amber-400' : 'bg-navy-600'}`}
                onClick={() => setRetainAudio(!retainAudio)}
              >
                <div
                  className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-transform duration-200 
                    ${retainAudio ? 'translate-x-[22px]' : 'translate-x-0.5'}`}
                />
              </div>
            </label>

            {/* AI Post-Processing Toggle */}
            <label className="flex items-center justify-between cursor-pointer group" id="ai-processing-toggle">
              <div>
                <p className="text-sm text-white/80 group-hover:text-white transition-colors">AI post-processing</p>
                <p className="text-xs text-white/30">Use LLaMA to correct grammar and refine transcriptions</p>
              </div>
              <div
                className={`w-11 h-6 rounded-full relative transition-colors duration-200 ${aiPostProcessing ? 'bg-amber-400' : 'bg-navy-600'}`}
                onClick={() => setAiPostProcessing(!aiPostProcessing)}
              >
                <div
                  className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-transform duration-200 
                    ${aiPostProcessing ? 'translate-x-[22px]' : 'translate-x-0.5'}`}
                />
              </div>
            </label>
          </div>

          {/* About */}
          <div className="border-t border-white/5 pt-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-400/20 to-amber-500/10 flex items-center justify-center">
                <svg className="w-5 h-5 text-amber-400" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
                  <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-white/70">VoiceDoc AI v1.0.0</p>
                <p className="text-xs text-white/30">Zedpro Digital Ltd · Birmingham</p>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="px-6 py-4 border-t border-white/5 flex justify-end gap-3 sticky bottom-0 bg-navy-800/90 backdrop-blur-lg rounded-b-xl">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={handleSave} className="btn-primary" id="save-settings-button">
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
}
