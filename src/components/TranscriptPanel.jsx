import React from 'react';
import { isRTL } from '../utils/languageMap.js';
import { useAppState } from '../store/AppContext.jsx';

/**
 * TranscriptPanel — Shows raw and polished transcripts with edit, insert, re-record, and discard actions.
 */
export default function TranscriptPanel({
  rawText,
  polishedText,
  onPolishedTextChange,
  onInsert,
  onReRecord,
  onDiscard,
  isPolishing,
}) {
  const { state } = useAppState();
  const rtl = isRTL(state.settings.language);

  return (
    <div className="flex-1 flex flex-col border-t border-white/5 overflow-y-auto">
      {/* Raw transcript */}
      <div className="px-4 py-3 border-b border-white/5">
        <p className="text-xs font-medium text-white/30 mb-1.5 uppercase tracking-wider">Raw Transcription</p>
        <p
          className="text-sm text-white/40 leading-relaxed font-mono"
          dir={rtl ? 'rtl' : 'ltr'}
        >
          {rawText || 'No transcription yet.'}
        </p>
      </div>

      {/* Polished transcript (editable) */}
      <div className="px-4 py-3 flex-1">
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-xs font-medium text-white/50 uppercase tracking-wider">
            {isPolishing ? 'AI Processing...' : 'Polished Text'}
          </p>
          {isPolishing && (
            <svg className="w-3 h-3 animate-spin text-amber-400" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
          )}
        </div>
        <textarea
          value={polishedText}
          onChange={(e) => onPolishedTextChange(e.target.value)}
          dir={rtl ? 'rtl' : 'ltr'}
          className="w-full bg-navy-800/50 border border-white/5 rounded-lg p-3 text-sm text-white leading-relaxed
                     font-mono resize-none focus:outline-none focus:border-amber-400/30 transition-colors
                     min-h-[100px]"
          placeholder="Polished text will appear here..."
          id="polished-text-editor"
        />
      </div>

      {/* Action Buttons */}
      <div className="px-4 py-3 border-t border-white/5 flex items-center gap-2">
        <button
          onClick={() => onInsert(polishedText)}
          disabled={!polishedText || isPolishing}
          className="btn-success flex items-center gap-1.5 text-sm flex-1 justify-center disabled:opacity-50 disabled:cursor-not-allowed"
          id="insert-button"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          Insert into Document
        </button>

        <button
          onClick={onReRecord}
          className="btn-secondary flex items-center gap-1.5 text-sm"
          title="Re-record"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Re-record
        </button>

        <button
          onClick={onDiscard}
          className="w-9 h-9 rounded-lg bg-navy-700 border border-white/5 flex items-center justify-center
                     hover:bg-red-500/20 hover:border-red-500/20 transition-all"
          title="Discard"
        >
          <svg className="w-4 h-4 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
