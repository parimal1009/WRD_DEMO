import { useState, useRef, useCallback, useEffect } from 'react';

/**
 * Custom hook for audio recording using MediaRecorder API.
 * Provides recording controls, waveform data, and audio blob output.
 */
export function useAudioRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState(null);
  const [waveformData, setWaveformData] = useState(new Array(32).fill(4));
  
  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const analyserRef = useRef(null);
  const animationRef = useRef(null);
  const audioContextRef = useRef(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopAnimationLoop();
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, []);

  const startAnimationLoop = useCallback(() => {
    const analyser = analyserRef.current;
    if (!analyser) return;
    
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    
    const animate = () => {
      analyser.getByteFrequencyData(dataArray);
      
      // Sample 32 bars from the frequency data
      const bars = [];
      const step = Math.floor(dataArray.length / 32);
      for (let i = 0; i < 32; i++) {
        const value = dataArray[i * step];
        bars.push(Math.max(4, (value / 255) * 40));
      }
      setWaveformData(bars);
      animationRef.current = requestAnimationFrame(animate);
    };
    
    animate();
  }, []);

  const stopAnimationLoop = useCallback(() => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    setWaveformData(new Array(32).fill(4));
  }, []);

  const startRecording = useCallback(async () => {
    try {
      setError(null);
      setAudioBlob(null);
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
        setAudioUrl(null);
      }
      setDuration(0);
      chunksRef.current = [];
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
        } 
      });
      streamRef.current = stream;

      // Set up audio analyser for waveform
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      audioContextRef.current = audioContext;
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      // Determine supported mime types
      let mimeType = '';
      const types = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4',
        'audio/mpeg',
        'audio/ogg;codecs=opus',
        'audio/x-m4a'
      ];
      for (const t of types) {
        if (MediaRecorder.isTypeSupported(t)) {
          mimeType = t;
          break;
        }
      }

      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : {});
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const actualMimeType = mimeType || (recorder.mimeType !== "" ? recorder.mimeType : 'audio/webm');
        const blob = new Blob(chunksRef.current, { type: actualMimeType });
        setAudioBlob(blob);
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        
        // Ensure UI resets flawlessly in strict auto-stoppers (iOS native Safari etc)
        setIsRecording(false);
        setIsPaused(false);
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }

        // Clean up stream
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(t => t.stop());
          streamRef.current = null;
        }
        
        stopAnimationLoop();
        
        if (audioContextRef.current) {
          audioContextRef.current.close();
          audioContextRef.current = null;
        }
      };

      // Start recording natively without timeslicing for cross-browser WebKit support
      recorder.start(); 
      setIsRecording(true);
      setIsPaused(false);

      // Start duration timer
      const startTime = Date.now();
      timerRef.current = setInterval(() => {
        setDuration(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);

      // Start waveform animation
      startAnimationLoop();
    } catch (err) {
      console.error('Recording error:', err);
      setError(err.message || 'Microphone access denied');
    }
  }, [audioUrl, startAnimationLoop, stopAnimationLoop]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    setIsPaused(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
      stopAnimationLoop();
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  }, [stopAnimationLoop]);

  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
      startAnimationLoop();
      
      const currentDuration = duration;
      const resumeTime = Date.now();
      timerRef.current = setInterval(() => {
        setDuration(currentDuration + Math.floor((Date.now() - resumeTime) / 1000));
      }, 1000);
    }
  }, [duration, startAnimationLoop]);

  const resetRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try { mediaRecorderRef.current.stop(); } catch(e){}
    }
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    stopAnimationLoop();
    setAudioBlob(null);
    setAudioUrl(null);
    setDuration(0);
    setError(null);
    setIsRecording(false);
    setIsPaused(false);
    chunksRef.current = [];
  }, [audioUrl, stopAnimationLoop]);

  const formatDuration = useCallback((secs) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }, []);

  return {
    isRecording,
    isPaused,
    audioBlob,
    audioUrl,
    duration,
    formattedDuration: formatDuration(duration),
    error,
    waveformData,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    resetRecording,
  };
}
