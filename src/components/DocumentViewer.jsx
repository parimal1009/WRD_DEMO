import React, { useRef, useEffect, useCallback, useMemo } from 'react';
import { useAppState } from '../store/AppContext.jsx';

/**
 * DocumentViewer — Renders the parsed DOCX as annotated HTML with clickable fields.
 * 
 * KEY DESIGN DECISIONS:
 * 1. Insertions are displayed via CSS ::after pseudo-elements using data-attributes,
 *    NOT via DOM manipulation. This prevents alignment disturbance.
 * 2. "Click to fill" placeholders only appear on truly empty, unfilled fields.
 * 3. Full keyboard navigation: Enter (confirm/next), Space (skip), Tab, Arrow keys, Escape.
 */
export default function DocumentViewer() {
  const { state, dispatch, ActionTypes, sortedFieldIds, navigateToNextField, navigateToPrevField } = useAppState();
  const containerRef = useRef(null);
  const { document: doc, activeFieldId, insertions } = state;

  /**
   * Get the sorted list of field IDs for keyboard navigation.
   */
  const fieldIds = sortedFieldIds;

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
   * Handle keyboard navigation within the document.
   */
  const handleKeyDown = useCallback((e) => {
    if (!doc.isLoaded) return;
    
    // Only handle keyboard when no modal/textarea is focused
    const activeElement = document.activeElement;
    const isInputFocused = activeElement && (
      activeElement.tagName === 'INPUT' ||
      activeElement.tagName === 'TEXTAREA' ||
      activeElement.tagName === 'SELECT' ||
      activeElement.isContentEditable
    );
    if (isInputFocused) return;

    switch (e.key) {
      case 'Enter': {
        e.preventDefault();
        if (!activeFieldId) {
          // If no field is active, select the first unfilled field
          const firstUnfilled = fieldIds.find(id => !insertions[id]);
          if (firstUnfilled) {
            dispatch({ type: ActionTypes.SET_ACTIVE_FIELD, payload: firstUnfilled });
          }
        } else {
          // Enter on an active field: if it has content, advance to next
          if (insertions[activeFieldId]) {
            navigateToNextField();
          }
        }
        break;
      }
      case ' ': {
        // Space: skip current field without filling, advance to next
        e.preventDefault();
        if (activeFieldId) {
          dispatch({ type: ActionTypes.SKIP_FIELD });
        }
        break;
      }
      case 'Tab': {
        e.preventDefault();
        if (e.shiftKey) {
          navigateToPrevField();
        } else {
          navigateToNextField();
        }
        break;
      }
      case 'ArrowDown':
      case 'ArrowRight': {
        if (activeFieldId) {
          e.preventDefault();
          navigateToNextField();
        }
        break;
      }
      case 'ArrowUp':
      case 'ArrowLeft': {
        if (activeFieldId) {
          e.preventDefault();
          navigateToPrevField();
        }
        break;
      }
      case 'Escape': {
        if (activeFieldId) {
          e.preventDefault();
          dispatch({ type: ActionTypes.CLEAR_ACTIVE_FIELD });
        }
        break;
      }
      default:
        break;
    }
  }, [doc.isLoaded, activeFieldId, fieldIds, insertions, dispatch, ActionTypes, navigateToNextField, navigateToPrevField]);

  /**
   * Attach keyboard listener at document level.
   */
  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  /**
   * Update field visual states (active, has-content, insertion data) via class + data-attribute.
   * No DOM insertion of child elements — purely CSS-driven display.
   */
  useEffect(() => {
    if (!containerRef.current) return;

    const fields = containerRef.current.querySelectorAll('[data-field-id]');
    fields.forEach((field) => {
      const id = field.getAttribute('data-field-id');
      
      // Clear all state classes
      field.classList.remove('active', 'has-content', 'field-empty');
      field.removeAttribute('data-insertion');
      field.removeAttribute('data-field-status');

      // Set active highlight
      if (id === activeFieldId) {
        field.classList.add('active');
        // Smooth scroll to active field
        field.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }

      // If field has insertion content, show it via data-attribute + CSS
      if (insertions[id]) {
        field.classList.add('has-content');
        field.setAttribute('data-insertion', insertions[id]);
        field.setAttribute('data-field-status', 'filled');
      } else {
        // Mark as empty only if not active (prevent "Click to fill" showing while recording)
        if (id !== activeFieldId) {
          field.classList.add('field-empty');
          field.setAttribute('data-field-status', 'empty');
        }
      }
    });
  }, [activeFieldId, insertions]);

  /**
   * Field progress counter.
   */
  const fieldProgress = useMemo(() => {
    const total = fieldIds.length;
    const filled = Object.keys(insertions).length;
    return { total, filled, percentage: total > 0 ? Math.round((filled / total) * 100) : 0 };
  }, [fieldIds, insertions]);

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
          <div className="flex items-center gap-3">
            {/* Progress indicator */}
            <div className="flex items-center gap-2">
              <div className="w-24 h-1.5 bg-navy-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-amber-400 to-green-400 rounded-full transition-all duration-500"
                  style={{ width: `${fieldProgress.percentage}%` }}
                />
              </div>
              <span className="text-xs text-white/40 font-mono">
                {fieldProgress.filled}/{fieldProgress.total}
              </span>
            </div>
            {/* Keyboard hint */}
            <div className="hidden lg:flex items-center gap-1.5 text-[10px] text-white/25">
              <kbd className="px-1.5 py-0.5 bg-navy-700 rounded border border-white/10 font-mono">Enter</kbd>
              <span>next</span>
              <kbd className="px-1.5 py-0.5 bg-navy-700 rounded border border-white/10 font-mono ml-1">Space</kbd>
              <span>skip</span>
              <kbd className="px-1.5 py-0.5 bg-navy-700 rounded border border-white/10 font-mono ml-1">Esc</kbd>
              <span>deselect</span>
            </div>
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
