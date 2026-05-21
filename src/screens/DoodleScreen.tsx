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
  ChevronLeft,
  Pen,
  Square,
  Circle,
  Grid,
  Smile,
} from "lucide-react";
import { useAppStore } from "../store";
import { db } from "../firebase/config";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { sensory } from "../utils/sensory";
import { encryptData } from "../utils/e2ee";

export interface Stroke {
  points: { x: number; y: number; pressure?: number }[];
  color: string;
  width: number;
  opacity: number;
  tool: "pencil" | "brush" | "neon" | "eraser";
  shape?: "none" | "line" | "rect" | "circle";
}

interface DoodleScreenProps {
  onSend?: (base64: string) => void;
  onClose?: () => void;
}

export function DoodleScreen({ onSend, onClose }: DoodleScreenProps) {
  const { setView, roomId, user } = useAppStore((state) => ({
    setView: state.setView,
    roomId: state.roomId,
    user: state.user,
  }));

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [currentColor, setCurrentColor] = useState("#f43f5e"); 
  const [currentWidth, setCurrentWidth] = useState(4);
  const [currentOpacity, setCurrentOpacity] = useState(1);
  const [currentTool, setCurrentTool] = useState<Stroke["tool"]>("brush");
  const [currentShape, setCurrentShape] = useState<Stroke["shape"]>("none");
  const [canvasBg, setCanvasBg] = useState("#ffffff");
  const [isDrawing, setIsDrawing] = useState(false);
  const [showGrid, setShowGrid] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [doodleTitle, setDoodleTitle] = useState("");
  const [showClearModal, setShowClearModal] = useState(false);
  const [isSavingToScrapbook, setIsSavingToScrapbook] = useState(false);

  // Refs for tracking active coordinates
  const strokesRef = useRef<Stroke[]>([]);
  strokesRef.current = strokes;
  const currentPathRef = useRef<{ x: number; y: number; pressure?: number }[]>([]);
  const startPosRef = useRef<{ x: number; y: number } | null>(null);

  const triggerHaptic = () => {
    sensory.tap();
  };

  const COLORS = [
    { name: "Sakura", hex: "#f43f5e" },
    { name: "Pink", hex: "#ec4899" },
    { name: "Amethyst", hex: "#d946ef" },
    { name: "Lavender", hex: "#a855f7" },
    { name: "Indigo", hex: "#6366f1" },
    { name: "Royal", hex: "#3b82f6" },
    { name: "Sky", hex: "#0ea5e9" },
    { name: "Teal", hex: "#14b8a6" },
    { name: "Emerald", hex: "#10b981" },
    { name: "Forest", hex: "#22c55e" },
    { name: "Lime", hex: "#84cc16" },
    { name: "Sunny", hex: "#eab308" },
    { name: "Orange", hex: "#f97316" },
    { name: "Rose", hex: "#ef4444" },
    { name: "Slate", hex: "#334155" },
    { name: "Midnight", hex: "#0f172a" },
    { name: "Pure White", hex: "#ffffff" },
  ];

  const BG_COLORS = [
    "#ffffff", "#fafaf9", "#f0f9ff", "#fff7ed", "#fdf2f8", "#0f172a", "#1e293b"
  ];

  // Persistence: Load/Save draft from LocalStorage
  useEffect(() => {
    const saved = localStorage.getItem(`blablu_doodle_draft_${user?.uid}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setStrokes(parsed.strokes || []);
        setCanvasBg(parsed.bg || "#ffffff");
      } catch (e) {
        console.error("Failed to load draft", e);
      }
    }
  }, [user?.uid]);

  useEffect(() => {
    if (strokes.length > 0 || canvasBg !== "#ffffff") {
      localStorage.setItem(`blablu_doodle_draft_${user?.uid}`, JSON.stringify({
        strokes,
        bg: canvasBg
      }));
    } else {
      localStorage.removeItem(`blablu_doodle_draft_${user?.uid}`);
    }
  }, [strokes, canvasBg, user?.uid]);

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
  useEffect(() => drawStrokesOnCanvas(), [strokes, isDrawing, canvasBg, showGrid, currentColor, currentWidth, currentOpacity, currentTool, currentShape]);

  // Redraw all strokes from standard state
  const drawStrokesOnCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width / (window.devicePixelRatio || 1);
    const height = canvas.height / (window.devicePixelRatio || 1);

    // Canvas Background
    ctx.fillStyle = canvasBg;
    ctx.fillRect(0, 0, width, height);

    if (showGrid) {
      ctx.save();
      ctx.strokeStyle = "rgba(148, 163, 184, 0.08)";
      ctx.lineWidth = 1;
      const gridSize = 40;
      for (let x = 0; x < width; x += gridSize) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
      }
      for (let y = 0; y < height; y += gridSize) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
      }
      ctx.restore();
    }

    const renderStroke = (s: Stroke) => {
      if (s.points.length < 1) return;
      ctx.save();
      
      const drawColor = s.tool === "eraser" ? canvasBg : s.color;
      ctx.globalAlpha = s.opacity;
      ctx.strokeStyle = drawColor;
      ctx.fillStyle = drawColor;
      ctx.lineWidth = s.width;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      if (s.tool === "neon") {
        ctx.shadowBlur = s.width * 2;
        ctx.shadowColor = drawColor;
      } else if (s.tool === "brush") {
        ctx.shadowBlur = s.width * 0.5;
        ctx.shadowColor = "rgba(0,0,0,0.1)";
      }

      if (s.shape && s.shape !== "none" && s.points.length >= 2) {
        const start = s.points[0];
        const end = s.points[s.points.length - 1];
        const sx = start.x * width, sy = start.y * height;
        const ex = end.x * width, ey = end.y * height;

        ctx.beginPath();
        if (s.shape === "line") {
          ctx.moveTo(sx, sy);
          ctx.lineTo(ex, ey);
        } else if (s.shape === "rect") {
          ctx.strokeRect(sx, sy, ex - sx, ey - sy);
        } else if (s.shape === "circle") {
          const radius = Math.hypot(ex - sx, ey - sy);
          ctx.arc(sx, sy, radius, 0, Math.PI * 2);
        }
        ctx.stroke();
      } else {
        ctx.beginPath();
        if (s.points.length < 3) {
          ctx.moveTo(s.points[0].x * width, s.points[0].y * height);
          s.points.forEach(p => ctx.lineTo(p.x * width, p.y * height));
          ctx.stroke();
        } else {
          ctx.moveTo(s.points[0].x * width, s.points[0].y * height);
          for (let i = 1; i < s.points.length - 2; i++) {
            const xc = (s.points[i].x + s.points[i + 1].x) / 2 * width;
            const yc = (s.points[i].y + s.points[i + 1].y) / 2 * height;
            ctx.quadraticCurveTo(s.points[i].x * width, s.points[i].y * height, xc, yc);
          }
          const last2 = s.points[s.points.length - 2];
          const last = s.points[s.points.length - 1];
          ctx.quadraticCurveTo(last2.x * width, last2.y * height, last.x * width, last.y * height);
          ctx.stroke();
        }
      }
      ctx.restore();
    };

    strokesRef.current.forEach(s => renderStroke(s));
    
    if (isDrawing && currentPathRef.current.length > 0) {
      renderStroke({
        points: currentPathRef.current,
        color: currentColor,
        width: currentWidth,
        opacity: currentOpacity,
        tool: currentTool,
        shape: currentShape
      });
    }
  };

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
    startPosRef.current = { x: coords.x, y: coords.y };
    currentPathRef.current = [coords];
    
    // Trigger faint haptic
    triggerHaptic();
    drawStrokesOnCanvas();
  };

  const handleDrawMove = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const coords = getCanvasCoords(e);
    if (!coords) return;

    if (currentShape !== "none") {
      currentPathRef.current = [startPosRef.current!, coords];
    } else {
      const lastPoint = currentPathRef.current[currentPathRef.current.length - 1];
      if (lastPoint) {
        const dist = Math.hypot(coords.x - lastPoint.x, coords.y - lastPoint.y);
        if (dist < 0.002) return;
      }
      currentPathRef.current.push(coords);
    }
    drawStrokesOnCanvas();
  };

  const handleEndDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);

    if (currentPathRef.current.length > 0) {
      const newStroke: Stroke = {
        points: currentPathRef.current,
        color: currentColor,
        width: currentWidth,
        opacity: currentOpacity,
        tool: currentTool,
        shape: currentShape
      };

      setStrokes(prev => [...prev, newStroke]);
    }
    currentPathRef.current = [];
    startPosRef.current = null;
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
    setCanvasBg("#ffffff");
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
        
        {/* LEFT TOOLBAR - ADVANCED DRAWING */}
        <div className="absolute left-3 top-1/2 -translate-y-1/2 z-40 flex flex-col items-center gap-4 bg-white/90 dark:bg-card/90 backdrop-blur-xl p-2.5 rounded-[2rem] border border-border/50 shadow-2xl">
          
          {/* Main Tools Palette */}
          <div className="flex flex-col gap-2">
            {[
              { id: "pencil", icon: <Pen size={16} />, label: "Pencil", color: "text-slate-500" },
              { id: "brush", icon: <Palette size={16} />, label: "Brush", color: "text-primary" },
              { id: "neon", icon: <Sparkles size={16} />, label: "Neon", color: "text-purple-500" },
              { id: "eraser", icon: <div className="w-4 h-3 border-2 border-current rounded-xs" />, label: "Eraser", color: "text-rose-500" }
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => { triggerHaptic(); setCurrentTool(t.id as any); setCurrentShape("none"); }}
                className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all relative group ${
                  currentTool === t.id && currentShape === "none" ? "bg-primary text-white shadow-lg scale-110" : "text-text/40 hover:bg-slate-100 dark:hover:bg-neutral-800"
                }`}
                title={t.label}
              >
                {t.icon}
                <div className="absolute left-14 px-2 py-1 bg-neutral-900 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap">
                  {t.label}
                </div>
              </button>
            ))}
          </div>

          <div className="w-6 h-px bg-border/50" />

          {/* Shapes Palette */}
          <div className="flex flex-col gap-2">
            {[
              { id: "line", icon: <div className="w-5 h-0.5 bg-current rotate-45" />, label: "Line" },
              { id: "rect", icon: <Square size={16} />, label: "Rectangle" },
              { id: "circle", icon: <Circle size={16} />, label: "Circle" }
            ].map((s) => (
              <button
                key={s.id}
                onClick={() => { triggerHaptic(); setCurrentShape(s.id as any); if (currentTool === "eraser") setCurrentTool("brush"); }}
                className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all relative group ${
                  currentShape === s.id ? "bg-indigo-500 text-white shadow-lg scale-110" : "text-text/40 hover:bg-slate-100 dark:hover:bg-neutral-800"
                }`}
                title={s.label}
              >
                {s.icon}
                <div className="absolute left-14 px-2 py-1 bg-neutral-900 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap">
                  {s.label}
                </div>
              </button>
            ))}
          </div>

          <div className="w-6 h-px bg-border/50" />

          {/* Grid Toggle */}
          <button
            onClick={() => { triggerHaptic(); setShowGrid(!showGrid); }}
            className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all ${
              showGrid ? "bg-emerald-500 text-white shadow-lg scale-110" : "text-text/40 hover:bg-slate-100 dark:hover:bg-neutral-800"
            }`}
            title="Toggle Grid"
          >
            <Grid size={16} />
          </button>

          <div className="w-6 h-px bg-border/50" />

          {/* Undo */}
          <button
            onClick={handleUndo}
            disabled={strokes.length === 0}
            className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all ${
              strokes.length > 0 ? "text-text hover:bg-slate-100 dark:hover:bg-neutral-800" : "text-text/10 cursor-not-allowed"
            }`}
            title="Undo"
          >
            <Undo size={16} />
          </button>
        </div>

        {/* RIGHT SLIDERS - WIDTH & OPACITY */}
        <div className="absolute right-3 top-1/2 -translate-y-1/2 z-40 flex flex-col items-center gap-6 bg-white/90 dark:bg-card/90 backdrop-blur-xl p-3 rounded-[2rem] border border-border/50 shadow-2xl">
          <div className="flex flex-col items-center gap-2">
            <span className="text-[9px] font-black uppercase tracking-tighter text-text/30">Size</span>
            <div className="h-32 w-1.5 bg-slate-100 dark:bg-white/5 rounded-full relative overflow-hidden group cursor-pointer">
              <input
                type="range"
                min="1"
                max="50"
                step="1"
                value={currentWidth}
                onChange={(e) => setCurrentWidth(Number(e.target.value))}
                className="absolute inset-0 opacity-0 cursor-pointer h-full w-full z-10 [writing-mode:bt-lr] rotate-180"
                style={{ appearance: "slider-vertical" }}
              />
              <motion.div 
                className="absolute bottom-0 left-0 w-full bg-primary"
                initial={false}
                animate={{ height: `${(currentWidth / 50) * 100}%` }}
              />
            </div>
            <span className="text-[10px] font-bold text-text/60">{currentWidth}</span>
          </div>

          <div className="w-6 h-px bg-border/50" />

          <div className="flex flex-col items-center gap-2">
            <span className="text-[9px] font-black uppercase tracking-tighter text-text/30">Alpha</span>
            <div className="h-32 w-1.5 bg-slate-100 dark:bg-white/5 rounded-full relative overflow-hidden group cursor-pointer">
              <input
                type="range"
                min="0.1"
                max="1"
                step="0.05"
                value={currentOpacity}
                onChange={(e) => setCurrentOpacity(Number(e.target.value))}
                className="absolute inset-0 opacity-0 cursor-pointer h-full w-full z-10 [writing-mode:bt-lr] rotate-180"
                style={{ appearance: "slider-vertical" }}
              />
              <motion.div 
                className="absolute bottom-0 left-0 w-full bg-indigo-500"
                initial={false}
                animate={{ height: `${currentOpacity * 100}%` }}
              />
            </div>
            <span className="text-[10px] font-bold text-text/60">{Math.round(currentOpacity * 100)}%</span>
          </div>
        </div>

        <div 
          ref={containerRef}
          className="flex-1 w-full h-full relative"
          style={{ cursor: currentTool === "eraser" ? "cell" : "crosshair" }}
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
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center select-none">
              <div className="flex flex-col items-center gap-4 opacity-10 dark:opacity-20 animate-in fade-in zoom-in duration-1000">
                <Palette size={120} />
                <div className="text-center">
                  <h3 className="font-display font-black text-4xl italic tracking-tighter text-text uppercase">Canvas Studio</h3>
                  <p className="font-medium text-lg text-text">Private Artistic Playground</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* TOOL CONTROL OVERLAYS */}
        <div className="absolute bottom-6 inset-x-0 z-40 px-4 flex flex-col gap-4 pointer-events-none">
          {/* Canvas Background Color Picker */}
          <div className="flex justify-center">
             <div className="bg-white/80 dark:bg-card/80 backdrop-blur-xl p-1.5 rounded-full border border-border/50 shadow-2xl flex items-center gap-1.5 pointer-events-auto overflow-x-auto no-scrollbar max-w-full scale-90">
                <div className="text-[10px] font-black uppercase text-text/30 px-2 flex items-center gap-1">
                  <Layers size={10} /> BG
                </div>
                {BG_COLORS.map((bg) => (
                  <button
                    key={bg}
                    onClick={() => { triggerHaptic(); setCanvasBg(bg); }}
                    className={`w-6 h-6 rounded-full border-2 transition-all shrink-0 ${
                      canvasBg === bg ? "border-primary scale-110 shadow-lg" : "border-transparent hover:scale-110"
                    }`}
                    style={{ backgroundColor: bg }}
                  />
                ))}
             </div>
          </div>

          {/* Drawing Color Palette */}
          {currentTool !== "eraser" && (
            <div className="flex justify-center">
              <div className="bg-white/90 dark:bg-card/90 backdrop-blur-2xl p-2 rounded-[2rem] border border-border/50 shadow-2xl flex items-center gap-2 pointer-events-auto overflow-x-auto no-scrollbar max-w-[90%] scroll-smooth">
                {COLORS.map((color) => (
                  <button
                    key={color.hex}
                    onClick={() => { triggerHaptic(); setCurrentColor(color.hex); if (currentTool === "eraser") setCurrentTool("brush"); }}
                    className={`w-10 h-10 rounded-2xl shrink-0 transition-all ${
                      currentColor === color.hex ? "scale-110 shadow-xl ring-2 ring-primary ring-offset-2 dark:ring-offset-slate-900" : "hover:scale-105 opacity-80"
                    }`}
                    style={{ backgroundColor: color.hex }}
                  >
                    {currentColor === color.hex && (
                      <CheckCircle size={14} className="text-white mx-auto drop-shadow-md" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
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
