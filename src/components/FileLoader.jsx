import React, { useState } from 'react';
import { useDocumentState } from '../hooks/useDocumentState.js';

/**
 * FileLoader — Home screen with file open, URL input, and template quick-open.
 */

const TEMPLATES = [
  {
    id: 'WR-1',
    file: 'WR-1_Initial_Needs_Assessment.docx',
    title: 'Initial Needs Assessment',
    description: '4 sections, 30+ fields — Comprehensive tenant needs assessment covering housing, health, employment, and support requirements.',
    icon: '📋',
    color: 'from-blue-500/20 to-cyan-500/20',
    border: 'border-blue-500/20',
  },
  {
    id: 'WR-10',
    file: 'WR-10_Risk_Assessment_Staff_Only.docx',
    title: 'Risk Assessment (Staff Only)',
    description: 'Dual scoring system — Risk assessment with management plans, severity ratings, and mitigation strategies.',
    icon: '⚠️',
    color: 'from-orange-500/20 to-red-500/20',
    border: 'border-orange-500/20',
  },
  {
    id: 'WR-11',
    file: 'WR-11_Support_Plan.docx',
    title: 'Resident Support Plan',
    description: 'Goals & review dates — Support planning with objectives, actions, contact details, and review schedule.',
    icon: '🎯',
    color: 'from-green-500/20 to-emerald-500/20',
    border: 'border-green-500/20',
  },
  {
    id: 'WR-12',
    file: 'WR-12_Resident_Review_Form.docx',
    title: 'Resident Review Form',
    description: 'Quarterly review — Satisfaction surveys, goals progress tracking, and digital signatures.',
    icon: '📝',
    color: 'from-purple-500/20 to-violet-500/20',
    border: 'border-purple-500/20',
  },
];

export default function FileLoader() {
  const { openFileDialog, loadFromUrl, loadTemplate } = useDocumentState();
  const [url, setUrl] = useState('');
  const [isLoadingUrl, setIsLoadingUrl] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);

  const handleOpenFile = async () => {
    await openFileDialog();
  };

  const handleLoadUrl = async () => {
    if (!url.trim()) return;
    setIsLoadingUrl(true);
    await loadFromUrl(url.trim());
    setIsLoadingUrl(false);
  };

  const handleLoadTemplate = async (template) => {
    await loadTemplate(template.file);
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-4xl mx-auto px-6 py-12">
        {/* Hero Section */}
        <div className="text-center mb-12 animate-fade-in">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-amber-500/20">
            <svg className="w-10 h-10 text-navy-900" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1-9c0-.55.45-1 1-1s1 .45 1 1v6c0 .55-.45 1-1 1s-1-.45-1-1V5z"/>
              <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
            </svg>
          </div>
          <h2 className="text-3xl font-bold text-white mb-3">
            Welcome to <span className="text-amber-400">VoiceDoc AI</span>
          </h2>
          <p className="text-white/50 text-lg max-w-xl mx-auto">
            Open a Word document, click any field, and dictate your notes. 
            AI-powered transcription fills forms in seconds.
          </p>
        </div>

        {/* Action Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-12 animate-slide-up">
          {/* Open from Drive */}
          <button
            onClick={handleOpenFile}
            className="glass-card p-6 text-left hover:border-amber-400/30 transition-all duration-300 group cursor-pointer"
            id="open-file-button"
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-400/20 to-amber-500/10 flex items-center justify-center group-hover:from-amber-400/30 group-hover:to-amber-500/20 transition-colors">
                <svg className="w-6 h-6 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white mb-1">Open from Drive</h3>
                <p className="text-sm text-white/40">
                  Browse your computer to open a <code className="text-amber-400/70 text-xs">.docx</code> file
                </p>
              </div>
            </div>
          </button>

          {/* Load from URL */}
          <div className="glass-card p-6 text-left hover:border-amber-400/30 transition-all duration-300">
            {!showUrlInput ? (
              <button
                onClick={() => setShowUrlInput(true)}
                className="w-full flex items-start gap-4 cursor-pointer"
                id="url-load-button"
              >
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-400/20 to-blue-500/10 flex items-center justify-center">
                  <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white mb-1">Load from URL</h3>
                  <p className="text-sm text-white/40">
                    Paste a direct link to a <code className="text-blue-400/70 text-xs">.docx</code> file
                  </p>
                </div>
              </button>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-blue-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                  <h3 className="text-sm font-semibold text-white">Load from URL</h3>
                </div>
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://example.com/document.docx"
                  className="input-field text-sm"
                  id="url-input"
                  onKeyDown={(e) => e.key === 'Enter' && handleLoadUrl()}
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleLoadUrl}
                    disabled={!url.trim() || isLoadingUrl}
                    className="btn-primary text-sm flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
                    id="url-load-submit"
                  >
                    {isLoadingUrl ? 'Downloading...' : 'Load'}
                  </button>
                  <button
                    onClick={() => { setShowUrlInput(false); setUrl(''); }}
                    className="btn-secondary text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* GDPR Notice */}
        <div className="glass-card p-4 mb-8 border-blue-500/10 animate-fade-in">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="text-xs text-white/50">
                <strong className="text-white/70">Privacy Notice:</strong> Audio is processed via Groq API (EU-compliant endpoint). 
                No data is stored beyond this session unless audit trail is enabled. 
                <a href="https://groq.com/privacy-policy/" target="_blank" rel="noopener noreferrer" className="text-amber-400/70 hover:text-amber-400 ml-1">
                  Groq Privacy Policy →
                </a>
              </p>
            </div>
          </div>
        </div>

        {/* Quick Open Templates */}
        <div className="animate-slide-up">
          <div className="flex items-center gap-2 mb-4">
            <h3 className="text-lg font-semibold text-white/80">Quick Open Templates</h3>
            <span className="text-xs bg-amber-400/10 text-amber-400 px-2 py-0.5 rounded-full">WR Forms</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {TEMPLATES.map((template) => (
              <button
                key={template.id}
                onClick={() => handleLoadTemplate(template)}
                className={`template-card glass-card p-5 text-left cursor-pointer border ${template.border}`}
                id={`template-${template.id}`}
              >
                <div className="flex items-start gap-3">
                  <span className="text-2xl">{template.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-mono text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded">
                        {template.id}
                      </span>
                    </div>
                    <h4 className="text-sm font-semibold text-white mb-1">{template.title}</h4>
                    <p className="text-xs text-white/40 leading-relaxed">{template.description}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
