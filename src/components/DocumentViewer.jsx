import React, { useRef, useEffect, useCallback, useMemo } from 'react';
import { useAppState } from '../store/AppContext.jsx';

/**
 * DocumentViewer — Renders the parsed DOCX as annotated HTML with clickable fields.
 * 
 * KEY DESIGN DECISIONS:
 * 1. Insertions are displayed via CSS ::after pseudo-elements using data-attributes,
 *    NOT via DOM manipulation. This prevents alignment disturbance.
 * 2. Filled fields show edit/remove action buttons on hover.
 * 3. Full keyboard navigation: Enter (confirm/next), Space (skip), Tab, Arrow keys, Escape.
 */
export default function DocumentViewer() {
  const { state, dispatch, ActionTypes, sortedFieldIds, navigateToNextField, navigateToPrevField, notify } = useAppState();
  const containerRef = useRef(null);
  const { document: doc, activeFieldId, insertions } = state;

  /**
   * Get the sorted list of field IDs for keyboard navigation.
   */
  const fieldIds = sortedFieldIds;

  /**
   * Handle removing an insertion from a field.
   */
  const handleRemoveInsertion = useCallback((fieldId) => {
    dispatch({ type: ActionTypes.REMOVE_INSERTION, payload: fieldId });
    notify('Field cleared', 'info');
  }, [dispatch, ActionTypes, notify]);

  /**
   * Handle editing a field (re-select it for new input).
   */
  const handleEditField = useCallback((fieldId) => {
    // Remove the existing insertion so the user starts fresh
    dispatch({ type: ActionTypes.REMOVE_INSERTION, payload: fieldId });
    // Set as active field to open recorder panel
    dispatch({ type: ActionTypes.SET_ACTIVE_FIELD, payload: fieldId });
  }, [dispatch, ActionTypes]);

  const handleFieldClick = useCallback((e) => {
    // Don't trigger field selection if clicking on action buttons
    if (e.target.closest('.field-actions')) return;

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
      field.classList.remove('active', 'has-content');
      field.removeAttribute('data-insertion');
      field.removeAttribute('data-field-status');

      // Remove any previously injected action buttons
      const existingActions = field.querySelector('.field-actions');
      if (existingActions) existingActions.remove();

      // Set active highlight
      if (id === activeFieldId) {
        field.classList.add('active');
        // Smooth scroll to active field
        field.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }

      // If field has insertion content, show it
      const insertion = insertions[id];
      if (insertion) {
        field.classList.add('has-content');
        field.setAttribute('data-field-status', 'filled');

        // Remove any previously injected media
        const existingMedia = field.querySelector('.field-media');
        if (existingMedia) existingMedia.remove();

        // Check if insertion is an image/signature object or plain text
        if (typeof insertion === 'object' && insertion.dataUrl) {
          // Image or signature — inject an img element
          const mediaDiv = document.createElement('div');
          mediaDiv.className = 'field-media';
          const label = insertion.type === 'signature' ? '✍ Signature' : '📷 Photo';
          mediaDiv.innerHTML = `
            <div class="field-media-inner">
              <img src="${insertion.dataUrl}" alt="${label}"
                   style="max-width:${insertion.width || 200}px; max-height:${insertion.height || 150}px;"
                   class="field-media-img" />
              <span class="field-media-label">${label}</span>
            </div>
          `;
          field.appendChild(mediaDiv);
        } else {
          // Plain text — use CSS ::after via data-attribute
          field.setAttribute('data-insertion', insertion);
        }

        // Inject edit/remove action buttons
        const actionsDiv = document.createElement('span');
        actionsDiv.className = 'field-actions';
        actionsDiv.innerHTML = `
          <button class="field-action-btn edit-btn" data-action="edit" data-target-field="${id}" title="Edit this field">
            ✎
          </button>
          <button class="field-action-btn remove-btn" data-action="remove" data-target-field="${id}" title="Remove content">
            ✕
          </button>
        `;
        field.appendChild(actionsDiv);
      } else {
        field.setAttribute('data-field-status', 'empty');
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
          onClick={(e) => {
            // Handle action button clicks
            const actionBtn = e.target.closest('.field-action-btn');
            if (actionBtn) {
              e.stopPropagation();
              const action = actionBtn.getAttribute('data-action');
              const targetField = actionBtn.getAttribute('data-target-field');
              if (action === 'edit') handleEditField(targetField);
              if (action === 'remove') handleRemoveInsertion(targetField);
              return;
            }
            handleFieldClick(e);
          }}
          dangerouslySetInnerHTML={{ __html: doc.html }}
        />
      </div>
    </div>
  );
}
