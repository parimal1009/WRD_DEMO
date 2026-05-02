import React, { useRef, useState, useEffect, useCallback } from 'react';

/**
 * SignaturePad — Canvas-based electronic signature capture.
 * 
 * Features:
 * - Smooth pressure-sensitive drawing on a canvas
 * - Undo last stroke, clear all
 * - Save as PNG data URL
 * - Touch and mouse support
 * - Optional: load saved signature from localStorage
 */
export default function SignaturePad({ onSign, onCancel }) {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [strokes, setStrokes] = useState([]); // Array of stroke paths for undo
  const [currentStroke, setCurrentStroke] = useState([]);
  const [hasSaved, setHasSaved] = useState(false);
  const [penColor] = useState('#1D4ED8');
  const [penWidth] = useState(2.5);

  /**
   * Initialize canvas with a clean white background.
   */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;

    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // White background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, rect.width, rect.height);

    // Draw baseline guide
    ctx.strokeStyle = '#E5E7EB';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(20, rect.height * 0.7);
    ctx.lineTo(rect.width - 20, rect.height * 0.7);
    ctx.stroke();
    ctx.setLineDash([]);

    // Check for saved signature
    try {
      const saved = localStorage.getItem('voicedoc_saved_signature');
      if (saved) setHasSaved(true);
    } catch (e) {
      // ignore
    }
  }, []);

  /**
   * Redraw all stored strokes on the canvas (used for undo).
   */
  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();

    // Clear with white
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, rect.width, rect.height);

    // Baseline guide
    ctx.strokeStyle = '#E5E7EB';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(20, rect.height * 0.7);
    ctx.lineTo(rect.width - 20, rect.height * 0.7);
    ctx.stroke();
    ctx.setLineDash([]);

    // Redraw all strokes
    strokes.forEach(stroke => {
      if (stroke.length < 2) return;
      ctx.strokeStyle = penColor;
      ctx.lineWidth = penWidth;
      ctx.beginPath();
      ctx.moveTo(stroke[0].x, stroke[0].y);
      for (let i = 1; i < stroke.length; i++) {
        ctx.lineTo(stroke[i].x, stroke[i].y);
      }
      ctx.stroke();
    });
  }, [strokes, penColor, penWidth]);

  const getPos = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    
    if (e.touches) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      };
    }
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const startDraw = (e) => {
    e.preventDefault();
    setIsDrawing(true);
    const pos = getPos(e);
    setCurrentStroke([pos]);

    const ctx = canvasRef.current.getContext('2d');
    ctx.strokeStyle = penColor;
    ctx.lineWidth = penWidth;
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    e.preventDefault();
    const pos = getPos(e);
    setCurrentStroke(prev => [...prev, pos]);

    const ctx = canvasRef.current.getContext('2d');
    ctx.strokeStyle = penColor;
    ctx.lineWidth = penWidth;
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  };

  const endDraw = (e) => {
    if (!isDrawing) return;
    e?.preventDefault();
    setIsDrawing(false);

    if (currentStroke.length > 0) {
      setStrokes(prev => [...prev, currentStroke]);
      setCurrentStroke([]);
    }
  };

  const handleUndo = () => {
    setStrokes(prev => {
      const next = prev.slice(0, -1);
      // Schedule redraw after state update
      setTimeout(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const rect = canvas.getBoundingClientRect();

        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, rect.width, rect.height);

        ctx.strokeStyle = '#E5E7EB';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(20, rect.height * 0.7);
        ctx.lineTo(rect.width - 20, rect.height * 0.7);
        ctx.stroke();
        ctx.setLineDash([]);

        next.forEach(stroke => {
          if (stroke.length < 2) return;
          ctx.strokeStyle = penColor;
          ctx.lineWidth = penWidth;
          ctx.setLineDash([]);
          ctx.beginPath();
          ctx.moveTo(stroke[0].x, stroke[0].y);
          for (let i = 1; i < stroke.length; i++) {
            ctx.lineTo(stroke[i].x, stroke[i].y);
          }
          ctx.stroke();
        });
      }, 0);
      return next;
    });
  };

  const handleClear = () => {
    setStrokes([]);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, rect.width, rect.height);

    ctx.strokeStyle = '#E5E7EB';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(20, rect.height * 0.7);
    ctx.lineTo(rect.width - 20, rect.height * 0.7);
    ctx.stroke();
    ctx.setLineDash([]);
  };

  const handleConfirm = () => {
    if (strokes.length === 0) return;
    const canvas = canvasRef.current;
    const dataUrl = canvas.toDataURL('image/png');
    onSign(dataUrl);
  };

  const handleSaveForReuse = () => {
    if (strokes.length === 0) return;
    const canvas = canvasRef.current;
    const dataUrl = canvas.toDataURL('image/png');
    try {
      localStorage.setItem('voicedoc_saved_signature', dataUrl);
      setHasSaved(true);
    } catch (e) {
      // quota exceeded, ignore
    }
  };

  const handleLoadSaved = () => {
    try {
      const saved = localStorage.getItem('voicedoc_saved_signature');
      if (saved) {
        onSign(saved);
      }
    } catch (e) {
      // ignore
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Canvas area */}
      <div className="px-4 py-3 flex-1 flex flex-col">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-medium text-white/40 uppercase tracking-wider">
            Draw your signature below
          </p>
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleUndo}
              disabled={strokes.length === 0}
              className="text-xs text-white/30 hover:text-white/60 disabled:opacity-30 disabled:cursor-not-allowed transition-colors px-1.5 py-0.5"
              title="Undo last stroke"
            >
              ↩ Undo
            </button>
            <button
              onClick={handleClear}
              disabled={strokes.length === 0}
              className="text-xs text-white/30 hover:text-red-400/60 disabled:opacity-30 disabled:cursor-not-allowed transition-colors px-1.5 py-0.5"
              title="Clear all"
            >
              ✕ Clear
            </button>
          </div>
        </div>

        {/* Canvas container */}
        <div className="relative rounded-lg overflow-hidden border border-white/10 bg-white flex-1 min-h-[140px]">
          <canvas
            ref={canvasRef}
            className="w-full h-full cursor-crosshair touch-none"
            onMouseDown={startDraw}
            onMouseMove={draw}
            onMouseUp={endDraw}
            onMouseLeave={endDraw}
            onTouchStart={startDraw}
            onTouchMove={draw}
            onTouchEnd={endDraw}
            id="signature-canvas"
          />
          {strokes.length === 0 && !isDrawing && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <p className="text-gray-300 text-sm font-medium">✍ Sign here</p>
            </div>
          )}
        </div>

        {/* Saved signature option */}
        {hasSaved && (
          <button
            onClick={handleLoadSaved}
            className="mt-2 flex items-center gap-1.5 text-xs text-blue-400/70 hover:text-blue-400 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Use saved signature
          </button>
        )}
      </div>

      {/* Keyboard hint */}
      <div className="px-4 pb-2">
        <div className="flex items-start gap-2 bg-purple-500/5 border border-purple-500/10 rounded-lg px-3 py-2">
          <svg className="w-3.5 h-3.5 text-purple-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-[11px] text-purple-400/60 leading-relaxed">
            Your signature is embedded as an image in the document. Use
            <kbd className="px-1 py-0.5 bg-navy-700 rounded text-purple-300 mx-0.5">Save for reuse</kbd>
            to persist it across sessions.
          </p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="px-4 py-3 border-t border-white/5 flex items-center gap-2">
        <button
          onClick={handleConfirm}
          disabled={strokes.length === 0}
          className="btn-success flex items-center gap-1.5 text-sm flex-1 justify-center disabled:opacity-50 disabled:cursor-not-allowed"
          id="signature-confirm-button"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          Insert Signature
        </button>

        <button
          onClick={handleSaveForReuse}
          disabled={strokes.length === 0}
          className="btn-secondary flex items-center gap-1.5 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          title="Save signature for reuse"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
          </svg>
          Save
        </button>

        <button
          onClick={onCancel}
          className="w-9 h-9 rounded-lg bg-navy-700 border border-white/5 flex items-center justify-center
                     hover:bg-red-500/20 hover:border-red-500/20 transition-all text-white/40 hover:text-red-400"
          title="Cancel"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
