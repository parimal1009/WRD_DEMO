import React, { createContext, useContext, useReducer, useCallback, useEffect, useState, useMemo } from 'react';

// ─── Initial State ──────────────────────────────────────────────────────────

const initialState = {
  // Document state  
  document: {
    filePath: null,
    fileName: null,
    html: null,
    fieldMap: {},
    originalBuffer: null,
    isLoaded: false,
  },
  
  // Active recording state
  activeFieldId: null,
  
  // Insertions queue: fieldId -> text
  insertions: {},
  
  // Audit trail entries
  auditTrail: [],
  
  // Session info
  session: {
    startTime: new Date().toISOString(),
    tenantName: '',
    docDescription: '',
  },
  
  // Settings
  settings: {
    language: 'en',
    apiKey: '',
    defaultSaveDir: '',
    retainAudio: true,
    aiPostProcessing: true,
    darkMode: true,
  },
  
  // Recording state
  recording: {
    isRecording: false,
    isPaused: false,
    audioBlob: null,
    audioUrl: null,
    duration: 0,
  },
  
  // Transcription state
  transcription: {
    isTranscribing: false,
    isPolishing: false,
    rawText: '',
    polishedText: '',
    error: null,
  },
  
  // UI state
  ui: {
    showRecorder: false,
    showSettings: false,
    showSaveDialog: false,
    showAuditTrail: false,
    notification: null,
    view: 'home', // 'home' | 'document'
  },
};

// ─── Action Types ───────────────────────────────────────────────────────────

const ActionTypes = {
  // Document
  SET_DOCUMENT: 'SET_DOCUMENT',
  CLEAR_DOCUMENT: 'CLEAR_DOCUMENT',
  
  // Field selection
  SET_ACTIVE_FIELD: 'SET_ACTIVE_FIELD',
  CLEAR_ACTIVE_FIELD: 'CLEAR_ACTIVE_FIELD',
  SKIP_FIELD: 'SKIP_FIELD',
  
  // Insertions
  INSERT_TEXT: 'INSERT_TEXT',
  REMOVE_INSERTION: 'REMOVE_INSERTION',
  CLEAR_INSERTIONS: 'CLEAR_INSERTIONS',
  
  // Audit trail
  ADD_AUDIT_ENTRY: 'ADD_AUDIT_ENTRY',
  CLEAR_AUDIT_TRAIL: 'CLEAR_AUDIT_TRAIL',
  
  // Session
  SET_SESSION: 'SET_SESSION',
  
  // Settings
  SET_SETTINGS: 'SET_SETTINGS',
  SET_LANGUAGE: 'SET_LANGUAGE',
  SET_API_KEY: 'SET_API_KEY',
  
  // Recording
  SET_RECORDING: 'SET_RECORDING',
  CLEAR_RECORDING: 'CLEAR_RECORDING',
  
  // Transcription
  SET_TRANSCRIPTION: 'SET_TRANSCRIPTION',
  CLEAR_TRANSCRIPTION: 'CLEAR_TRANSCRIPTION',
  
  // UI
  SET_UI: 'SET_UI',
  SET_VIEW: 'SET_VIEW',
  SHOW_NOTIFICATION: 'SHOW_NOTIFICATION',
  CLEAR_NOTIFICATION: 'CLEAR_NOTIFICATION',
};

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Returns a sorted array of [fieldId, fieldMeta] entries
 * for deterministic field ordering throughout the app.
 */
function getSortedFieldEntries(fieldMap) {
  if (!fieldMap) return [];
  return Object.entries(fieldMap).sort((a, b) => a[1].index - b[1].index);
}

/**
 * Given a fieldMap and current active field, return the next field ID or null.
 */
function getNextFieldId(fieldMap, currentFieldId) {
  const entries = getSortedFieldEntries(fieldMap);
  const keys = entries.map(([id]) => id);
  const currentIndex = keys.indexOf(currentFieldId);
  if (currentIndex >= 0 && currentIndex < keys.length - 1) {
    return keys[currentIndex + 1];
  }
  return null;
}

/**
 * Given a fieldMap and current active field, return the previous field ID or null.
 */
function getPrevFieldId(fieldMap, currentFieldId) {
  const entries = getSortedFieldEntries(fieldMap);
  const keys = entries.map(([id]) => id);
  const currentIndex = keys.indexOf(currentFieldId);
  if (currentIndex > 0) {
    return keys[currentIndex - 1];
  }
  return null;
}

// ─── Reducer ────────────────────────────────────────────────────────────────

function appReducer(state, action) {
  switch (action.type) {
    case ActionTypes.SET_DOCUMENT:
      return {
        ...state,
        document: { ...state.document, ...action.payload, isLoaded: true },
        ui: { ...state.ui, view: 'document' },
        insertions: {},
        auditTrail: [],
        activeFieldId: null,
      };
      
    case ActionTypes.CLEAR_DOCUMENT:
      return {
        ...state,
        document: initialState.document,
        activeFieldId: null,
        insertions: {},
        auditTrail: [],
        recording: initialState.recording,
        transcription: initialState.transcription,
        ui: { ...state.ui, view: 'home', showRecorder: false },
      };
      
    case ActionTypes.SET_ACTIVE_FIELD:
      return {
        ...state,
        activeFieldId: action.payload,
        ui: { ...state.ui, showRecorder: true },
        // Reset recording and transcription state when switching fields
        recording: initialState.recording,
        transcription: initialState.transcription,
      };
      
    case ActionTypes.CLEAR_ACTIVE_FIELD:
      return {
        ...state,
        activeFieldId: null,
        ui: { ...state.ui, showRecorder: false },
      };

    case ActionTypes.SKIP_FIELD: {
      // Skip current field and advance to next
      const nextId = getNextFieldId(state.document.fieldMap, state.activeFieldId);
      if (nextId) {
        return {
          ...state,
          activeFieldId: nextId,
          ui: { ...state.ui, showRecorder: true },
          recording: initialState.recording,
          transcription: initialState.transcription,
        };
      }
      // No more fields — deselect
      return {
        ...state,
        activeFieldId: null,
        ui: { ...state.ui, showRecorder: false },
      };
    }
      
    case ActionTypes.INSERT_TEXT:
      return {
        ...state,
        insertions: { ...state.insertions, [action.payload.fieldId]: action.payload.text },
      };
      
    case ActionTypes.REMOVE_INSERTION: {
      const { [action.payload]: _, ...remaining } = state.insertions;
      return { ...state, insertions: remaining };
    }
      
    case ActionTypes.CLEAR_INSERTIONS:
      return { ...state, insertions: {} };
      
    case ActionTypes.ADD_AUDIT_ENTRY:
      return {
        ...state,
        auditTrail: [...state.auditTrail, { ...action.payload, timestamp: new Date().toISOString() }],
      };
      
    case ActionTypes.CLEAR_AUDIT_TRAIL:
      return { ...state, auditTrail: [] };
      
    case ActionTypes.SET_SESSION:
      return { ...state, session: { ...state.session, ...action.payload } };
      
    case ActionTypes.SET_SETTINGS:
      return { ...state, settings: { ...state.settings, ...action.payload } };
      
    case ActionTypes.SET_LANGUAGE:
      return { ...state, settings: { ...state.settings, language: action.payload } };
      
    case ActionTypes.SET_API_KEY:
      return { ...state, settings: { ...state.settings, apiKey: action.payload } };
      
    case ActionTypes.SET_RECORDING:
      return { ...state, recording: { ...state.recording, ...action.payload } };
      
    case ActionTypes.CLEAR_RECORDING:
      if (state.recording.audioUrl) {
        URL.revokeObjectURL(state.recording.audioUrl);
      }
      return { ...state, recording: initialState.recording };
      
    case ActionTypes.SET_TRANSCRIPTION:
      return { ...state, transcription: { ...state.transcription, ...action.payload } };
      
    case ActionTypes.CLEAR_TRANSCRIPTION:
      return { ...state, transcription: initialState.transcription };
      
    case ActionTypes.SET_UI:
      return { ...state, ui: { ...state.ui, ...action.payload } };
      
    case ActionTypes.SET_VIEW:
      return { ...state, ui: { ...state.ui, view: action.payload } };
      
    case ActionTypes.SHOW_NOTIFICATION:
      return { ...state, ui: { ...state.ui, notification: action.payload } };
      
    case ActionTypes.CLEAR_NOTIFICATION:
      return { ...state, ui: { ...state.ui, notification: null } };
      
    default:
      return state;
  }
}

// ─── Context ────────────────────────────────────────────────────────────────

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(appReducer, initialState);
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  // Precompute sorted field list once whenever fieldMap changes
  const sortedFieldIds = useMemo(() => {
    return getSortedFieldEntries(state.document.fieldMap).map(([id]) => id);
  }, [state.document.fieldMap]);

  // Load settings on mount
  useEffect(() => {
    async function loadSettings() {
      try {
        if (window.electronAPI) {
          const apiKey = await window.electronAPI.loadSecureSetting('groq_api_key');
          const savedSettings = await window.electronAPI.loadSetting('app_settings');
          
          if (apiKey) {
            dispatch({ type: ActionTypes.SET_API_KEY, payload: apiKey });
          }
          if (savedSettings) {
            dispatch({ type: ActionTypes.SET_SETTINGS, payload: savedSettings });
            // Restore the API key separately since it's stored securely
            if (apiKey) {
              dispatch({ type: ActionTypes.SET_API_KEY, payload: apiKey });
            }
          }
        }
      } catch (e) {
        console.warn('Failed to load settings:', e);
      }
      setSettingsLoaded(true);
    }
    loadSettings();
  }, []);

  // Auto-clear notifications
  useEffect(() => {
    if (state.ui.notification) {
      const timer = setTimeout(() => {
        dispatch({ type: ActionTypes.CLEAR_NOTIFICATION });
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [state.ui.notification]);

  const notify = useCallback((message, type = 'info') => {
    dispatch({ type: ActionTypes.SHOW_NOTIFICATION, payload: { message, type } });
  }, []);

  // Navigation helpers exposed via context
  const navigateToNextField = useCallback(() => {
    const nextId = getNextFieldId(state.document.fieldMap, state.activeFieldId);
    if (nextId) {
      dispatch({ type: ActionTypes.SET_ACTIVE_FIELD, payload: nextId });
      return nextId;
    }
    dispatch({ type: ActionTypes.CLEAR_ACTIVE_FIELD });
    return null;
  }, [state.document.fieldMap, state.activeFieldId]);

  const navigateToPrevField = useCallback(() => {
    const prevId = getPrevFieldId(state.document.fieldMap, state.activeFieldId);
    if (prevId) {
      dispatch({ type: ActionTypes.SET_ACTIVE_FIELD, payload: prevId });
      return prevId;
    }
    return null;
  }, [state.document.fieldMap, state.activeFieldId]);

  return (
    <AppContext.Provider value={{
      state,
      dispatch,
      ActionTypes,
      notify,
      settingsLoaded,
      sortedFieldIds,
      navigateToNextField,
      navigateToPrevField,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppState() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppState must be used within an AppProvider');
  }
  return context;
}

export { ActionTypes };
export default AppContext;
