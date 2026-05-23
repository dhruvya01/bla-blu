import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Trophy, XCircle, Flame, Star, Zap } from 'lucide-react';
import { sensory } from '../utils/sensory';
import { cn } from '../utils';

const TOYS = ['🧸', '🚗', '🎨', '🧩', '🎈', '🦖', '🚀', '🦆', '⚽', '🦄'];
const BAD_ITEMS = ['💩', ' mud ', '🕷️', '🍅', '🧦']; // Some dirty visual emojis
const SPECIAL_ITEMS = ['⭐', '💎']; // Bonus points

type GameItem = {
  id: number;
  x: number;
  y: number;
  emoji: string;
  type: 'good' | 'bad' | 'special';
  speed: number;
};

type FloatingText = {
  id: number;
  x: number;
  y: number;
  text: string;
  color: string;
};

export function PlayMinigame({ onExit }: { onExit: (dirtAmount: number, coinsEarned: number) => void }) {
  const [activeItems, setActiveItems] = useState<GameItem[]>([]);
  const [floatingTexts, setFloatingTexts] = useState<FloatingText[]>([]);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [multiplier, setMultiplier] = useState(1);
  const [timeLeft, setTimeLeft] = useState(45);
  const [isPlaying, setIsPlaying] = useState(false);
  const [gameState, setGameState] = useState<'idle' | 'playing' | 'gameover'>('idle');
  
  const gameAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (gameState !== 'playing') return;
    const int = setInterval(() => {
      setTimeLeft(p => {
        if (p <= 1) {
          setGameState('gameover');
          // Calculate dirt and coins
          const dirtAmount = Math.max(15, Math.floor(score / 2));
          const coinsEarned = Math.floor(score / 5);
          setTimeout(() => onExit(dirtAmount, coinsEarned), 3500);
          return 0;
        }
        return p - 1;
      });
    }, 1000);
    return () => clearInterval(int);
  }, [gameState, score, onExit]);

  useEffect(() => {
    if (gameState !== 'playing') return;
    
    // As score goes up, spawn rate increases
    const spawnRate = Math.max(300, 1000 - score * 10);
    
    const int = setInterval(() => {
      setActiveItems(prev => {
        if (prev.length > 8) return prev; // max 8 items
        
        const rand = Math.random();
        let type: 'good' | 'bad' | 'special' = 'good';
        let emoji = TOYS[Math.floor(Math.random() * TOYS.length)];
        let speedMultiplier = 1;
        
        if (rand < 0.15) {
          type = 'bad';
          emoji = BAD_ITEMS[Math.floor(Math.random() * BAD_ITEMS.length)];
          speedMultiplier = 1.2;
        } else if (rand > 0.95) {
          type = 'special';
          emoji = SPECIAL_ITEMS[Math.floor(Math.random() * SPECIAL_ITEMS.length)];
          speedMultiplier = 1.5;
        }

        const baseSpeed = 2.5 + (score / 40);

        return [
          ...prev,
          {
            id: Date.now() + Math.random(),
            x: 10 + Math.random() * 80, // %
            y: -20, // start above
            emoji,
            type,
            speed: baseSpeed * speedMultiplier
          }
        ];
      });
    }, spawnRate);
    
    return () => clearInterval(int);
  }, [gameState, score]);

  const addFloatingText = (x: number, y: number, text: string, color: string) => {
    const id = Date.now();
    setFloatingTexts(prev => [...prev, { id, x, y, text, color }]);
    setTimeout(() => {
      setFloatingTexts(prev => prev.filter(t => t.id !== id));
    }, 1000);
  };

  const tapItem = (item: GameItem, e: React.PointerEvent) => {
    if (gameState !== 'playing') return;
    
    const rect = gameAreaRef.current?.getBoundingClientRect();
    const touchX = rect ? ((e.clientX - rect.left) / rect.width) * 100 : item.x;
    const touchY = rect ? ((e.clientY - rect.top) / rect.height) * 100 : 50;

    if (item.type === 'good') {
      sensory.play("pop");
      const points = 1 * multiplier;
      setScore(s => s + points);
      setCombo(c => {
        const newCombo = c + 1;
        if (newCombo % 5 === 0 && multiplier < 5) {
          setMultiplier(m => m + 1);
          sensory.play("sparkle");
          addFloatingText(touchX, touchY - 10, "Combo Up!", "text-purple-500");
        }
        return newCombo;
      });
      addFloatingText(touchX, touchY, `+${points}`, "text-emerald-500");
    } else if (item.type === 'bad') {
      sensory.play("error");
      const penalty = 5;
      setScore(s => Math.max(0, s - penalty));
      setCombo(0);
      setMultiplier(1);
      addFloatingText(touchX, touchY, `-${penalty}`, "text-rose-500");
    } else if (item.type === 'special') {
      sensory.play("levelUp");
      const points = 10 * multiplier;
      setScore(s => s + points);
      setCombo(c => c + 2);
      addFloatingText(touchX, touchY, `+${points}!!`, "text-amber-500");
    }

    setActiveItems(prev => prev.filter(t => t.id !== item.id));
  };
  
  // Cleanup missed items
  useEffect(() => {
    if (gameState !== 'playing') return;
    const int = setInterval(() => {
      setActiveItems(prev => {
         const missed = prev.filter(item => item.type === 'special' && item.y > 100);
         // could penalize missed good items here if wanted
         return prev; 
      }); // Actually we let framer motion handle visual exit. To prevent leak:
    }, 2000);
    return () => clearInterval(int);
  }, [gameState]);

  if (gameState === 'idle') {
    return (
      <div className="bg-card/80 backdrop-blur-sm border-2 border-primary/30 rounded-[32px] p-8 text-center shadow-lg relative overflow-hidden">
        <div className="absolute inset-0 bg-primary/5 pointer-events-none" />
        <motion.div animate={{ y: [0, -10, 0] }} transition={{ repeat: Infinity, duration: 2 }}>
          <span className="text-6xl mb-4 block">🎪</span>
        </motion.div>
        <h3 className="text-2xl font-black text-text mb-2 tracking-tight">Baby Play Time!</h3>
        <p className="text-sm text-text/70 font-medium mb-6">
          Catch toys and shiny stars! <br/> Avoid the muddy items! <br/> Build combos to multiply points.
        </p>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => { setGameState('playing'); sensory.play("levelUp"); }}
          className="w-full bg-gradient-to-r from-primary to-purple-500 text-white font-black text-lg py-4 rounded-[20px] shadow-lg shadow-primary/20"
        >
          START PLAYING
        </motion.button>
      </div>
    );
  }

  if (gameState === 'gameover') {
    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-card/90 backdrop-blur-md border-4 border-amber-400/50 rounded-[32px] p-8 text-center shadow-2xl relative overflow-hidden"
      >
        <span className="text-6xl mb-4 block animate-bounce">🎉</span>
        <h3 className="text-3xl font-black text-text mb-2">Time's Up!</h3>
        <div className="bg-bg/50 rounded-2xl p-4 mb-6 mt-4">
            <p className="text-lg font-bold text-text/60 mb-1">Final Score</p>
            <p className="text-5xl font-black text-emerald-500">{score}</p>
        </div>
        <p className="text-sm text-rose-500 font-bold flex items-center justify-center gap-2">
            <Flame size={16} /> Babies got super messy! <Flame size={16} />
        </p>
      </motion.div>
    );
  }

  return (
    <div 
      ref={gameAreaRef}
      className={cn(
        "bg-gradient-to-b from-bg to-primary/5 border-2 border-border rounded-[32px] p-4 text-center shadow-inner relative overflow-hidden h-[400px] touch-none select-none",
        multiplier >= 3 ? "border-amber-400/50 shadow-[inset_0_0_20px_rgba(251,191,36,0.2)]" : ""
      )}
    >
      {/* HUD */}
      <div className="absolute top-4 left-4 right-4 flex justify-between z-30 pointer-events-none">
        <div className="bg-bg/90 backdrop-blur-md px-4 py-2 rounded-2xl border border-border/50 shadow-sm flex items-center gap-2">
          <Trophy size={16} className="text-amber-500" />
          <span className="font-black text-lg text-text">{score}</span>
          
          {multiplier > 1 && (
            <motion.div 
              initial={{ scale: 0 }} 
              animate={{ scale: 1 }} 
              className="ml-2 bg-amber-400 text-amber-950 text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-0.5"
            >
              <Zap size={10} /> x{multiplier}
            </motion.div>
          )}
        </div>
        <div className="bg-bg/90 backdrop-blur-md px-4 py-2 rounded-2xl border border-border/50 shadow-sm flex items-center gap-2">
          <span className={cn("font-black text-lg", timeLeft <= 10 ? "text-rose-500 animate-pulse" : "text-text")}>
            {timeLeft}s
          </span>
        </div>
      </div>

      {/* Floating Texts */}
      <AnimatePresence>
        {floatingTexts.map(ft => (
          <motion.div
            key={ft.id}
            initial={{ opacity: 0, y: 0, scale: 0.5 }}
            animate={{ opacity: 1, y: -40, scale: 1.2 }}
            exit={{ opacity: 0 }}
            className={cn("absolute font-black text-xl z-40 pointer-events-none drop-shadow-md", ft.color)}
            style={{ left: `${ft.x}%`, top: `${ft.y}%`, transform: 'translate(-50%, -50%)' }}
          >
            {ft.text}
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Falling Items */}
      <AnimatePresence>
        {activeItems.map(item => (
          <motion.div
            key={item.id}
            initial={{ y: -50, scale: 0.5, rotate: -20 }}
            animate={{ y: 500, scale: 1, rotate: Math.random() * 360 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ duration: item.speed, ease: 'linear' }}
            onAnimationComplete={() => {
                setActiveItems(prev => prev.filter(t => t.id !== item.id));
                // Break combo if good item falls off screen
                if (item.type === 'good') {
                    setCombo(0);
                    setMultiplier(1);
                }
            }}
            onPointerDown={(e) => tapItem(item, e)}
            className="absolute text-5xl cursor-pointer touch-none z-20 hover:scale-110 active:scale-90"
            style={{ left: `${item.x}%`, filter: item.type === 'special' ? 'drop-shadow(0 0 10px rgba(251,191,36,0.8))' : 'none' }}
          >
            {item.emoji}
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Combo Background effects */}
      {multiplier >= 4 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.15 }}
          className="absolute inset-0 bg-gradient-to-t from-amber-400 to-transparent pointer-events-none z-0"
        />
      )}
    </div>
  );
}
