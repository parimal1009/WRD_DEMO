/**
 * Groq API Service
 * Handles speech-to-text transcription (Whisper) and AI post-processing (LLaMA).
 */

const GROQ_TRANSCRIPTION_URL = 'https://api.groq.com/openai/v1/audio/transcriptions';
const GROQ_CHAT_URL = 'https://api.groq.com/openai/v1/chat/completions';

/**
 * Sleep helper for retry backoff.
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry wrapper with exponential backoff.
 */
async function withRetry(fn, maxRetries = 3) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxRetries) throw error;
      const delay = Math.pow(2, attempt) * 1000 + Math.random() * 500;
      console.warn(`Retry ${attempt + 1}/${maxRetries} after ${Math.round(delay)}ms:`, error.message);
      await sleep(delay);
    }
  }
}

/**
 * Transcribe audio using Groq Whisper API.
 * @param {Blob} audioBlob - The audio blob to transcribe
 * @param {string} language - BCP-47 language code or 'auto'
 * @param {string} apiKey - Groq API key
 * @returns {Promise<string>} Transcribed text
 */
export async function transcribeAudio(audioBlob, language = 'en', apiKey = '') {
  const key = apiKey || import.meta.env.VITE_GROQ_API_KEY;
  if (!key || key === 'your_groq_api_key_here') {
    throw new Error('Groq API key not configured. Please set your API key in Settings.');
  }

  return withRetry(async () => {
    let extension = 'webm';
    if (audioBlob.type.includes('mp4') || audioBlob.type.includes('m4a')) extension = 'mp4';
    else if (audioBlob.type.includes('ogg')) extension = 'ogg';
    else if (audioBlob.type.includes('mpeg')) extension = 'mp3';
    
    const formData = new FormData();
    formData.append('file', audioBlob, `recording.${extension}`);
    formData.append('model', 'whisper-large-v3-turbo');
    if (language && language !== 'auto') {
      formData.append('language', language);
    }
    formData.append('response_format', 'json');
    formData.append('temperature', '0');

    const response = await fetch(GROQ_TRANSCRIPTION_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: { message: response.statusText } }));
      throw new Error(`Groq Whisper error: ${err.error?.message || response.statusText}`);
    }

    const data = await response.json();
    return data.text || '';
  });
}

/**
 * Polish/correct transcribed text using Groq LLM.
 * @param {string} rawText - Raw transcription
 * @param {string} fieldContext - Context of the document field
 * @param {string} targetLanguage - Target language for output
 * @param {string} apiKey - Groq API key
 * @returns {Promise<string>} Polished text
 */
export async function polishTranscript(rawText, fieldContext = '', targetLanguage = 'en', apiKey = '') {
  const key = apiKey || import.meta.env.VITE_GROQ_API_KEY;
  if (!key || key === 'your_groq_api_key_here') {
    throw new Error('Groq API key not configured. Please set your API key in Settings.');
  }

  return withRetry(async () => {
    const systemPrompt = `You are an expert transcription editor for UK social care and housing documentation. 
Your task is to lightly correct grammar, punctuation, and phrasing of transcribed speech so it reads naturally in a formal document.
Do NOT add information. Do NOT remove information. Preserve all factual content exactly.
If the text is in a language other than ${targetLanguage}, translate it to ${targetLanguage}.
Return ONLY the corrected text. No preamble, no explanation.`;

    const userPrompt = `Field context: "${fieldContext}"
Raw transcription: "${rawText}"
Corrected text:`;

    const response = await fetch(GROQ_CHAT_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'mixtral-8x7b-32768',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.2,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: { message: response.statusText } }));
      throw new Error(`Groq LLM error: ${err.error?.message || response.statusText}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content?.trim() || rawText;
  });
}

/**
 * Test the Groq API connection with the given key.
 */
export async function testConnection(apiKey) {
  try {
    const response = await fetch(GROQ_CHAT_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'mixtral-8x7b-32768',
        messages: [{ role: 'user', content: 'Say "connected" and nothing else.' }],
        temperature: 0,
        max_tokens: 10,
      }),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      return { success: false, error: err.error?.message || response.statusText };
    }
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
}
