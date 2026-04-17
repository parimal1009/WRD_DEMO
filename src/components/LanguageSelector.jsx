import React from 'react';
import { useAppState } from '../store/AppContext.jsx';
import { SUPPORTED_LANGUAGES } from '../utils/languageMap.js';

/**
 * LanguageSelector — Dropdown for selecting transcription language.
 */
export default function LanguageSelector({ compact = false }) {
  const { state, dispatch, ActionTypes } = useAppState();
  const { language } = state.settings;

  const handleChange = (e) => {
    dispatch({ type: ActionTypes.SET_LANGUAGE, payload: e.target.value });
  };

  if (compact) {
    return (
      <div className="relative">
        <select
          value={language}
          onChange={handleChange}
          className="appearance-none bg-navy-800 border border-white/10 rounded-lg px-3 py-1.5 pr-8 text-xs text-white/80
                     focus:outline-none focus:border-amber-400 cursor-pointer hover:bg-navy-700 transition-colors"
          id="language-selector"
        >
          {SUPPORTED_LANGUAGES.map((lang) => (
            <option key={lang.code} value={lang.code} className="bg-navy-900">
              {lang.label}
            </option>
          ))}
        </select>
        <svg
          className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-white/40 pointer-events-none"
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-white/70">Transcription Language</label>
      <div className="relative">
        <select
          value={language}
          onChange={handleChange}
          className="input-field appearance-none pr-10 cursor-pointer"
          id="language-selector-full"
        >
          {SUPPORTED_LANGUAGES.map((lang) => (
            <option key={lang.code} value={lang.code} className="bg-navy-900">
              {lang.label}
            </option>
          ))}
        </select>
        <svg
          className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 pointer-events-none"
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>
      <p className="text-xs text-white/30">
        Select the language of the speaker, or choose Auto-detect.
      </p>
    </div>
  );
}
