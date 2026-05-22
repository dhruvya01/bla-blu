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
  Maximize2,
  Minimize2,
  Columns2,
  Hash,
  Activity,
  Zap,
  Lock,
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
  tool: "pencil" | "brush" | "neon" | "eraser" | "spray";
  shape?: "none" | "line" | "dashed-line" | "rect" | "circle";
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
  const activeCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [currentColor, setCurrentColor] = useState("#f43f5e"); 
  const [currentWidth, setCurrentWidth] = useState(4);
  const [currentOpacity, setCurrentOpacity] = useState(1);
  const [currentTool, setCurrentTool] = useState<Stroke["tool"]>("brush");
  const [currentShape, setCurrentShape] = useState<Stroke["shape"]>("none");
  const [isMirrorMode, setIsMirrorMode] = useState(false);
  const [radialSymmetry, setRadialSymmetry] = useState<0 | 4 | 6 | 8>(0);
  const [isSmoothing, setIsSmoothing] = useState(true);
  const [activeTab, setActiveTab] = useState<"tools" | "colors" | "settings">("tools");
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
  const lastPointTimeRef = useRef<number>(0);
  const lastSpeedRef = useRef<number>(1);

  const triggerHaptic = () => {
    sensory.tap();
  };

  const COLORS = [
    { name: "Sakura", hex: "#f43f5e" },
    { name: "Pink", hex: "#ec4899" },
    { name: "Amethyst", hex: "#d946ef" },
    { name: "Lavender", hex: "#a855f7" },
    { name: "Violet", hex: "#8b5cf6" },
    { name: "Indigo", hex: "#6366f1" },
    { name: "Royal", hex: "#3b82f6" },
    { name: "Sky", hex: "#0ea5e9" },
    { name: "Cyan", hex: "#06b6d4" },
    { name: "Teal", hex: "#14b8a6" },
    { name: "Emerald", hex: "#10b981" },
    { name: "Forest", hex: "#22c55e" },
    { name: "Lime", hex: "#84cc16" },
    { name: "Lemon", hex: "#facc15" },
    { name: "Sunny", hex: "#eab308" },
    { name: "Amber", hex: "#f59e0b" },
    { name: "Orange", hex: "#f97316" },
    { name: "Rose", hex: "#ef4444" },
    { name: "Coffee", hex: "#78350f" },
    { name: "Slate", hex: "#334155" },
    { name: "Midnight", hex: "#0f172a" },
    { name: "AMOLED", hex: "#000000" },
    { name: "Pure White", hex: "#ffffff" },
  ];

  const BG_COLORS = [
    "#ffffff", "#fafaf9", "#f5f5f4", "#f0f9ff", "#fff7ed", "#fdf2f8", "#0f172a", "#1e293b", "#000000"
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
      const act = activeCanvasRef.current;
      if (!container || !canvas) return;
      const rect = container.getBoundingClientRect();
      
      // Support high DPI screens
      const dpr = window.devicePixelRatio || 1;
      
      [canvas, act].forEach(c => {
         if (!c) return;
         c.width = rect.width * dpr;
         c.height = rect.height * dpr;
         c.style.width = `${rect.width}px`;
         c.style.height = `${rect.height}px`;

         const ctx = c.getContext("2d");
         if (ctx) {
           ctx.scale(dpr, dpr);
           ctx.lineCap = "round";
           ctx.lineJoin = "round";
         }
      });
      
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
  useEffect(() => drawStrokesOnCanvas(), [strokes, canvasBg, showGrid, isMirrorMode, radialSymmetry, isSmoothing]);

  // Core Render Method
  const renderStroke = (ctx: CanvasRenderingContext2D, width: number, height: number, s: Stroke, symmetryOptions: { mirror?: boolean; rotation?: number } = {}) => {
      if (s.points.length < 1) return;
      ctx.save();
      
      const drawColor = s.tool === "eraser" ? canvasBg : s.color;
      ctx.globalAlpha = s.opacity;
      ctx.strokeStyle = drawColor;
      ctx.fillStyle = drawColor;
      ctx.lineWidth = s.width;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      // Apply symmetry transformations
      if (symmetryOptions.mirror) {
        ctx.translate(width, 0);
        ctx.scale(-1, 1);
      }
      
      if (symmetryOptions.rotation) {
        ctx.translate(width / 2, height / 2);
        ctx.rotate(symmetryOptions.rotation);
        ctx.translate(-width / 2, -height / 2);
      }

      if (s.tool === "neon") {
        ctx.shadowBlur = s.width * 2.5;
        ctx.shadowColor = drawColor;
      } else if (s.tool === "pencil") {
        ctx.globalAlpha = s.opacity; // Sharp pen feel
      } else if (s.tool === "spray") {
        ctx.globalAlpha = s.opacity * 0.5;
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
        } else if (s.shape === "dashed-line") {
          ctx.setLineDash([s.width * 2, s.width * 2]);
          ctx.moveTo(sx, sy);
          ctx.lineTo(ex, ey);
        } else if (s.shape === "rect") {
          ctx.strokeRect(sx, sy, ex - sx, ey - sy);
        } else if (s.shape === "circle") {
          const radius = Math.hypot(ex - sx, ey - sy);
          ctx.arc(sx, sy, radius, 0, Math.PI * 2);
        }
        ctx.stroke();
        ctx.setLineDash([]); // Reset dash for next strokes
      } else if (s.points.length > 0) {
        if (s.tool === "spray") {
          // Optimized spray
          const density = Math.min(20, Math.floor(s.width * 2));
          s.points.forEach(p => {
            for (let i = 0; i < density; i++) {
              const offsetX = (Math.random() - 0.5) * s.width * 4;
              const offsetY = (Math.random() - 0.5) * s.width * 4;
              ctx.fillStyle = drawColor;
              ctx.fillRect(p.x * width + offsetX, p.y * height + offsetY, 1, 1);
            }
          });
        } else if (!isSmoothing || s.points.length < 3) {
          ctx.beginPath();
          ctx.moveTo(s.points[0].x * width, s.points[0].y * height);
          for (let i = 1; i < s.points.length; i++) {
            ctx.lineTo(s.points[i].x * width, s.points[i].y * height);
          }
          ctx.stroke();
        } else {
          // Continuous smoothed path without repeated stroke() calls to prevent alpha dots
          let startP = s.points[0];
          let nextP = s.points[1];
          let prevMidX = (startP.x + nextP.x) / 2 * width;
          let prevMidY = (startP.y + nextP.y) / 2 * height;

          ctx.beginPath();
          ctx.lineWidth = s.width; // Use a constant width for the stroke
          ctx.moveTo(startP.x * width, startP.y * height);
          ctx.lineTo(prevMidX, prevMidY);

          for (let i = 1; i < s.points.length - 1; i++) {
            const p1 = s.points[i];
            const p2 = s.points[i + 1];
            
            const xc = (p1.x + p2.x) / 2 * width;
            const yc = (p1.y + p2.y) / 2 * height;
            
            ctx.quadraticCurveTo(p1.x * width, p1.y * height, xc, yc);

            prevMidX = xc;
            prevMidY = yc;
          }

          // Cap the stroke
          const lastPoint = s.points[s.points.length - 1];
          ctx.lineTo(lastPoint.x * width, lastPoint.y * height);
          ctx.stroke();
        }
      }
      ctx.restore();
  };

  const runRenderCycle = (ctx: CanvasRenderingContext2D, s: Stroke, width: number, height: number) => {
    renderStroke(ctx, width, height, s);
    if (isMirrorMode) renderStroke(ctx, width, height, s, { mirror: true });
    if (radialSymmetry > 0) {
      const angle = (Math.PI * 2) / radialSymmetry;
      for (let i = 1; i < radialSymmetry; i++) {
        renderStroke(ctx, width, height, s, { rotation: angle * i });
      }
    }
  };

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

    strokesRef.current.forEach(s => runRenderCycle(ctx, s, width, height));
  };

  // Draw ONLY active stroke
  const drawActiveStroke = () => {
    const canvas = activeCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const width = canvas.width / (window.devicePixelRatio || 1);
    const height = canvas.height / (window.devicePixelRatio || 1);
    
    // Clear only this active frame
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    if (isDrawing && currentPathRef.current.length > 0) {
      const activeStroke = {
        points: currentPathRef.current,
        color: currentColor,
        width: currentWidth,
        opacity: currentOpacity,
        tool: currentTool,
        shape: currentShape
      };
      runRenderCycle(ctx, activeStroke, width, height);
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
    
    lastPointTimeRef.current = Date.now();
    lastSpeedRef.current = 1;

    // Trigger faint haptic
    triggerHaptic();
    drawActiveStroke();
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

        // Velocity tracking for dynamic width
        const now = Date.now();
        const timeDiff = now - lastPointTimeRef.current;
        const speed = timeDiff > 0 ? (dist / timeDiff) * 1000 : 0;
        
        // Smoothing speed transitions
        const smoothedSpeed = (speed * 0.3) + (lastSpeedRef.current * 0.7);
        lastSpeedRef.current = smoothedSpeed;
        lastPointTimeRef.current = now;
      }
      
      currentPathRef.current.push(coords);
    }
    
    // Draw only active stroke using requestAnimationFrame structure (or direct sync if lightweight)
    drawActiveStroke();
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
    
    // Clear active stroke overlay to prevent ghosting before React commits
    if (activeCanvasRef.current) activeCanvasRef.current.getContext('2d')?.clearRect(0,0, activeCanvasRef.current.width, activeCanvasRef.current.height);
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

  const handleConfirmSaveToScrapbook = async (isVault: boolean = false) => {
    const canvas = canvasRef.current;
    if (!canvas || !roomId || !user) return;

    try {
      setIsSavingToScrapbook(true);

      // 1. Convert current canvas element into high quality PNG base64 representation
      const dataUrl = canvas.toDataURL("image/png");

      // 2. Encrypt contents with App E2EE
      const encryptedContent = await encryptData(dataUrl);
      const encryptedCaption = await encryptData(doodleTitle.trim() || (isVault ? "🔒 Secret Artwork" : "Our Romantic Drawing 🎨🐾"));

      // 3. Store to selected collection (timeline or vault)
      const collectionName = isVault ? "vault" : "timeline";
      const docRef = collection(db, "pairs", roomId, collectionName);
      
      await addDoc(docRef, {
        type: "photo",
        content: encryptedContent,
        caption: encryptedCaption,
        createdAt: serverTimestamp(),
        userId: user.uid,
        stickers: [], 
        isLocked: isVault
      });

      sensory.success();
      setIsSavingToScrapbook(false);
      setShowSaveModal(false);
      setDoodleTitle("");

      alert(isVault ? "Art moved to the Locked Vault! 🔐" : "Successfully saved to Our Scrapbook! 🥳💖");
    } catch (err) {
      console.error(err);
      setIsSavingToScrapbook(false);
      alert("Failed to save art 💔");
    }
  };

  return (
    <div className="flex flex-col h-screen bg-[#fafaf9] dark:bg-[#0c0a15] transition-colors relative select-none overflow-hidden">
      
      {/* MINIMAL TOP HUD */}
      <AnimatePresence>
        {!isDrawing && (
          <motion.div 
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -20, opacity: 0 }}
            className="px-4 py-3 flex items-center justify-between z-50 absolute top-0 inset-x-0 pointer-events-none"
          >
            <div className="flex items-center gap-3 pointer-events-auto">
              <button
                onClick={() => { triggerHaptic(); if (onClose) onClose(); else setView("home"); }}
                className="w-10 h-10 flex items-center justify-center rounded-2xl bg-white/80 dark:bg-card/80 backdrop-blur-xl text-text border border-border/50 shadow-lg active:scale-95 transition-all"
              >
                <ArrowLeft size={18} />
              </button>
              
              <div className="hidden sm:flex flex-col">
                <span className="text-[10px] font-black tracking-widest text-text/40 uppercase">Canvas Studio</span>
                <span className="text-xs font-bold text-text">Creative Mode</span>
              </div>
            </div>

            <div className="flex items-center gap-2 pointer-events-auto">
              <button
                onClick={handleUndo}
                disabled={strokes.length === 0}
                className={`w-10 h-10 flex items-center justify-center rounded-2xl bg-white/80 dark:bg-card/80 backdrop-blur-xl border border-border/50 shadow-lg transition-all ${
                  strokes.length > 0 ? "text-text active:scale-95" : "text-text/20"
                }`}
              >
                <Undo size={18} />
              </button>

              <button
                onClick={handleFinalSend}
                className="px-6 h-10 bg-primary text-white rounded-2xl text-xs font-black uppercase tracking-widest flex items-center gap-2 active:scale-95 transition-all shadow-xl shadow-primary/20"
              >
                {onSend ? "Post" : "Save"}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* IMMERSIVE CANVAS */}
      <div 
        ref={containerRef}
        className="flex-1 w-full h-full relative"
        style={{ cursor: currentTool === "eraser" ? "cell" : "crosshair" }}
      >
        <canvas
          ref={canvasRef}
          className="absolute inset-0 block w-full h-full pointer-events-none"
        />
        <canvas
          ref={activeCanvasRef}
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
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 0.1, scale: 1 }}
              className="flex flex-col items-center gap-6"
            >
              <Zap size={140} strokeWidth={1} />
              <div className="text-center">
                <h3 className="font-display font-black text-5xl italic tracking-tighter text-text uppercase">Creative Pad</h3>
                <p className="font-medium text-lg text-text">Thumb-mode optimized</p>
              </div>
            </motion.div>
          </div>
        )}
      </div>

      {/* MOBILE-OPTIMIZED BOTTOM TOOL DECK */}
      <AnimatePresence>
        {!isDrawing && (
          <motion.div 
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 50, opacity: 0 }}
            className="absolute bottom-6 inset-x-4 z-50 flex flex-col gap-4 pointer-events-none"
          >
            
            {/* EXPANDABLE SETTINGS TRAY */}
            <AnimatePresence mode="wait">
              {activeTab === "tools" && (
                <motion.div 
                  key="tools"
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: 20, opacity: 0 }}
                  className="bg-white/90 dark:bg-card/90 backdrop-blur-2xl p-4 rounded-[2.5rem] border border-border/50 shadow-2xl pointer-events-auto flex flex-col gap-5 max-w-2xl mx-auto w-full"
                >
                  {/* Tool Selection Row */}
                  <div className="grid grid-cols-5 gap-2">
                    {[
                      { id: "pencil", icon: <Pen size={18} />, label: "Pen" },
                      { id: "brush", icon: <Palette size={18} />, label: "Brush" },
                      { id: "spray", icon: <Sparkles size={18} />, label: "Spray" },
                      { id: "neon", icon: <Zap size={18} />, label: "Neon" },
                      { id: "eraser", icon: <Trash2 size={18} />, label: "Erase" }
                    ].map((t) => (
                      <button
                        key={t.id}
                        onClick={() => { triggerHaptic(); setCurrentTool(t.id as any); setCurrentShape("none"); }}
                        className={`flex flex-col items-center gap-1 p-2 rounded-2xl transition-all ${
                          currentTool === t.id && currentShape === "none" ? "bg-primary text-white shadow-lg scale-105" : "text-text/40 hover:bg-slate-100 dark:hover:bg-white/5"
                        }`}
                      >
                        {t.icon}
                        <span className="text-[8px] font-black uppercase tracking-tighter">{t.label}</span>
                      </button>
                    ))}
                  </div>

                  {/* Shapes Row */}
                  <div className="flex items-center gap-2 px-2">
                    <span className="text-[10px] font-black uppercase text-text/30 mr-2">Shapes</span>
                    {[
                      { id: "none", icon: <Pen size={18} />, label: "Freehand Pen", title: "Freehand" },
                      { id: "line", icon: <div className="w-5 h-0.5 bg-current" />, title: "Straight Line" },
                      { id: "dashed-line", icon: <div className="w-5 h-0.5 bg-current border-b border-dashed border-white" style={{ background: 'repeating-linear-gradient(90deg, currentColor, currentColor 4px, transparent 4px, transparent 8px)' }} />, title: "Dashed Line" },
                      { id: "rect", icon: <Square size={18} />, title: "Square" },
                      { id: "circle", icon: <Circle size={18} />, title: "Circle" }
                    ].map((s) => (
                      <button
                        key={s.id}
                        onClick={() => { triggerHaptic(); setCurrentShape(s.id as any); if (s.id !== "none" && currentTool === "eraser") setCurrentTool("brush"); }}
                        className={`flex-1 h-12 rounded-2xl flex items-center justify-center transition-all ${
                          currentShape === s.id ? "bg-indigo-500 text-white shadow-md active:scale-95" : "text-text/30 hover:bg-slate-100 dark:hover:bg-white/5"
                        }`}
                        title={s.title || ""}
                      >
                        {s.icon}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}

              {activeTab === "colors" && (
                <motion.div 
                  key="colors"
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: 20, opacity: 0 }}
                  className="bg-white/90 dark:bg-card/90 backdrop-blur-2xl p-5 rounded-[2.5rem] border border-border/50 shadow-2xl pointer-events-auto max-w-2xl mx-auto w-full"
                >
                  <div className="flex flex-wrap justify-center gap-3">
                    {COLORS.map((color) => (
                      <button
                        key={color.hex}
                        onClick={() => { triggerHaptic(); setCurrentColor(color.hex); if (currentTool === "eraser") setCurrentTool("brush"); }}
                        className={`w-11 h-11 rounded-full shrink-0 transition-all active:scale-125 ${
                          currentColor === color.hex ? "scale-125 ring-2 ring-primary ring-offset-2 dark:ring-offset-slate-900 shadow-xl" : "opacity-90 hover:opacity-100"
                        }`}
                        style={{ backgroundColor: color.hex }}
                      />
                    ))}
                  </div>
                </motion.div>
              )}

              {activeTab === "settings" && (
                <motion.div 
                  key="settings"
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: 20, opacity: 0 }}
                  className="bg-white/90 dark:bg-card/90 backdrop-blur-2xl p-6 rounded-[2.5rem] border border-border/50 shadow-2xl pointer-events-auto flex flex-col gap-6 max-w-2xl mx-auto w-full"
                >
                  {/* Sliders Area */}
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex justify-between text-[10px] font-black uppercase text-text/40">
                        <span>Brush Size</span>
                        <span>{currentWidth}px</span>
                      </div>
                      <input
                        type="range"
                        min="1" max="60" step="1"
                        value={currentWidth}
                        onChange={(e) => setCurrentWidth(Number(e.target.value))}
                        className="w-full accent-primary h-2 bg-slate-100 dark:bg-white/5 rounded-full appearance-none cursor-pointer"
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-[10px] font-black uppercase text-text/40">
                        <span>Opacity</span>
                        <span>{Math.round(currentOpacity*100)}%</span>
                      </div>
                      <input
                        type="range"
                        min="0.1" max="1" step="0.05"
                        value={currentOpacity}
                        onChange={(e) => setCurrentOpacity(Number(e.target.value))}
                        className="w-full accent-indigo-500 h-2 bg-slate-100 dark:bg-white/5 rounded-full appearance-none cursor-pointer"
                      />
                    </div>
                  </div>

                  {/* Toggles & Symmetry */}
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => { triggerHaptic(); setShowGrid(!showGrid); }}
                      className={`flex items-center gap-3 p-4 rounded-3xl transition-all border ${
                        showGrid ? "bg-emerald-500/10 border-emerald-500 text-emerald-600" : "bg-slate-50 dark:bg-white/5 border-transparent text-text/40"
                      }`}
                    >
                      <Grid size={18} />
                      <span className="text-xs font-bold">Show Grid</span>
                    </button>
                    <button
                      onClick={() => { triggerHaptic(); setIsSmoothing(!isSmoothing); }}
                      className={`flex items-center gap-3 p-4 rounded-3xl transition-all border ${
                        isSmoothing ? "bg-amber-500/10 border-amber-500 text-amber-600" : "bg-slate-50 dark:bg-white/5 border-transparent text-text/40"
                      }`}
                    >
                      <Zap size={18} />
                      <span className="text-xs font-bold">Smoothing</span>
                    </button>
                  </div>

                  <div className="bg-slate-50 dark:bg-white/5 p-4 rounded-3xl space-y-3">
                    <span className="text-[10px] font-black uppercase text-text/30">Symmetry Mode</span>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { id: "off", icon: <Minimize2 size={16} />, label: "Off", action: () => { setIsMirrorMode(false); setRadialSymmetry(0); } },
                        { id: "mirror", icon: <Columns2 size={16} />, label: "Mirror", action: () => { setIsMirrorMode(true); setRadialSymmetry(0); } },
                        { id: "radial", icon: <Hash size={16} />, label: "Radial (6)", action: () => { setIsMirrorMode(false); setRadialSymmetry(6); } }
                      ].map(s => (
                        <button
                          key={s.id}
                          onClick={() => { triggerHaptic(); s.action(); }}
                          className={`flex flex-col items-center gap-1.5 p-2 rounded-2xl transition-all ${
                            (s.id === "off" && !isMirrorMode && radialSymmetry === 0) ||
                            (s.id === "mirror" && isMirrorMode) ||
                            (s.id === "radial" && radialSymmetry === 6)
                              ? "bg-primary text-white shadow-md"
                              : "text-text/40 hover:bg-slate-200 dark:hover:bg-white/10"
                          }`}
                        >
                          {s.icon}
                          <span className="text-[9px] font-bold">{s.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Background Color */}
                  <div className="flex items-center gap-3">
                     <span className="text-[10px] font-black uppercase text-text/30">Background</span>
                     <div className="flex-1 flex overflow-x-auto gap-2 no-scrollbar">
                        {BG_COLORS.map(bg => (
                          <button
                            key={bg}
                            onClick={() => { triggerHaptic(); setCanvasBg(bg); }}
                            className={`w-8 h-8 rounded-full shrink-0 border-2 transition-all ${
                              canvasBg === bg ? "border-primary scale-110" : "border-transparent"
                            }`}
                            style={{ backgroundColor: bg }}
                          />
                        ))}
                     </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* PRIMARY NAVIGATION TIER */}
            <div className="bg-white/80 dark:bg-card/90 backdrop-blur-3xl p-2 rounded-[3rem] border border-border/50 shadow-2xl flex items-center gap-2 pointer-events-auto max-w-lg mx-auto w-full">
              {[
                { id: "tools", icon: <Pen size={20} />, label: "Canvas" },
                { id: "colors", icon: <Palette size={20} />, label: "Palette" },
                { id: "settings", icon: <Activity size={20} />, label: "Alchemy" }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => { triggerHaptic(); setActiveTab(tab.id as any); }}
                  className={`flex-1 h-14 rounded-[2.5rem] flex items-center justify-center gap-3 transition-all ${
                    activeTab === tab.id ? "bg-primary text-white shadow-xl scale-[1.02]" : "text-text/40 hover:bg-slate-100 dark:hover:bg-white/5"
                  }`}
                >
                  {tab.icon}
                  <span className="text-xs font-black uppercase tracking-tighter hidden sm:inline">{tab.label}</span>
                </button>
              ))}
              <div className="w-px h-8 bg-border/40 mx-1" />
              <button
                onClick={handleClear}
                className="w-14 h-14 rounded-full flex items-center justify-center text-rose-500 hover:bg-rose-500/10 transition-colors"
              >
                <Trash2 size={20} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
                  onClick={() => handleConfirmSaveToScrapbook(false)}
                  disabled={isSavingToScrapbook}
                  className="flex-1 py-4 bg-primary/10 text-primary text-[10px] font-black uppercase tracking-widest rounded-2xl hover:bg-primary/20 transition-all flex flex-col items-center gap-1"
                >
                  <Heart size={16} />
                  Memories
                </button>
                <button
                  type="button"
                  onClick={() => handleConfirmSaveToScrapbook(true)}
                  disabled={isSavingToScrapbook}
                  className="flex-1 py-4 bg-indigo-500 text-white text-[10px] font-black uppercase tracking-widest rounded-2xl hover:bg-indigo-600 active:scale-95 transition-all shadow-lg flex flex-col items-center gap-1"
                >
                  <Lock size={16} />
                  Vault
                </button>
              </div>

              <button
                type="button"
                onClick={() => setShowSaveModal(false)}
                className="w-full text-[10px] font-bold text-text/30 uppercase tracking-widest py-2"
              >
                Cancel
              </button>
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
