import React, { useState, useRef } from 'react';
import { useAppState } from '../store/AppContext.jsx';

/**
 * AuditTrail — Collapsible footer listing all recordings made this session.
 */
export default function AuditTrail() {
  const { state, notify } = useAppState();
  const { auditTrail } = state;
  const [isExpanded, setIsExpanded] = useState(false);
  const [playingIndex, setPlayingIndex] = useState(null);
  const audioRef = useRef(null);

  if (auditTrail.length === 0) return null;

  const handlePlay = (entry, index) => {
    if (!entry.audioUrl) {
      notify('No audio retained for this recording', 'warning');
      return;
    }
    if (playingIndex === index) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      setPlayingIndex(null);
      return;
    }
    setPlayingIndex(index);
  };

  const handleExportAudit = async () => {
    try {
      if (!window.electronAPI) {
        notify('Electron API not available', 'error');
        return;
      }

      const auditData = auditTrail.map(entry => ({
        fieldId: entry.fieldId,
        fieldLabel: entry.fieldLabel,
        language: entry.language,
        rawText: entry.rawText,
        polishedText: entry.polishedText,
        timestamp: entry.timestamp,
        inputMode: entry.inputMode || 'voice',
      }));

      const jsonStr = JSON.stringify(auditData, null, 2);
      const base64 = btoa(unescape(encodeURIComponent(jsonStr)));
      
      const savePath = await window.electronAPI.saveFile('audit_trail.json');
      if (savePath) {
        const finalPath = savePath.endsWith('.json') ? savePath : savePath.replace(/\.\w+$/, '.json');
        await window.electronAPI.writeFile(finalPath, base64);
        notify('Audit trail exported', 'success');
      }
    } catch (err) {
      console.error('Export audit error:', err);
      notify(`Export failed: ${err.message}`, 'error');
    }
  };

  const formatTime = (isoString) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
      return '--:--:--';
    }
  };

  return (
    <div className={`border-t border-white/5 bg-navy-950 transition-all duration-300 ${isExpanded ? 'max-h-80' : 'max-h-10'}`}>
      {/* Toggle Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full h-10 px-4 flex items-center justify-between hover:bg-navy-900/50 transition-colors"
        id="audit-trail-toggle"
      >
        <div className="flex items-center gap-2">
          <svg
            className={`w-3 h-3 text-white/40 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
          </svg>
          <span className="text-xs font-medium text-white/50">Audit Trail</span>
          <span className="text-xs bg-amber-400/10 text-amber-400 px-1.5 py-0.5 rounded-full font-mono">
            {auditTrail.length}
          </span>
        </div>
        {isExpanded && (
          <button
            onClick={(e) => { e.stopPropagation(); handleExportAudit(); }}
            className="text-xs text-amber-400/60 hover:text-amber-400 flex items-center gap-1 transition-colors"
            id="export-audit-button"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Export JSON
          </button>
        )}
      </button>

      {/* Entries List */}
      {isExpanded && (
        <div className="overflow-y-auto max-h-[270px] px-2 pb-2">
          <div className="space-y-1">
            {auditTrail.map((entry, index) => (
              <div
                key={`${entry.fieldId}-${entry.timestamp}-${index}`}
                className="glass-card p-3 text-xs animate-fade-in"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-amber-400 font-mono text-[11px] bg-amber-400/10 px-1.5 py-0.5 rounded">
                        {entry.fieldLabel?.slice(0, 30) || entry.fieldId}
                      </span>
                      <span className="text-white/20">•</span>
                      <span className="text-white/30">
                        {formatTime(entry.timestamp)}
                      </span>
                      <span className="text-white/20">•</span>
                      <span className={`text-[10px] px-1 py-0.5 rounded ${
                        entry.inputMode === 'type' 
                          ? 'text-blue-400 bg-blue-400/10' 
                          : 'text-amber-400 bg-amber-400/10'
                      }`}>
                        {entry.inputMode === 'type' ? '⌨ typed' : '🎙 voice'}
                      </span>
                    </div>
                    <p className="text-white/50 truncate font-mono leading-relaxed">
                      {entry.polishedText || entry.rawText || 'No text'}
                    </p>
                  </div>

                  {/* Playback */}
                  {entry.audioUrl && (
                    <button
                      onClick={() => handlePlay(entry, index)}
                      className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-all
                        ${playingIndex === index
                          ? 'bg-amber-400 text-navy-900'
                          : 'bg-navy-700 text-white/40 hover:text-white/70 hover:bg-navy-600'
                        }`}
                      title={playingIndex === index ? 'Stop' : 'Play'}
                    >
                      {playingIndex === index ? (
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M6 6h12v12H6z"/>
                        </svg>
                      ) : (
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M8 5v14l11-7z"/>
                        </svg>
                      )}
                    </button>
                  )}
                </div>

                {/* Audio player (hidden but functional) */}
                {playingIndex === index && entry.audioUrl && (
                  <div className="mt-2">
                    <audio
                      ref={audioRef}
                      src={entry.audioUrl}
                      controls
                      autoPlay
                      onEnded={() => setPlayingIndex(null)}
                      className="w-full h-7 opacity-60"
                      style={{ filter: 'invert(1)' }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
