import React from 'react';
import { useAppState } from '../store/AppContext.jsx';
import LanguageSelector from './LanguageSelector.jsx';

/**
 * TopBar — App header with logo, filename, language selector, settings, and save.
 */
export default function TopBar({ onSave, onSettings, onHome }) {
  const { state, dispatch, ActionTypes } = useAppState();
  const { document: doc, ui } = state;

  return (
    <header className="h-14 bg-navy-950 border-b border-white/5 flex items-center justify-between px-4 select-none z-50">
      {/* Left: Logo + Title */}
      <div className="flex items-center gap-3">
        <button
          onClick={onHome}
          className="flex items-center gap-2 hover:opacity-80 transition-opacity"
          title="Return to Home"
        >
          {/* Mic icon as logo */}
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-amber-500 flex items-center justify-center shadow-lg">
            <svg className="w-4 h-4 text-navy-900" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1-9c0-.55.45-1 1-1s1 .45 1 1v6c0 .55-.45 1-1 1s-1-.45-1-1V5z"/>
              <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
            </svg>
          </div>
          <div>
            <h1 className="text-sm font-bold text-white tracking-wide">VoiceDoc AI</h1>
            <p className="text-[10px] text-white/30 -mt-0.5">Zedpro Digital</p>
          </div>
        </button>

        {/* Document name */}
        {doc.isLoaded && (
          <div className="flex items-center gap-2 ml-4 pl-4 border-l border-white/10">
            <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span className="text-sm text-white/70 font-mono max-w-[200px] truncate">
              {doc.fileName}
            </span>
            <span className="text-xs text-white/30 bg-navy-800 px-2 py-0.5 rounded-full">
              {Object.keys(state.insertions).length} fields filled
            </span>
          </div>
        )}
      </div>

      {/* Right: Controls */}
      <div className="flex items-center gap-3">
        {/* Language Selector */}
        <LanguageSelector compact />

        {/* Settings Button */}
        <button
          onClick={onSettings}
          className="w-9 h-9 rounded-lg bg-navy-800 border border-white/5 flex items-center justify-center
                     hover:bg-navy-700 hover:border-white/10 transition-all duration-200 tooltip"
          data-tooltip="Settings"
          id="settings-button"
        >
          <svg className="w-4 h-4 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>

        {/* Save Button */}
        {doc.isLoaded && (
          <button
            onClick={onSave}
            className="btn-primary flex items-center gap-2 text-sm"
            id="save-button"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
            </svg>
            Save
          </button>
        )}
      </div>
    </header>
  );
}
