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

export function DoodleScreen() {
  const { setView, roomId, user, partner } = useAppStore((state) => ({
    setView: state.setView,
    roomId: state.roomId,
    user: state.user,
    partner: state.partner,
  }));

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [currentColor, setCurrentColor] = useState("#f43f5e"); // Pink/sakura default
  const [currentWidth, setCurrentWidth] = useState(4);
  const [currentTool, setCurrentTool] = useState<"brush" | "eraser">("brush");
  const [isDrawing, setIsDrawing] = useState(false);
  
  // Status states
  const [syncStatus, setSyncStatus] = useState<"idle" | "saving" | "synced">("synced");
  const [partnerStatus, setPartnerStatus] = useState<string | null>(null);
  
  // Scrapbook saving modal
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [doodleTitle, setDoodleTitle] = useState("");
  const [isSavingToScrapbook, setIsSavingToScrapbook] = useState(false);

  // Refs for tracking active coordinates and Firestore synchronizations
  const strokesRef = useRef<Stroke[]>([]);
  strokesRef.current = strokes;
  const currentPathRef = useRef<{ x: number; y: number }[]>([]);
  const lastWriteTimeRef = useRef<number>(0);
  const lastSyncHashRef = useRef<string>("");
  const writeDebounceTimerRef = useRef<any>(null);

  // Sound and Haptics comfort helper
  const triggerHaptic = () => {
    sensory.tap();
  };

  // Cute color palette
  const COLORS = [
    { name: "Sakura", hex: "#f43f5e" },
    { name: "Pink", hex: "#ec4899" },
    { name: "Lavender", hex: "#a855f7" },
    { name: "Cornflower", hex: "#3b82f6" },
    { name: "Mint", hex: "#10b981" },
    { name: "Sunny", hex: "#eab308" },
    { name: "Peach", hex: "#f97316" },
    { name: "Soot", hex: "#0f172a" },
  ];

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

    // Draw all completed strokes
    strokesRef.current.forEach((stroke) => {
      if (stroke.points.length < 1) return;
      ctx.beginPath();
      const firstPoint = stroke.points[0];
      ctx.moveTo(firstPoint.x * width, firstPoint.y * height);

      stroke.points.forEach((point) => {
        ctx.lineTo(point.x * width, point.y * height);
      });

      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.width;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.stroke();
    });

    // Draw current active stroke
    if (isDrawing && currentPathRef.current.length > 0) {
      ctx.beginPath();
      const firstPoint = currentPathRef.current[0];
      ctx.moveTo(firstPoint.x * width, firstPoint.y * height);

      currentPathRef.current.forEach((point) => {
        ctx.lineTo(point.x * width, point.y * height);
      });

      ctx.strokeStyle = currentTool === "eraser" ? "#ffffff" : currentColor;
      ctx.lineWidth = currentWidth;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.stroke();
    }
  };

  // Subscribe to real-time additions securely
  useEffect(() => {
    if (!roomId) return;

    setSyncStatus("idle");
    const syncDocRef = doc(db, "pairs", roomId, "doodle_canvas", "current");

    const unsubscribe = onSnapshot(syncDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        
        // Listen to others drawing activity status
        if (data.drawingUser && data.drawingUser !== user?.uid) {
          const name = partner?.nickname || "Your partner";
          setPartnerStatus(`${name} is sketching... ✏️`);
        } else {
          setPartnerStatus(null);
        }

        // De-serialize and verify coordinates to prevent re-drawing if we're active
        if (data.strokesHash && data.strokesHash === lastSyncHashRef.current) {
          setSyncStatus("synced");
          return;
        }

        if (data.strokes) {
          setStrokes(data.strokes);
          lastSyncHashRef.current = data.strokesHash || "";
          setSyncStatus("synced");
        }
      } else {
        // Initial setup for the pair's canvas
        setDoc(syncDocRef, {
          strokes: [],
          strokesHash: "empty",
          updatedAt: Date.now(),
        });
      }
    });

    return () => {
      unsubscribe();
      if (writeDebounceTimerRef.current) clearTimeout(writeDebounceTimerRef.current);
    };
  }, [roomId, partner]);

  // Highly optimized write synchronization helper
  const syncToFirestore = async (updatedStrokes: Stroke[], isDrawingActive: boolean = false) => {
    if (!roomId) return;

    if (writeDebounceTimerRef.current) {
      clearTimeout(writeDebounceTimerRef.current);
    }

    setSyncStatus("saving");

    // Compute a lightweight representation hash to optimize checks back and forth
    const compactString = JSON.stringify(updatedStrokes);
    const strokesHash = btoa(encodeURIComponent(compactString)).slice(0, 32);
    lastSyncHashRef.current = strokesHash;

    const performWrite = async () => {
      try {
        const syncDocRef = doc(db, "pairs", roomId, "doodle_canvas", "current");
        await setDoc(
          syncDocRef,
          {
            strokes: updatedStrokes,
            strokesHash,
            updatedAt: Date.now(),
            drawingUser: isDrawingActive ? (user?.uid || "") : "",
          },
          { merge: true }
        );
        setSyncStatus("synced");
      } catch (err) {
        console.error("Firestore sync error:", err);
      }
    };

    // If drawing is going on, we debounce. If stroke is completed (drawing finish), we write immediately
    if (isDrawingActive) {
      writeDebounceTimerRef.current = setTimeout(performWrite, 1800);
    } else {
      await performWrite();
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
      clientX = e.nativeEvent.touches[0].clientX;
      clientY = e.nativeEvent.touches[0].clientY;
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

    // Notify partner that drawing is in progress
    syncToFirestore(strokesRef.current, true);
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
      // Optimize out extremely redundant adjacent pixel writes
      if (dist < 0.003) return;
    }

    currentPathRef.current.push(coords);
    drawStrokesOnCanvas();

    // Slow and optimized drawing debounce update to partner
    const timeNow = Date.now();
    if (timeNow - lastWriteTimeRef.current > 2000) {
      lastWriteTimeRef.current = timeNow;
      // Temporary stroke bundled on-fly (optimistic merge to partner)
      const mockStroke: Stroke = {
        points: currentPathRef.current,
        color: currentTool === "eraser" ? "#ffffff" : currentColor,
        width: currentWidth,
      };
      syncToFirestore([...strokesRef.current, mockStroke], true);
    }
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

      const updatedStrokes = [...strokes, newStroke];
      setStrokes(updatedStrokes);
      currentPathRef.current = [];

      // Safe immediate push on stroke completion
      syncToFirestore(updatedStrokes, false);
    } else {
      currentPathRef.current = [];
      // Clean presence indicator
      syncToFirestore(strokesRef.current, false);
    }
  };

  // Canvas Actions
  const handleUndo = () => {
    if (strokes.length === 0) return;
    triggerHaptic();
    const updated = strokes.slice(0, -1);
    setStrokes(updated);
    syncToFirestore(updated, false);
  };

  const handleClear = () => {
    if (strokes.length === 0) return;
    if (window.confirm("Are you sure you want to clear the canvas? This clears it for your partner too!")) {
      sensory.alert();
      setStrokes([]);
      syncToFirestore([], false);
    }
  };

  // Save the Canvas Drawing directly into the shared scrapbook!
  const saveToScrapbook = async () => {
    if (strokes.length === 0) {
      alert("Please draw something before saving 🎨");
      return;
    }

    setShowSaveModal(true);
    triggerHaptic();
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
              setView("home");
            }}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-text transition-all"
            title="Go home"
          >
            <ArrowLeft size={16} />
          </button>
          
          <div className="flex flex-col">
            <span className="text-xs font-black tracking-tight text-text">Doodle Pad</span>
            <span className="text-[9px] font-bold uppercase tracking-widest text-text/40">Canvas Shared</span>
          </div>
        </div>

        {/* Sync Indicator */}
        <div className="flex items-center gap-1.5 bg-neutral-100 dark:bg-white/5 px-2.5 py-1 rounded-full border border-border/20 text-[9px] font-bold">
          <div
            className={`w-1.5 h-1.5 rounded-full ${
              syncStatus === "synced"
                ? "bg-emerald-500 animate-pulse"
                : syncStatus === "saving"
                ? "bg-amber-500 animate-spin"
                : "bg-slate-300"
            }`}
          />
          <span className="text-text/60 font-sans tracking-wide">
            {syncStatus === "synced" ? "Synced" : syncStatus === "saving" ? "Sharing..." : "Connecting"}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Timeline Saver */}
          <button
            onClick={saveToScrapbook}
            className="px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary rounded-xl border border-primary/20 text-[10px] font-bold flex items-center gap-1 active:scale-95 transition-all"
            title="Save to Memory Box"
          >
            <Camera size={12} /> Save
          </button>
          <button
            onClick={handleClear}
            className="w-8 h-8 flex items-center justify-center text-text/40 hover:text-rose-500 rounded-lg hover:bg-rose-500/10 transition-colors"
            title="Clear board"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      {/* Partner Typing / Drawing indicators */}
      <AnimatePresence>
        {partnerStatus && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-16 left-1/2 -translate-x-1/2 z-40 bg-pink/90 text-white text-[10px] px-3.5 py-1 rounded-full shadow-md font-bold tracking-tight backdrop-blur-xs flex items-center gap-1.5 border border-white/20"
          >
            <Sparkles size={11} className="animate-spin text-amber-200" />
            {partnerStatus}
          </motion.div>
        )}
      </AnimatePresence>

      {/* DRAWING BOARD AREA */}
      <div 
        ref={containerRef}
        className="flex-1 w-full relative bg-white dark:bg-[#0c0a15] overflow-hidden border-b border-border/20 touch-none shadow-inner"
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
          <div className="absolute inset-x-8 top-1/3 -translate-y-1/2 pointer-events-none text-center flex flex-col items-center select-none opacity-30 select-none">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-4 animate-bounce">
              <Palette size={28} />
            </div>
            <h3 className="font-semibold text-text text-sm mb-1">Our Cozy Drawing Book</h3>
            <p className="text-xs text-text max-w-xs leading-relaxed">
              Sketch lovely hearts, notes, or pet names together in real-time. Everything syncs instantly with loved ones!
            </p>
          </div>
        )}
      </div>

      {/* TOOLBAR CONTROLS */}
      <div className="px-4 py-4 bg-white/90 dark:bg-card/90 shadow-[0_-4px_20px_rgba(0,0,0,0.03)] border-t border-border/40 flex flex-col gap-3">
        {/* Row 1: Brush size weights & Eraser & Undo */}
        <div className="flex items-center justify-between">
          {/* Tool selectors */}
          <div className="flex items-center bg-slate-100 dark:bg-white/5 p-1 rounded-xl gap-1">
            <button
              onClick={() => {
                triggerHaptic();
                setCurrentTool("brush");
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                currentTool === "brush"
                  ? "bg-white dark:bg-neutral-800 text-primary shadow-xs"
                  : "text-text/50 hover:text-text"
              }`}
            >
              Brush
            </button>
            <button
              onClick={() => {
                triggerHaptic();
                setCurrentTool("eraser");
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                currentTool === "eraser"
                  ? "bg-white dark:bg-neutral-800 text-rose-500 shadow-xs"
                  : "text-text/50 hover:text-text"
              }`}
            >
              Eraser
            </button>
          </div>

          {/* Sizing Weight Indicators */}
          <div className="flex items-center gap-3">
            {[2, 4, 8, 14].map((size) => (
              <button
                key={size}
                onClick={() => {
                  triggerHaptic();
                  setCurrentWidth(size);
                }}
                className={`w-7 h-7 rounded-full flex items-center justify-center border transition-all ${
                  currentWidth === size
                    ? "border-primary bg-primary/10"
                    : "border-transparent bg-slate-100 dark:bg-white/5 text-text/40"
                }`}
                title={`Brush size ${size}`}
              >
                <div
                  className="rounded-full bg-slate-800 dark:bg-slate-200"
                  style={{ width: `${Math.max(2, size)}px`, height: `${Math.max(2, size)}px` }}
                />
              </button>
            ))}
          </div>

          {/* Undo action button */}
          <button
            onClick={handleUndo}
            disabled={strokes.length === 0}
            className={`w-9 h-9 rounded-full flex items-center justify-center border transition-all ${
              strokes.length > 0
                ? "bg-slate-100 dark:bg-white/5 text-text border-border hover:bg-slate-200"
                : "text-text/20 border-transparent cursor-not-allowed opacity-40"
            }`}
            title="Undo"
          >
            <Undo size={14} />
          </button>
        </div>

        {/* Row 2: Colorful paint selections */}
        {currentTool === "brush" && (
          <div className="flex items-center justify-between gap-1 overflow-x-auto py-1 no-scrollbar select-none">
            {COLORS.map((color) => (
              <button
                key={color.hex}
                onClick={() => {
                  triggerHaptic();
                  setCurrentColor(color.hex);
                }}
                className={`w-8 h-8 rounded-full shrink-0 flex items-center justify-center transition-all ${
                  currentColor === color.hex && currentTool === "brush"
                    ? "scale-110 ring-2 ring-primary ring-offset-2 dark:ring-offset-slate-900"
                    : "hover:scale-105"
                }`}
                style={{ backgroundColor: color.hex }}
                title={color.name}
              >
                {currentColor === color.hex && currentTool === "brush" && (
                  <div className="w-1.5 h-1.5 rounded-full bg-white shadow-xs" />
                )}
              </button>
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
    </div>
  );
}
