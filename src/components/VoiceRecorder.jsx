import React, { useState, useEffect, useRef } from 'react';
import { useAudioRecorder } from '../hooks/useAudioRecorder.js';
import { useGroqTranscription } from '../hooks/useGroqTranscription.js';
import { useAppState } from '../store/AppContext.jsx';
import TranscriptPanel from './TranscriptPanel.jsx';

/**
 * VoiceRecorder — Dual-mode panel: Voice dictation OR Manual text entry.
 * Shows a tab bar at top to switch between modes.
 */
export default function VoiceRecorder() {
  const { state, dispatch, ActionTypes, notify } = useAppState();
  const { activeFieldId } = state;
  const fieldInfo = state.document.fieldMap?.[activeFieldId];
  const textareaRef = useRef(null);

  // Mode: 'voice' or 'type'
  const [mode, setMode] = useState('type');
  const [manualText, setManualText] = useState('');

  const {
    isRecording,
    isPaused,
    audioBlob,
    audioUrl,
    formattedDuration,
    error: recError,
    waveformData,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    resetRecording,
  } = useAudioRecorder();

  const {
    isTranscribing,
    isPolishing,
    rawText,
    polishedText,
    error: transcriptionError,
    transcribe,
    reset: resetTranscription,
    updatePolishedText,
  } = useGroqTranscription();

  // Reset manual text and focus textarea when active field changes
  useEffect(() => {
    setManualText('');
    if (mode === 'type' && textareaRef.current) {
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  }, [activeFieldId]);

  if (!state.ui.showRecorder || !activeFieldId) return null;

  const handleStop = () => {
    stopRecording();
  };

  const handleTranscribe = async () => {
    if (!audioBlob) return;
    const result = await transcribe(audioBlob);
    if (result && (result.polishedText || result.rawText)) {
      handleInsert(result.polishedText || result.rawText);
    }
  };

  const handleReRecord = () => {
    resetRecording();
    resetTranscription();
  };

  const handleInsert = (text) => {
    if (!text || !text.trim()) return;

    dispatch({
      type: ActionTypes.INSERT_TEXT,
      payload: { fieldId: activeFieldId, text: text.trim() },
    });

    // Add to audit trail
    dispatch({
      type: ActionTypes.ADD_AUDIT_ENTRY,
      payload: {
        fieldId: activeFieldId,
        fieldLabel: fieldInfo?.label || activeFieldId,
        language: state.settings.language,
        rawText: mode === 'voice' ? rawText : '',
        polishedText: text.trim(),
        audioBlob: mode === 'voice' && state.settings.retainAudio ? audioBlob : null,
        audioUrl: mode === 'voice' && state.settings.retainAudio ? audioUrl : null,
        inputMode: mode,
      },
    });

    // Auto-advance to next field
    const fieldMapping = Object.entries(state.document.fieldMap || {});
    fieldMapping.sort((a, b) => (a[1].index ?? 0) - (b[1].index ?? 0));
    const keys = fieldMapping.map(f => f[0]);
    const currentIndex = keys.indexOf(activeFieldId);

    let nextFieldId = null;
    if (currentIndex >= 0 && currentIndex < keys.length - 1) {
      nextFieldId = keys[currentIndex + 1];
    }

    // Reset state for next field
    setManualText('');
    resetRecording();
    resetTranscription();

    if (nextFieldId) {
      dispatch({ type: ActionTypes.SET_ACTIVE_FIELD, payload: nextFieldId });
      notify(`✓ Inserted → moved to next field`, 'success');
    } else {
      dispatch({ type: ActionTypes.CLEAR_ACTIVE_FIELD });
      notify('✓ All fields complete!', 'success');
    }
  };

  const handleDiscard = () => {
    resetRecording();
    resetTranscription();
    setManualText('');
    dispatch({ type: ActionTypes.CLEAR_ACTIVE_FIELD });
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (manualText.trim()) {
        handleInsert(manualText.trim());
      }
    }
  };

  const hasTranscript = rawText || polishedText;

  return (
    <div className="w-96 border-l border-white/5 bg-navy-950 flex flex-col animate-fade-in">
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${
            isRecording ? 'bg-red-500 animate-pulse' 
            : audioBlob ? 'bg-green-500' 
            : mode === 'type' ? 'bg-blue-400' 
            : 'bg-white/20'
          }`} />
          <h3 className="text-sm font-semibold text-white/80">
            {mode === 'voice' ? 'Voice Recorder' : 'Manual Entry'}
          </h3>
        </div>
        <button
          onClick={handleDiscard}
          className="text-white/30 hover:text-white/60 transition-colors"
          title="Close (Esc)"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Active Field Info */}
      <div className="px-4 py-2 bg-amber-400/5 border-b border-amber-400/10">
        <p className="text-xs text-amber-400/70">Filling field:</p>
        <p className="text-sm font-mono text-amber-400 truncate">
          {fieldInfo?.label || activeFieldId}
        </p>
      </div>

      {/* Mode Tab Switcher */}
      <div className="flex border-b border-white/5">
        <button
          onClick={() => setMode('voice')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-all duration-200
            ${mode === 'voice'
              ? 'text-amber-400 border-b-2 border-amber-400 bg-amber-400/5'
              : 'text-white/40 hover:text-white/60 hover:bg-white/[0.02]'
            }`}
          id="mode-voice"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
            <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
          </svg>
          Voice
        </button>
        <button
          onClick={() => setMode('type')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-all duration-200
            ${mode === 'type'
              ? 'text-blue-400 border-b-2 border-blue-400 bg-blue-400/5'
              : 'text-white/40 hover:text-white/60 hover:bg-white/[0.02]'
            }`}
          id="mode-type"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          Type
        </button>
      </div>

      {/* ═══════════ VOICE MODE ═══════════ */}
      {mode === 'voice' && (
        <>
          {/* Waveform Visualizer */}
          <div className="px-4 py-6 flex flex-col items-center">
            {/* Waveform bars */}
            <div className="h-12 flex items-end justify-center gap-0.5 mb-4 w-full">
              {waveformData.map((height, i) => (
                <div
                  key={i}
                  className="waveform-bar"
                  style={{
                    height: `${height}px`,
                    opacity: isRecording ? 1 : 0.3,
                    background: isRecording
                      ? 'linear-gradient(to top, #F5A623, #EF4444)'
                      : '#3A5068',
                  }}
                />
              ))}
            </div>

            {/* Duration */}
            <div className="text-2xl font-mono text-white/80 mb-4 tracking-wider">
              {formattedDuration}
            </div>

            {/* Controls */}
            <div className="flex items-center gap-4">
              {!isRecording && !audioBlob && (
                <button
                  onClick={startRecording}
                  className="w-16 h-16 rounded-full bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center
                             hover:from-red-400 hover:to-red-500 transition-all duration-300 shadow-lg shadow-red-500/30
                             active:scale-95"
                  id="record-button"
                  title="Start Recording"
                >
                  <svg className="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
                    <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
                  </svg>
                </button>
              )}

              {isRecording && !isPaused && (
                <>
                  <button
                    onClick={pauseRecording}
                    className="w-12 h-12 rounded-full bg-navy-700 border border-white/10 flex items-center justify-center
                               hover:bg-navy-600 transition-all"
                    title="Pause"
                  >
                    <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
                    </svg>
                  </button>
                  <button
                    onClick={handleStop}
                    className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center mic-pulse
                               hover:bg-red-400 transition-all active:scale-95"
                    id="stop-button"
                    title="Stop Recording"
                  >
                    <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M6 6h12v12H6z"/>
                    </svg>
                  </button>
                </>
              )}

              {isRecording && isPaused && (
                <>
                  <button
                    onClick={resumeRecording}
                    className="w-12 h-12 rounded-full bg-amber-400 flex items-center justify-center
                               hover:bg-amber-300 transition-all"
                    title="Resume"
                  >
                    <svg className="w-5 h-5 text-navy-900" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z"/>
                    </svg>
                  </button>
                  <button
                    onClick={handleStop}
                    className="w-12 h-12 rounded-full bg-red-500 flex items-center justify-center
                               hover:bg-red-400 transition-all"
                    title="Stop"
                  >
                    <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M6 6h12v12H6z"/>
                    </svg>
                  </button>
                </>
              )}

              {!isRecording && audioBlob && !hasTranscript && (
                <>
                  <button
                    onClick={handleReRecord}
                    className="w-12 h-12 rounded-full bg-navy-700 border border-white/10 flex items-center justify-center
                               hover:bg-navy-600 transition-all"
                    title="Re-record"
                  >
                    <svg className="w-5 h-5 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </button>
                  <button
                    onClick={handleTranscribe}
                    disabled={isTranscribing}
                    className="btn-primary flex items-center gap-2 disabled:opacity-50"
                    id="transcribe-button"
                  >
                    {isTranscribing ? (
                      <>
                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                        </svg>
                        Processing...
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        Transcribe
                      </>
                    )}
                  </button>
                </>
              )}
            </div>

            {/* Audio Playback */}
            {audioUrl && !isRecording && (
              <div className="mt-4 w-full">
                <audio src={audioUrl} controls className="w-full h-8 opacity-60" style={{ filter: 'invert(1)' }} />
              </div>
            )}

            {/* Error */}
            {(recError || transcriptionError) && (
              <div className="mt-3 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-400">
                {recError || transcriptionError}
              </div>
            )}

            {/* Processing indicator */}
            {(isTranscribing || isPolishing) && (
              <div className="mt-4 flex items-center gap-2 text-sm text-amber-400">
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                {isTranscribing ? 'Transcribing with Whisper...' : 'AI polishing text...'}
              </div>
            )}
          </div>

          {/* Transcript Panel */}
          {hasTranscript && (
            <TranscriptPanel
              rawText={rawText}
              polishedText={polishedText}
              onPolishedTextChange={updatePolishedText}
              onInsert={handleInsert}
              onReRecord={handleReRecord}
              onDiscard={handleDiscard}
              isPolishing={isPolishing}
            />
          )}
        </>
      )}

      {/* ═══════════ TYPE MODE ═══════════ */}
      {mode === 'type' && (
        <div className="flex-1 flex flex-col">
          {/* Manual text area */}
          <div className="flex-1 px-4 py-4">
            <label className="block text-xs font-medium text-white/40 mb-2 uppercase tracking-wider">
              Type your text below
            </label>
            {/* Quick Actions for MCQ / Yes-No */}
            <div className="flex gap-2 mb-3">
              <button
                onClick={() => handleInsert('Yes')}
                className="flex-1 bg-green-500/10 hover:bg-green-500/20 text-green-400 border border-green-500/20 rounded-md py-1.5 text-xs font-medium transition-colors"
              >
                Yes
              </button>
              <button
                onClick={() => handleInsert('No')}
                className="flex-1 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 rounded-md py-1.5 text-xs font-medium transition-colors"
              >
                No
              </button>
              <button
                onClick={() => handleInsert('N/A')}
                className="flex-1 bg-navy-600 hover:bg-navy-500 text-white/70 border border-white/10 rounded-md py-1.5 text-xs font-medium transition-colors"
              >
                N/A
              </button>
              <button
                onClick={() => handleInsert('✓')}
                className="flex-1 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 rounded-md py-1.5 text-xs font-medium transition-colors"
              >
                ✓ Tick
              </button>
              <button
                onClick={() => handleInsert('✗')}
                className="flex-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-md py-1.5 text-xs font-medium transition-colors"
              >
                ✗ Cross
              </button>
            </div>

            <textarea
              ref={textareaRef}
              value={manualText}
              onChange={(e) => setManualText(e.target.value)}
              placeholder="Type text and press Enter to insert..."
              className="w-full flex-1 min-h-[140px] bg-navy-800/50 border border-white/5 rounded-lg p-4
                         text-sm text-white leading-relaxed font-mono resize-none
                         focus:outline-none focus:border-blue-400/40 focus:ring-1 focus:ring-blue-400/20
                         placeholder-white/20 transition-all"
              id="manual-text-input"
              autoFocus
              onKeyDown={handleKeyDown}
            />

            {/* Character count */}
            <div className="flex items-center justify-between mt-2">
              <p className="text-xs text-white/20">
                {manualText.length} chars · <kbd className="text-[10px] bg-white/5 px-1 rounded">Enter</kbd> to insert
              </p>
              {manualText.length > 0 && (
                <button
                  onClick={() => setManualText('')}
                  className="text-xs text-white/30 hover:text-white/50 transition-colors"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="px-4 py-3 border-t border-white/5 flex items-center gap-2">
            <button
              onClick={() => { if (manualText.trim()) handleInsert(manualText.trim()); }}
              disabled={!manualText.trim()}
              className="btn-success flex items-center gap-1.5 text-sm flex-1 justify-center disabled:opacity-50 disabled:cursor-not-allowed"
              id="manual-insert-button"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Insert into Document
            </button>

            <button
              onClick={handleDiscard}
              className="w-9 h-9 rounded-lg bg-navy-700 border border-white/5 flex items-center justify-center
                         hover:bg-red-500/20 hover:border-red-500/20 transition-all text-white/40 hover:text-red-400"
              title="Close panel (Esc)"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
