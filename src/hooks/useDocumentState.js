import { useCallback } from 'react';
import { useAppState } from '../store/AppContext.jsx';
import { parseDocx, base64ToArrayBuffer } from '../services/docxParser.js';

/**
 * Custom hook for managing document state and operations.
 */
export function useDocumentState() {
  const { state, dispatch, ActionTypes, notify } = useAppState();

  /**
   * Load a .docx file from the filesystem via Electron IPC.
   */
  const loadFromPath = useCallback(async (filePath) => {
    try {
      if (!window.electronAPI) {
        throw new Error('Electron API not available. Are you running in Electron?');
      }

      const base64 = await window.electronAPI.readFile(filePath);
      const arrayBuffer = base64ToArrayBuffer(base64);
      const { html, fieldMap } = await parseDocx(arrayBuffer);

      const fileName = filePath.replace(/\\/g, '/').split('/').pop();

      dispatch({
        type: ActionTypes.SET_DOCUMENT,
        payload: {
          filePath,
          fileName,
          html,
          fieldMap,
          originalBuffer: arrayBuffer,
        },
      });

      dispatch({
        type: ActionTypes.SET_SESSION,
        payload: {
          docDescription: fileName.replace(/\.docx$/i, '').replace(/[_-]/g, ' '),
        },
      });

      notify(`Loaded: ${fileName}`, 'success');
      return true;
    } catch (err) {
      console.error('Failed to load document:', err);
      notify(`Failed to load document: ${err.message}`, 'error');
      return false;
    }
  }, [dispatch, ActionTypes, notify]);

  /**
   * Open file dialog and load selected document.
   */
  const openFileDialog = useCallback(async () => {
    try {
      if (!window.electronAPI) {
        notify('Electron API not available', 'error');
        return false;
      }

      const filePath = await window.electronAPI.openFile();
      if (!filePath) return false;

      return await loadFromPath(filePath);
    } catch (err) {
      console.error('Open file dialog error:', err);
      notify(`Error: ${err.message}`, 'error');
      return false;
    }
  }, [loadFromPath, notify]);

  /**
   * Load a .docx from a URL (download then parse).
   */
  const loadFromUrl = useCallback(async (url) => {
    try {
      if (!window.electronAPI) {
        throw new Error('Electron API not available');
      }

      notify('Downloading document...', 'info');
      const tempPath = await window.electronAPI.downloadFile(url);
      return await loadFromPath(tempPath);
    } catch (err) {
      console.error('Load from URL error:', err);
      notify(`Failed to download: ${err.message}`, 'error');
      return false;
    }
  }, [loadFromPath, notify]);

  /**
   * Load a bundled template form.
   */
  const loadTemplate = useCallback(async (templateName) => {
    try {
      // In dev, fetch from public/forms/
      // In production, templates would be in resources/forms/
      const response = await fetch(`/forms/${templateName}`);
      if (!response.ok) throw new Error(`Template not found: ${templateName}`);
      
      const arrayBuffer = await response.arrayBuffer();
      const { html, fieldMap } = await parseDocx(arrayBuffer);

      dispatch({
        type: ActionTypes.SET_DOCUMENT,
        payload: {
          filePath: null,
          fileName: templateName,
          html,
          fieldMap,
          originalBuffer: arrayBuffer,
        },
      });

      dispatch({
        type: ActionTypes.SET_SESSION,
        payload: {
          docDescription: templateName.replace(/\.docx$/i, '').replace(/[_-]/g, ' '),
        },
      });

      notify(`Template loaded: ${templateName}`, 'success');
      return true;
    } catch (err) {
      console.error('Template load error:', err);
      notify(`Failed to load template: ${err.message}`, 'error');
      return false;
    }
  }, [dispatch, ActionTypes, notify]);

  /**
   * Select a field for recording.
   */
  const selectField = useCallback((fieldId) => {
    dispatch({ type: ActionTypes.SET_ACTIVE_FIELD, payload: fieldId });
  }, [dispatch, ActionTypes]);

  /**
   * Clear field selection.
   */
  const clearFieldSelection = useCallback(() => {
    dispatch({ type: ActionTypes.CLEAR_ACTIVE_FIELD });
  }, [dispatch, ActionTypes]);

  /**
   * Insert text at the active field.
   */
  const insertText = useCallback((fieldId, text) => {
    dispatch({
      type: ActionTypes.INSERT_TEXT,
      payload: { fieldId, text },
    });
    notify('Text inserted into document', 'success');
  }, [dispatch, ActionTypes, notify]);

  /**
   * Close the document and return to home.
   */
  const closeDocument = useCallback(() => {
    dispatch({ type: ActionTypes.CLEAR_DOCUMENT });
  }, [dispatch, ActionTypes]);

  return {
    document: state.document,
    activeFieldId: state.activeFieldId,
    insertions: state.insertions,
    loadFromPath,
    openFileDialog,
    loadFromUrl,
    loadTemplate,
    selectField,
    clearFieldSelection,
    insertText,
    closeDocument,
  };
}
