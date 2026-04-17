import React, { useRef, useEffect, useCallback } from 'react';
import { useAppState } from '../store/AppContext.jsx';

/**
 * DocumentViewer — Renders the parsed DOCX as annotated HTML with clickable fields.
 */
export default function DocumentViewer() {
  const { state, dispatch, ActionTypes } = useAppState();
  const containerRef = useRef(null);
  const { document: doc, activeFieldId, insertions } = state;

  /**
   * Handle click on a document field.
   */
  const handleFieldClick = useCallback((e) => {
    const fieldEl = e.target.closest('[data-field-id]');
    if (!fieldEl) return;

    const fieldId = fieldEl.getAttribute('data-field-id');
    if (fieldId) {
      dispatch({ type: ActionTypes.SET_ACTIVE_FIELD, payload: fieldId });
    }
  }, [dispatch, ActionTypes]);

  /**
   * Update field highlights when active field or insertions change.
   */
  useEffect(() => {
    if (!containerRef.current) return;

    const fields = containerRef.current.querySelectorAll('[data-field-id]');
    fields.forEach((field) => {
      const id = field.getAttribute('data-field-id');
      field.classList.remove('active');
      field.classList.remove('has-content');

      if (id === activeFieldId) {
        field.classList.add('active');
        field.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      if (insertions[id]) {
        field.classList.add('has-content');
      }
    });
  }, [activeFieldId, insertions]);

  /**
   * Inject inserted text as visible overlays in the document.
   */
  useEffect(() => {
    if (!containerRef.current) return;

    // Remove previous insertion markers
    containerRef.current.querySelectorAll('.insertion-text').forEach(el => el.remove());

    // Add insertion text for each field
    Object.entries(insertions).forEach(([fieldId, text]) => {
      const field = containerRef.current.querySelector(`[data-field-id="${fieldId}"]`);
      if (field) {
        const marker = document.createElement('span');
        marker.className = 'insertion-text';
        marker.style.cssText = `
          display: block;
          margin-top: 4px;
          padding: 4px 8px;
          background: rgba(34, 197, 94, 0.08);
          border-left: 3px solid #22C55E;
          border-radius: 0 6px 6px 0;
          font-size: 13px;
          color: #86efac;
          font-family: 'JetBrains Mono', monospace;
          white-space: pre-wrap;
        `;
        marker.textContent = text;
        field.appendChild(marker);
      }
    });
  }, [insertions]);

  if (!doc.isLoaded || !doc.html) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center text-white/30">
          <svg className="w-16 h-16 mx-auto mb-4 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-lg font-medium">No document loaded</p>
          <p className="text-sm mt-1">Open a file to get started</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex-1 overflow-y-auto bg-navy-900 ${state.recording.isRecording ? 'dimmable' : ''}`}>
      <div className="max-w-4xl mx-auto p-6">
        {/* Document Header */}
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/5">
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h2 className="text-sm font-semibold text-white/70">{doc.fileName}</h2>
          </div>
          <div className="text-xs text-white/30">
            Click any field to start recording →
          </div>
        </div>

        {/* Document Content */}
        <div
          ref={containerRef}
          className="document-content"
          onClick={handleFieldClick}
          dangerouslySetInnerHTML={{ __html: doc.html }}
        />
      </div>
    </div>
  );
}
