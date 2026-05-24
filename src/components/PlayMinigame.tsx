import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Trophy, XCircle, Flame, Star, Zap, Snowflake, Magnet } from 'lucide-react';
import { sensory } from '../utils/sensory';
import { cn } from '../utils';

const TOYS = ['🧸', '🚗', '🎨', '🧩', '🎈', '🦖', '🚀', '🦆', '⚽', '🦄'];
const BAD_ITEMS = ['💩', '🕷️', '🍅', '🧦', '🌪️']; // Some dirty visual emojis
const SPECIAL_ITEMS = ['⭐', '💎']; // Bonus points
const POWERUPS = [
  { id: 'freeze', emoji: '❄️', name: 'Freeze' },
  { id: 'magnet', emoji: '🧲', name: 'Magnet' },
];

type GameItem = {
  id: number;
  x: number;
  y: number;
  emoji: string;
  type: 'good' | 'bad' | 'special' | 'powerup' | 'boss';
  powerupId?: string;
  hp?: number; // for boss
  speed: number;
  curve: number; // For sine wave falling
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
  const [timeLeft, setTimeLeft] = useState(60);
  const [gameState, setGameState] = useState<'idle' | 'playing' | 'gameover'>('idle');
  
  const [activePowerup, setActivePowerup] = useState<'freeze' | 'magnet' | null>(null);
  const [powerupTime, setPowerupTime] = useState(0);

  const gameAreaRef = useRef<HTMLDivElement>(null);

  // Time and exit logic
  useEffect(() => {
    if (gameState !== 'playing') return;
    const int = setInterval(() => {
      setTimeLeft(p => {
        if (p <= 1) {
          setGameState('gameover');
          const dirtAmount = Math.max(15, Math.floor(score / 3));
          const coinsEarned = Math.floor(score / 5);
          setTimeout(() => onExit(dirtAmount, coinsEarned), 3500);
          return 0;
        }
        return p - 1;
      });
      // Handle powerup timers
      setPowerupTime(p => {
        if (p <= 1) {
          setActivePowerup(null);
          return 0;
        }
        return p - 1;
      });
    }, 1000);
    return () => clearInterval(int);
  }, [gameState, score, onExit]);

  // Magnet logic
  useEffect(() => {
    if (activePowerup === 'magnet' && gameState === 'playing') {
      const int = setInterval(() => {
        setActiveItems(prev => {
          const collectables = prev.filter(i => i.type === 'good' || i.type === 'special');
          if (collectables.length > 0) {
            const item = collectables[0];
            tapItem(item, null, true);
          }
          return prev;
        });
      }, 500);
      return () => clearInterval(int);
    }
  }, [activePowerup, gameState, multiplier]);

  // Spawner logic
  useEffect(() => {
    if (gameState !== 'playing') return;
    
    const spawnRate = Math.max(250, 900 - score * 8);
    
    const int = setInterval(() => {
      setActiveItems(prev => {
        if (prev.length > 12) return prev; // max 12 items on screen
        
        const rand = Math.random();
        let type: GameItem['type'] = 'good';
        let emoji = TOYS[Math.floor(Math.random() * TOYS.length)];
        let speedMultiplier = activePowerup === 'freeze' ? 10 : 1; // Slow down if frozen
        let powerupId = undefined;
        let hp = undefined;
        let scaleSize = 1;

        if (rand < 0.15) {
          type = 'bad';
          emoji = BAD_ITEMS[Math.floor(Math.random() * BAD_ITEMS.length)];
          speedMultiplier *= 1.2;
        } else if (rand > 0.96) {
          type = 'powerup';
          const p = POWERUPS[Math.floor(Math.random() * POWERUPS.length)];
          emoji = p.emoji;
          powerupId = p.id;
          speedMultiplier *= 0.8;
        } else if (rand > 0.92) {
          type = 'special';
          emoji = SPECIAL_ITEMS[Math.floor(Math.random() * SPECIAL_ITEMS.length)];
          speedMultiplier *= 1.4;
        } else if (rand > 0.88 && score > 50) {
          type = 'boss';
          emoji = '🎁';
          hp = 3;
          speedMultiplier *= 0.6;
        }

        const baseSpeed = 2.5 + (score / 50);

        return [
          ...prev,
          {
            id: Date.now() + Math.random(),
            x: 10 + Math.random() * 80, // %
            y: -20, // start above
            emoji,
            type,
            powerupId,
            hp,
            curve: (Math.random() - 0.5) * 40, // for waving left and right
            speed: baseSpeed * speedMultiplier
          }
        ];
      });
    }, spawnRate);
    
    return () => clearInterval(int);
  }, [gameState, score, activePowerup]);

  const addFloatingText = (x: number, y: number, text: string, color: string) => {
    const id = Date.now() + Math.random();
    setFloatingTexts(prev => [...prev, { id, x, y, text, color }]);
    setTimeout(() => {
      setFloatingTexts(prev => prev.filter(t => t.id !== id));
    }, 1000);
  };

  const tapItem = (item: GameItem, e: React.PointerEvent | null, autoCollect = false) => {
    if (gameState !== 'playing') return;
    
    const rect = gameAreaRef.current?.getBoundingClientRect();
    const touchX = (e && rect) ? ((e.clientX - rect.left) / rect.width) * 100 : item.x;
    const touchY = (e && rect) ? ((e.clientY - rect.top) / rect.height) * 100 : 50;

    if (item.type === 'boss' && item.hp! > 1) {
      sensory.play("pop");
      setActiveItems(prev => prev.map(i => i.id === item.id ? { ...i, hp: i.hp! - 1, scale: 0.9 } : i));
      addFloatingText(touchX, touchY, "BOP!", "text-white");
      return; // Do not filter out yet
    }

    if (item.type === 'good' || item.type === 'boss') {
      sensory.play("pop");
      const basePoints = item.type === 'boss' ? 25 : 1;
      const points = basePoints * multiplier;
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
      if (activePowerup) { setActivePowerup(null); setPowerupTime(0); }
      addFloatingText(touchX, touchY, `-${penalty}`, "text-rose-500");
    } else if (item.type === 'special') {
      sensory.play("levelUp");
      const points = 10 * multiplier;
      setScore(s => s + points);
      setCombo(c => c + 2);
      addFloatingText(touchX, touchY, `+${points}!!`, "text-amber-500");
    } else if (item.type === 'powerup') {
      sensory.play("sparkle");
      setActivePowerup(item.powerupId as any);
      setPowerupTime(5); // 5 seconds of powerup
      addFloatingText(touchX, touchY, `${item.powerupId!.toUpperCase()}!`, "text-cyan-400");
    }

    setActiveItems(prev => prev.filter(t => t.id !== item.id));
  };
  
  // Custom HUD styles for powerups
  const isFrozen = activePowerup === 'freeze';
  const isMagnet = activePowerup === 'magnet';

  if (gameState === 'idle') {
    return (
      <div className="bg-card/80 backdrop-blur-sm border-2 border-primary/30 rounded-[32px] p-8 text-center shadow-lg relative overflow-hidden">
        <div className="absolute inset-0 bg-primary/5 pointer-events-none" />
        <motion.div animate={{ y: [0, -10, 0] }} transition={{ repeat: Infinity, duration: 2 }}>
          <span className="text-6xl mb-4 block">🎪</span>
        </motion.div>
        <h3 className="text-2xl font-black text-text mb-2 tracking-tight">Baby Play Time!</h3>
        <p className="text-sm text-text/70 font-medium mb-4">
          Tap falling toys to score points.<br/>
          Box 🎁 needs 3 taps.<br/>
          Catch powerups ❄️ 🧲!<br/>
          Avoid 💩 and 🕷️!
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
        "bg-gradient-to-b border-2 rounded-[32px] p-4 text-center shadow-inner relative overflow-hidden h-[400px] touch-none select-none transition-colors duration-1000",
        isFrozen ? "from-cyan-900 to-bg border-cyan-400/50" : 
        isMagnet ? "from-fuchsia-900 to-bg border-fuchsia-400/50" : 
        multiplier >= 3 ? "from-bg to-primary/5 border-amber-400/50 shadow-[inset_0_0_20px_rgba(251,191,36,0.2)]" : "from-bg to-primary/5 border-border"
      )}
    >
      {/* Background Effects for Powerups */}
      {isFrozen && <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPjxyZWN0IHdpZHRoPSI0IiBoZWlnaHQ9IjQiIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4xIi8+PC9zdmc+')] opacity-30" />}
      
      {/* HUD */}
      <div className="absolute top-4 left-4 right-4 flex justify-between z-40 pointer-events-none">
        <div className="bg-bg/90 backdrop-blur-md px-4 py-2 rounded-2xl border border-border/50 shadow-sm flex items-center gap-2">
          <Trophy size={16} className="text-amber-500" />
          <span className="font-black text-lg text-text">{score}</span>
          
          <AnimatePresence>
            {multiplier > 1 && (
              <motion.div 
                initial={{ scale: 0, x: -10 }} 
                animate={{ scale: 1, x: 0 }} 
                exit={{ scale: 0 }}
                className="ml-2 bg-amber-400 text-amber-950 text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-0.5"
              >
                <Zap size={10} /> x{multiplier}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <div className="flex flex-col items-end gap-1">
          <div className="bg-bg/90 backdrop-blur-md px-4 py-2 rounded-2xl border border-border/50 shadow-sm flex items-center gap-2">
            <span className={cn("font-black text-lg", timeLeft <= 10 ? "text-rose-500 animate-pulse" : "text-text")}>
              {timeLeft}s
            </span>
          </div>
          {activePowerup && (
            <motion.div initial={{ x: 50, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className={cn("px-2 py-1 rounded-xl text-[10px] font-black uppercase text-white shadow-md", activePowerup === 'freeze' ? "bg-cyan-500" : "bg-fuchsia-500")}>
               {activePowerup} {powerupTime}s
            </motion.div>
          )}
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
            className={cn("absolute font-black text-xl z-50 pointer-events-none drop-shadow-md whitespace-nowrap", ft.color)}
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
            initial={{ y: -50, scale: 0.5, x: `${item.x}%` }}
            animate={{ 
              y: 500, 
              scale: item.type === 'boss' ? (1.5 + ((item.hp || 3) * 0.1)) : 1, 
              rotate: Math.random() * 360,
              x: [`${item.x}%`, `${item.x + item.curve}%`, `${item.x - item.curve}%`, `${item.x}%`]
            }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ duration: item.speed, ease: 'linear', x: { duration: item.speed, repeat: Infinity, ease: 'easeInOut' } }}
            onAnimationComplete={() => {
                setActiveItems(prev => prev.filter(t => t.id !== item.id));
                // Break combo if good item/special/boss falls off screen
                if (['good', 'special', 'boss'].includes(item.type)) {
                    setCombo(0);
                    setMultiplier(1);
                }
            }}
            onPointerDown={(e) => tapItem(item, e)}
            className={cn(
              "absolute text-5xl cursor-pointer touch-none z-20 hover:scale-110 active:scale-95",
              item.type === 'boss' && "filter drop-shadow-[0_0_15px_rgba(255,255,255,0.5)] z-30"
            )}
            style={{ 
              filter: item.type === 'special' ? 'drop-shadow(0 0 10px rgba(251,191,36,0.8))' : 
                      item.type === 'powerup' && item.powerupId === 'freeze' ? 'drop-shadow(0 0 15px rgba(34,211,238,0.8))' :
                      item.type === 'powerup' && item.powerupId === 'magnet' ? 'drop-shadow(0 0 15px rgba(217,70,239,0.8))' : 'none' 
            }}
          >
            {item.emoji}
            {item.type === 'boss' && (
              <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 flex gap-0.5">
                {Array.from({length: item.hp || 0}).map((_, i) => (
                  <div key={i} className="w-1.5 h-1.5 bg-rose-500 rounded-full border border-white" />
                ))}
              </div>
            )}
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Combo Background effects */}
      {multiplier >= 4 && !activePowerup && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.15 }}
          className="absolute inset-0 bg-gradient-to-t from-amber-400 to-transparent pointer-events-none z-0"
        />
      )}
    </div>
  );
}

