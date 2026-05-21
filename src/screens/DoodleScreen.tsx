import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Trash2,
  Undo,
  Camera,
  Layers,
  Sparkles,
  Download,
  Palette,
  CheckCircle,
  HelpCircle,
  Clock,
  Heart,
} from "lucide-react";
import { doc, getDoc, setDoc, onSnapshot, updateDoc, deleteField } from "firebase/firestore";
import { db } from "../firebase/config";
import { useAppStore } from "../store";
import { sensory } from "../utils/sensory";
import { encryptData } from "../utils/e2ee";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

interface Stroke {
  points: { x: number; y: number }[];
  color: string;
  width: number;
}

interface DoodleScreenProps {
  onSend?: (base64: string) => void;
  onClose?: () => void;
}

export function DoodleScreen({ onSend, onClose }: DoodleScreenProps) {
  const { setView, roomId, user, partner } = useAppStore((state) => ({
    setView: state.setView,
    roomId: state.roomId,
    user: state.user,
    partner: state.partner,
  }));

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [currentColor, setCurrentColor] = useState("#f43f5e"); 
  const [currentWidth, setCurrentWidth] = useState(4);
  const [currentTool, setCurrentTool] = useState<"brush" | "eraser">("brush");
  const [isDrawing, setIsDrawing] = useState(false);
  
  // Status states
  const [syncStatus, setSyncStatus] = useState<"idle" | "saving" | "synced">("synced");
  const [showGrid, setShowGrid] = useState(true);
  
  // Scrapbook saving modal
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [doodleTitle, setDoodleTitle] = useState("");
  const [isSavingToScrapbook, setIsSavingToScrapbook] = useState(false);

  // Refs for tracking active coordinates
  const strokesRef = useRef<Stroke[]>([]);
  strokesRef.current = strokes;
  const currentPathRef = useRef<{ x: number; y: number }[]>([]);

  // Sound and Haptics comfort helper
  const triggerHaptic = () => {
    sensory.tap();
  };

  // Enhanced Color Palette
  const COLORS = [
    { name: "Sakura", hex: "#f43f5e" },
    { name: "Rose", hex: "#fb7185" },
    { name: "Lavender", hex: "#a855f7" },
    { name: "Royal", hex: "#6366f1" },
    { name: "Sky", hex: "#38bdf8" },
    { name: "Mint", hex: "#10b981" },
    { name: "Leaf", hex: "#22c55e" },
    { name: "Sunny", hex: "#fbbf24" },
    { name: "Orange", hex: "#f97316" },
    { name: "Latte", hex: "#a16207" },
    { name: "Soot", hex: "#334155" },
    { name: "Midnight", hex: "#0f172a" },
  ];

  // Persistence: Load/Save draft from LocalStorage
  useEffect(() => {
    const saved = localStorage.getItem(`blablu_doodle_draft_${user?.uid}`);
    if (saved) {
      try {
        setStrokes(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to load draft", e);
      }
    }
  }, [user?.uid]);

  useEffect(() => {
    if (strokes.length > 0) {
      localStorage.setItem(`blablu_doodle_draft_${user?.uid}`, JSON.stringify(strokes));
    } else {
      localStorage.removeItem(`blablu_doodle_draft_${user?.uid}`);
    }
  }, [strokes, user?.uid]);

  // Canvas Setup & Resize listener
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !containerRef.current) return;

    const resizeCanvas = () => {
      const container = containerRef.current;
      if (!container || !canvas) return;
      const rect = container.getBoundingClientRect();
      
      // Support high DPI screens
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;

      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.scale(dpr, dpr);
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
      }
      
      // Redraw canvas content after size adjustment
      drawStrokesOnCanvas();
    };

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    return () => {
      window.removeEventListener("resize", resizeCanvas);
    };
  }, []);

  // Sync state values
  useEffect(() => {
    drawStrokesOnCanvas();
  }, [strokes]);

  // Redraw all strokes from standard state
  const drawStrokesOnCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width / (window.devicePixelRatio || 1);
    const height = canvas.height / (window.devicePixelRatio || 1);

    // Clear everything
    ctx.clearRect(0, 0, width, height);

    // Draw grid background for cozy sketchbook feeling
    if (showGrid) {
      ctx.save();
      ctx.strokeStyle = "rgba(148, 163, 184, 0.08)";
      ctx.lineWidth = 1;
      const gridSize = 25;
      for (let x = 0; x < width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }
      ctx.restore();
    }

    // Draw all completed strokes with smoothing
    strokesRef.current.forEach((stroke) => {
      if (stroke.points.length < 1) return;
      
      ctx.beginPath();
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.width;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      if (stroke.points.length < 3) {
        const p = stroke.points[0];
        ctx.moveTo(p.x * width, p.y * height);
        stroke.points.forEach(p => ctx.lineTo(p.x * width, p.y * height));
        ctx.stroke();
        return;
      }

      ctx.moveTo(stroke.points[0].x * width, stroke.points[0].y * height);
      
      for (let i = 1; i < stroke.points.length - 2; i++) {
        const xc = (stroke.points[i].x + stroke.points[i + 1].x) / 2 * width;
        const yc = (stroke.points[i].y + stroke.points[i + 1].y) / 2 * height;
        ctx.quadraticCurveTo(stroke.points[i].x * width, stroke.points[i].y * height, xc, yc);
      }
      
      // For the last 2 points
      const last2 = stroke.points[stroke.points.length - 2];
      const last = stroke.points[stroke.points.length - 1];
      ctx.quadraticCurveTo(last2.x * width, last2.y * height, last.x * width, last.y * height);
      ctx.stroke();
    });

    // Draw current active stroke with smoothing
    if (isDrawing && currentPathRef.current.length > 0) {
      ctx.beginPath();
      ctx.strokeStyle = currentTool === "eraser" ? "#ffffff" : currentColor;
      ctx.lineWidth = currentWidth;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      if (currentPathRef.current.length < 3) {
        const p = currentPathRef.current[0];
        ctx.moveTo(p.x * width, p.y * height);
        currentPathRef.current.forEach(p => ctx.lineTo(p.x * width, p.y * height));
        ctx.stroke();
      } else {
        ctx.moveTo(currentPathRef.current[0].x * width, currentPathRef.current[0].y * height);
        for (let i = 1; i < currentPathRef.current.length - 2; i++) {
          const xc = (currentPathRef.current[i].x + currentPathRef.current[i + 1].x) / 2 * width;
          const yc = (currentPathRef.current[i].y + currentPathRef.current[i + 1].y) / 2 * height;
          ctx.quadraticCurveTo(currentPathRef.current[i].x * width, currentPathRef.current[i].y * height, xc, yc);
        }
        const last2 = currentPathRef.current[currentPathRef.current.length - 2];
        const last = currentPathRef.current[currentPathRef.current.length - 1];
        ctx.quadraticCurveTo(last2.x * width, last2.y * height, last.x * width, last.y * height);
        ctx.stroke();
      }
    }
  };

  const [showClearModal, setShowClearModal] = useState(false);

  // Drawing event trackers
  const getCanvasCoords = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    let clientX = 0;
    let clientY = 0;

    if (e.nativeEvent instanceof TouchEvent) {
      if (e.nativeEvent.touches.length === 0) return null;
      clientX = (e.nativeEvent as TouchEvent).touches[0].clientX;
      clientY = (e.nativeEvent as TouchEvent).touches[0].clientY;
    } else {
      const mouseEvent = e as React.MouseEvent;
      clientX = mouseEvent.clientX;
      clientY = mouseEvent.clientY;
    }

    const localX = clientX - rect.left;
    const localY = clientY - rect.top;

    // Return percentage ratios (0 to 1) for fluid adaptive drawing on any container size
    return {
      x: Math.max(0, Math.min(1, localX / rect.width)),
      y: Math.max(0, Math.min(1, localY / rect.height)),
    };
  };

  const handleStartDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const coords = getCanvasCoords(e);
    if (!coords) return;

    setIsDrawing(true);
    currentPathRef.current = [coords];
    
    // Trigger faint haptic
    triggerHaptic();
    drawStrokesOnCanvas();
  };

  const handleDrawMove = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const coords = getCanvasCoords(e);
    if (!coords) return;

    // Filter points slightly for custom bezier efficiency in rendering
    const lastPoint = currentPathRef.current[currentPathRef.current.length - 1];
    if (lastPoint) {
      const dist = Math.hypot(coords.x - lastPoint.x, coords.y - lastPoint.y);
      if (dist < 0.002) return;
    }

    currentPathRef.current.push(coords);
    drawStrokesOnCanvas();
  };

  const handleEndDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);

    if (currentPathRef.current.length > 1) {
      const newStroke: Stroke = {
        points: currentPathRef.current,
        color: currentTool === "eraser" ? "#ffffff" : currentColor,
        width: currentWidth,
      };

      setStrokes(prev => [...prev, newStroke]);
      currentPathRef.current = [];
    } else {
      currentPathRef.current = [];
    }
  };

  // Canvas Actions
  const handleUndo = () => {
    if (strokes.length === 0) return;
    triggerHaptic();
    setStrokes(prev => prev.slice(0, -1));
  };

  const handleClear = () => {
    if (strokes.length === 0) return;
    setShowClearModal(true);
  };

  const confirmClear = () => {
    sensory.alert();
    setStrokes([]);
    setShowClearModal(false);
  };

  // Open the save modal with basic validation
  const saveToScrapbook = () => {
    if (strokes.length === 0) {
      alert("Please draw something before saving 🎨");
      return;
    }
    setShowSaveModal(true);
    triggerHaptic();
  };

  // Send current canvas to chat or scrapbook
  const handleFinalSend = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    triggerHaptic();
    const dataUrl = canvas.toDataURL("image/png");

    if (onSend) {
      onSend(dataUrl);
      setStrokes([]); // Clear after sending from chat
      localStorage.removeItem(`blablu_doodle_draft_${user?.uid}`);
      return;
    }

    // Default to scrapbook if used as standalone view
    saveToScrapbook();
  };

  const handleConfirmSaveToScrapbook = async () => {
    const canvas = canvasRef.current;
    if (!canvas || !roomId || !user) return;

    try {
      setIsSavingToScrapbook(true);

      // 1. Convert current canvas element into high quality PNG base64 representation
      const dataUrl = canvas.toDataURL("image/png");

      // 2. Encrypt contents with App E2EE
      const encryptedContent = await encryptData(dataUrl);
      const encryptedCaption = await encryptData(doodleTitle.trim() || "Our Romantic Drawing 🎨🐾");

      // 3. Store to Shared Scrapbook/Timeline document in Firebase
      const timelineDocRef = collection(db, "pairs", roomId, "timeline");
      await addDoc(timelineDocRef, {
        type: "photo",
        content: encryptedContent,
        caption: encryptedCaption,
        createdAt: serverTimestamp(),
        userId: user.uid,
        stickers: [], // standard scrapbook specs
      });

      sensory.success();
      setIsSavingToScrapbook(false);
      setShowSaveModal(false);
      setDoodleTitle("");

      // Confetti and notify
      alert("Successfully saved to Our Scrapbook! 🥳💖");
    } catch (err) {
      console.error(err);
      setIsSavingToScrapbook(false);
      alert("Failed to save to scrapbook 💔");
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#fafaf9] dark:bg-[#12101e] transition-colors relative select-none">
      
      {/* HEADER BAR */}
      <div className="px-4 py-3 bg-white/70 dark:bg-card/40 backdrop-blur-md border-b border-border/40 flex items-center justify-between shadow-xs sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              triggerHaptic();
              if (onClose) {
                onClose();
              } else {
                setView("home");
              }
            }}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-text transition-all"
            title="Go home"
          >
            <ArrowLeft size={16} />
          </button>
          
          <div className="flex flex-col">
            <span className="text-xs font-black tracking-tight text-text">Doodle Studio</span>
            <span className="text-[9px] font-bold uppercase tracking-widest text-text/40">Private Creation</span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {strokes.length > 0 && (
            <button
              onClick={handleFinalSend}
              className="px-4 py-1.5 bg-primary text-white rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 active:scale-95 transition-all shadow-md shadow-primary/20"
            >
              {onSend ? "Send to Partner" : "Save to Memories"}
            </button>
          )}
          <button
            onClick={handleClear}
            className="w-8 h-8 flex items-center justify-center text-text/40 hover:text-rose-500 rounded-lg hover:bg-rose-500/10 transition-colors"
            title="Clear board"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      {/* DRAWING BOARD AREA */}
      <div className="flex-1 flex w-full relative overflow-hidden bg-white dark:bg-[#0c0a15] touch-none">
        {/* VERTICAL TOOLBAR - ADVANCED DRAWING */}
        <div className="absolute left-3 top-1/2 -translate-y-1/2 z-40 flex flex-col items-center gap-4 bg-white/80 dark:bg-card/80 backdrop-blur-lg p-2.5 rounded-3xl border border-border/50 shadow-2xl">
          {/* Tool selectors */}
          <div className="flex flex-col gap-2">
            <button
              onClick={() => { triggerHaptic(); setCurrentTool("brush"); }}
              className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all ${
                currentTool === "brush" ? "bg-primary text-white shadow-lg scale-110" : "text-text/40 hover:bg-slate-100 dark:hover:bg-neutral-800"
              }`}
            >
              <Palette size={18} />
            </button>
            <button
              onClick={() => { triggerHaptic(); setCurrentTool("eraser"); }}
              className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all ${
                currentTool === "eraser" ? "bg-rose-500 text-white shadow-lg scale-110" : "text-text/40 hover:bg-slate-100 dark:hover:bg-neutral-800"
              }`}
            >
              <div className="w-5 h-5 rounded-sm border-2 border-current" />
            </button>
          </div>

          <div className="w-6 h-px bg-border/50" />

          {/* Vertical Brush Slider */}
          <div className="flex flex-col items-center gap-3 py-2">
            <div className="text-[9px] font-black uppercase text-text/30 vertical-text rotate-180">Size</div>
            <input
              type="range"
              min="1"
              max="40"
              step="1"
              value={currentWidth}
              onChange={(e) => setCurrentWidth(Number(e.target.value))}
              className="vertical-range accent-primary w-24 h-1.5 my-8 appearance-none bg-slate-200 dark:bg-white/10 rounded-full cursor-pointer"
              style={{ transform: "rotate(-90deg)" }}
            />
            <div 
              className="w-5 h-5 rounded-full bg-text transition-all border border-border" 
              style={{ transform: `scale(${0.2 + (currentWidth/40)})` }}
            />
          </div>

          <div className="w-6 h-px bg-border/50" />

          {/* Grid Toggle */}
          <button
            onClick={() => { triggerHaptic(); setShowGrid(!showGrid); }}
            className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all ${
              showGrid ? "bg-slate-100 text-primary dark:bg-white/10" : "text-text/20 hover:bg-slate-100 dark:hover:bg-neutral-800"
            }`}
          >
            <Layers size={18} />
          </button>

          <div className="w-6 h-px bg-border/50" />

          {/* Undo */}
          <button
            onClick={handleUndo}
            disabled={strokes.length === 0}
            className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all ${
              strokes.length > 0 ? "text-text hover:bg-slate-100 dark:hover:bg-neutral-800" : "text-text/10 cursor-not-allowed"
            }`}
          >
            <Undo size={18} />
          </button>
        </div>

        <div 
          ref={containerRef}
          className="flex-1 w-full h-full relative"
          style={{ cursor: "crosshair" }}
        >
          <canvas
            ref={canvasRef}
            onMouseDown={handleStartDrawing}
            onMouseMove={handleDrawMove}
            onMouseUp={handleEndDrawing}
            onMouseLeave={handleEndDrawing}
            onTouchStart={handleStartDrawing}
            onTouchMove={handleDrawMove}
            onTouchEnd={handleEndDrawing}
            className="absolute inset-0 block w-full h-full"
          />

          {strokes.length === 0 && !isDrawing && (
            <div className="absolute inset-x-20 top-1/2 -translate-y-1/2 pointer-events-none text-center flex flex-col items-center select-none opacity-40">
              <Sparkles size={40} className="text-primary mb-4 animate-pulse" />
              <h3 className="font-display font-black text-xl text-text mb-1 italic">Canvas is Yours</h3>
              <p className="text-xs text-text max-w-xs font-medium">Draw something beautiful for them...</p>
            </div>
          )}
        </div>

        {/* BOTTOM COLOR BAR */}
        {currentTool === "brush" && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-40 max-w-[85%] bg-white/80 dark:bg-card/80 backdrop-blur-lg p-2 rounded-3xl border border-border/50 shadow-2xl flex items-center gap-2 overflow-x-auto no-scrollbar scroll-smooth">
            {COLORS.map((color) => (
              <button
                key={color.hex}
                onClick={() => {
                  triggerHaptic();
                  setCurrentColor(color.hex);
                }}
                className={`w-9 h-9 rounded-2xl shrink-0 transition-all ${
                  currentColor === color.hex ? "scale-110 shadow-lg ring-2 ring-primary ring-offset-2 dark:ring-offset-slate-900" : "hover:scale-105 opacity-80"
                }`}
                style={{ backgroundColor: color.hex }}
              />
            ))}
          </div>
        )}
      </div>

      {/* SAVE TO SCRAPBOOK / TIMELINE POPUP MODAL */}
      <AnimatePresence>
        {showSaveModal && (
          <>
            {/* Backdrop cover */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.6 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black z-[990]"
              onClick={() => setShowSaveModal(false)}
            />

            {/* Modal Body container */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed bottom-10 inset-x-4 max-w-sm mx-auto bg-card rounded-[2rem] border border-border shadow-2xl p-6 z-[1000] flex flex-col gap-4 text-center select-text"
            >
              <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center self-center animate-bounce">
                <Heart size={22} fill="currentColor" />
              </div>

              <div>
                <h4 className="font-display font-black text-base text-text">Save masterpiece to Scrapbook!</h4>
                <p className="text-xs text-text/50 mt-1 font-medium">This snapshot will be saved in your couple memories box forever.</p>
              </div>

              {/* Title input form */}
              <input
                type="text"
                placeholder="Give your drawing a sweet title... 💝"
                value={doodleTitle}
                onChange={(e) => setDoodleTitle(e.target.value)}
                maxLength={45}
                className="w-full text-xs font-bold px-4 py-3 border border-border/80 rounded-xl bg-slate-50 dark:bg-[#1a1829] text-text focus:outline-none focus:border-primary text-center"
              />

              <div className="flex gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => setShowSaveModal(false)}
                  disabled={isSavingToScrapbook}
                  className="flex-1 py-3 border border-border text-xs font-bold rounded-xl text-text hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmSaveToScrapbook}
                  disabled={isSavingToScrapbook}
                  className="flex-1 py-3 bg-primary text-white text-xs font-black uppercase tracking-widest rounded-xl hover:bg-primary-hover active:scale-95 transition-all shadow-sm flex items-center justify-center gap-1.5"
                >
                  {isSavingToScrapbook ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Saving
                    </>
                  ) : (
                    "Confirm"
                  )}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* CLEAR CANVAS POPUP MODAL */}
      <AnimatePresence>
        {showClearModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.6 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black z-[990]"
              onClick={() => setShowClearModal(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed bottom-10 inset-x-4 max-w-sm mx-auto bg-card rounded-[2rem] border border-border shadow-2xl p-6 z-[1000] flex flex-col gap-4 text-center"
            >
              <div className="w-12 h-12 rounded-full bg-rose-500/10 text-rose-500 flex items-center justify-center self-center">
                <Trash2 size={24} />
              </div>

              <div>
                <h4 className="font-display font-black text-base text-text">Clear everything?</h4>
                <p className="text-xs text-text/50 mt-1 font-medium italic">
                  "One wipe, clean slate. But our memories stay great."
                </p>
                <p className="text-[10px] text-rose-500/70 mt-2 font-bold uppercase tracking-wider">
                  This clears it for both you and your partner!
                </p>
              </div>

              <div className="flex gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => setShowClearModal(false)}
                  className="flex-1 py-3 border border-border text-xs font-bold rounded-xl text-text hover:bg-slate-50 transition-colors"
                >
                  Keep it
                </button>
                <button
                  type="button"
                  onClick={confirmClear}
                  className="flex-1 py-3 bg-rose-500 text-white text-xs font-black uppercase tracking-widest rounded-xl hover:bg-rose-600 active:scale-95 transition-all shadow-sm"
                >
                  Clear Pad
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
