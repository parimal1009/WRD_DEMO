import React, { useState } from 'react';
import { AppProvider, useAppState } from './store/AppContext.jsx';
import TopBar from './components/TopBar.jsx';
import FileLoader from './components/FileLoader.jsx';
import DocumentViewer from './components/DocumentViewer.jsx';
import VoiceRecorder from './components/VoiceRecorder.jsx';
import AuditTrail from './components/AuditTrail.jsx';
import SaveDialog from './components/SaveDialog.jsx';
import SettingsModal from './components/SettingsModal.jsx';

/**
 * Notification Toast
 */
function Notification() {
  const { state } = useAppState();
  const { notification } = state.ui;

  if (!notification) return null;

  const colors = {
    success: 'border-green-500/30 bg-green-500/10 text-green-400',
    error: 'border-red-500/30 bg-red-500/10 text-red-400',
    warning: 'border-amber-500/30 bg-amber-500/10 text-amber-400',
    info: 'border-blue-500/30 bg-blue-500/10 text-blue-400',
  };

  const icons = {
    success: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
    ),
    error: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
    ),
    warning: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    ),
    info: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  };

  return (
    <div className="fixed top-16 right-4 z-[100] animate-slide-up max-w-sm">
      <div className={`glass-card border px-4 py-3 flex items-center gap-3 shadow-xl ${colors[notification.type] || colors.info}`}>
        {icons[notification.type] || icons.info}
        <p className="text-sm font-medium">{notification.message}</p>
      </div>
    </div>
  );
}

/**
 * AppContent — Main application layout with routing based on view state.
 */
function AppContent() {
  const { state, dispatch, ActionTypes } = useAppState();
  const [showSettings, setShowSettings] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);

  const { view } = state.ui;
  const isRecording = state.recording?.isRecording || false;

  const handleHome = () => {
    dispatch({ type: ActionTypes.SET_VIEW, payload: 'home' });
  };

  return (
    <div className={`h-screen flex flex-col overflow-hidden ${isRecording ? 'recording-active' : ''}`}>
      {/* Top Bar */}
      <TopBar
        onSave={() => setShowSaveDialog(true)}
        onSettings={() => setShowSettings(true)}
        onHome={handleHome}
      />

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {view === 'home' ? (
          <FileLoader />
        ) : (
          <>
            {/* Document Viewer */}
            <DocumentViewer />

            {/* Voice Recorder Panel (docked right) */}
            <VoiceRecorder />
          </>
        )}
      </div>

      {/* Audit Trail (collapsible footer) */}
      {view === 'document' && <AuditTrail />}

      {/* Modals */}
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
      {showSaveDialog && <SaveDialog onClose={() => setShowSaveDialog(false)} />}

      {/* Notification Toast */}
      <Notification />
    </div>
  );
}

/**
 * App — Root component wrapping everything in the AppProvider.
 */
export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
