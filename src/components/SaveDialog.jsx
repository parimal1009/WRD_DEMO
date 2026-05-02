import React, { useState, useMemo } from 'react';
import { useAppState } from '../store/AppContext.jsx';
import { generateFilename, extractDocDescription } from '../utils/fileNaming.js';
import { insertTextIntoDocx } from '../services/docxWriter.js';

/**
 * SaveDialog — Auto-generates filename with tenant name and doc description.
 */
export default function SaveDialog({ onClose }) {
  const { state, dispatch, ActionTypes, notify } = useAppState();
  const { document: doc, insertions, session, auditTrail } = state;

  const [tenantName, setTenantName] = useState(session.tenantName || '');
  const [docDescription, setDocDescription] = useState(
    session.docDescription || extractDocDescription(doc.fileName)
  );
  const [isSaving, setIsSaving] = useState(false);
  const [appendMode, setAppendMode] = useState(false);

  // Detect if this document type supports appending (e.g., support notes)
  const isAppendable = useMemo(() => {
    const name = (doc.fileName || '').toLowerCase();
    return name.includes('support') || name.includes('note') || name.includes('log') || name.includes('journal');
  }, [doc.fileName]);

  const previewFilename = useMemo(() => {
    return generateFilename(tenantName || 'Tenant', docDescription || 'Document');
  }, [tenantName, docDescription]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      if (!window.electronAPI) {
        throw new Error('Electron API not available');
      }

      // Build the modified document
      let base64Data;
      if (doc.originalBuffer && Object.keys(insertions).length > 0) {
        base64Data = await insertTextIntoDocx(
          doc.originalBuffer,
          insertions,
          doc.fieldMap
        );
      } else if (doc.originalBuffer) {
        // No insertions, save original
        const bytes = new Uint8Array(doc.originalBuffer);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        base64Data = btoa(binary);
      } else {
        throw new Error('No document data available');
      }

      const filename = generateFilename(tenantName, docDescription);
      const savePath = await window.electronAPI.saveFile(filename);

      if (!savePath) {
        setIsSaving(false);
        return; // User cancelled
      }

      await window.electronAPI.writeFile(savePath, base64Data);

      // Save audit trail alongside
      if (auditTrail.length > 0) {
        const auditPath = savePath.replace(/\.docx$/i, '_audit.json');
        const auditData = auditTrail.map(entry => ({
          ...entry,
          audioBlob: undefined, // Don't serialize blobs
          audioUrl: undefined,
        }));
        const auditBase64 = btoa(unescape(encodeURIComponent(JSON.stringify(auditData, null, 2))));
        await window.electronAPI.writeFile(auditPath, auditBase64);
      }

      // Update session
      dispatch({
        type: ActionTypes.SET_SESSION,
        payload: { tenantName, docDescription },
      });

      notify(`Document saved: ${filename}`, 'success');
      onClose();
    } catch (err) {
      console.error('Save error:', err);
      notify(`Failed to save: ${err.message}`, 'error');
    }
    setIsSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
      <div className="glass-card w-full max-w-lg mx-4 p-0 shadow-2xl">
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Save Document</h2>
          <button onClick={onClose} className="text-white/30 hover:text-white/60 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-white/60 mb-1.5">Tenant / Client Name</label>
            <input
              type="text"
              value={tenantName}
              onChange={(e) => setTenantName(e.target.value)}
              placeholder="e.g. John Smith"
              className="input-field"
              id="tenant-name-input"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white/60 mb-1.5">Document Description</label>
            <input
              type="text"
              value={docDescription}
              onChange={(e) => setDocDescription(e.target.value)}
              placeholder="e.g. Initial Needs Assessment"
              className="input-field"
              id="doc-description-input"
            />
          </div>

          {/* Filename Preview */}
          <div className="bg-navy-800/50 rounded-lg p-3 border border-white/5">
            <p className="text-xs text-white/30 mb-1">Generated Filename:</p>
            <p className="text-sm font-mono text-amber-400 break-all">{previewFilename}</p>
          </div>

          {/* Append Mode Toggle (only for appendable docs) */}
          {isAppendable && (
            <div className="bg-purple-500/5 border border-purple-500/10 rounded-lg p-3">
              <label className="flex items-center justify-between cursor-pointer">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  <div>
                    <p className="text-sm font-medium text-white/70">Append Mode</p>
                    <p className="text-xs text-white/30">Add to existing document instead of creating new</p>
                  </div>
                </div>
                <div
                  onClick={() => setAppendMode(!appendMode)}
                  className={`w-10 h-5 rounded-full transition-colors duration-200 flex items-center px-0.5 cursor-pointer ${
                    appendMode ? 'bg-purple-500' : 'bg-navy-600'
                  }`}
                >
                  <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${
                    appendMode ? 'translate-x-5' : 'translate-x-0'
                  }`} />
                </div>
              </label>
            </div>
          )}

          {/* Stats */}
          <div className="flex items-center gap-4 text-xs text-white/30">
            <span>{Object.keys(insertions).length} fields filled</span>
            <span>•</span>
            <span>{auditTrail.length} recordings made</span>
            {appendMode && <><span>•</span><span className="text-purple-400">Append mode</span></>}
          </div>
        </div>

        {/* Actions */}
        <div className="px-6 py-4 border-t border-white/5 flex justify-end gap-3">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="btn-primary flex items-center gap-2 disabled:opacity-50"
            id="save-confirm-button"
          >
            {isSaving ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                Saving...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                </svg>
                Save to Drive
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
