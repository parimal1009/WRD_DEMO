import { useState, useCallback } from 'react';
import { transcribeAudio, polishTranscript } from '../services/groqService.js';
import { useAppState } from '../store/AppContext.jsx';

/**
 * Custom hook for Groq transcription and AI post-processing.
 */
export function useGroqTranscription() {
  const { state, dispatch, ActionTypes, notify } = useAppState();
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isPolishing, setIsPolishing] = useState(false);
  const [rawText, setRawText] = useState('');
  const [polishedText, setPolishedText] = useState('');
  const [error, setError] = useState(null);

  const transcribe = useCallback(async (audioBlob, language = null) => {
    const lang = language || state.settings.language;
    const apiKey = state.settings.apiKey;

    setIsTranscribing(true);
    setError(null);
    setRawText('');
    setPolishedText('');

    try {
      // Step 1: Transcribe audio
      const raw = await transcribeAudio(audioBlob, lang, apiKey);
      setRawText(raw);

      if (!raw || raw.trim().length === 0) {
        setError('No speech detected. Please try again.');
        setIsTranscribing(false);
        return { rawText: '', polishedText: '' };
      }

      // Step 2: Polish with AI (if enabled)
      let polished = raw;
      if (state.settings.aiPostProcessing) {
        setIsTranscribing(false);
        setIsPolishing(true);

        const fieldId = state.activeFieldId;
        const fieldInfo = state.document.fieldMap?.[fieldId];
        const fieldContext = fieldInfo?.label || 'Document field';

        try {
          polished = await polishTranscript(raw, fieldContext, 'en', apiKey);
        } catch (polishErr) {
          console.warn('AI polish failed, using raw text:', polishErr);
          notify('AI post-processing failed. Using raw transcription.', 'warning');
          polished = raw;
        }
      }

      setPolishedText(polished);
      setIsPolishing(false);
      setIsTranscribing(false);

      return { rawText: raw, polishedText: polished };
    } catch (err) {
      console.error('Transcription error:', err);
      setError(err.message);
      setIsTranscribing(false);
      setIsPolishing(false);
      notify(err.message, 'error');
      return { rawText: '', polishedText: '', error: err.message };
    }
  }, [state.settings.language, state.settings.apiKey, state.settings.aiPostProcessing, state.activeFieldId, state.document.fieldMap, notify]);

  const reset = useCallback(() => {
    setIsTranscribing(false);
    setIsPolishing(false);
    setRawText('');
    setPolishedText('');
    setError(null);
  }, []);

  const updatePolishedText = useCallback((text) => {
    setPolishedText(text);
  }, []);

  return {
    isTranscribing,
    isPolishing,
    rawText,
    polishedText,
    error,
    transcribe,
    reset,
    updatePolishedText,
  };
}
