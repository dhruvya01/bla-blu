import { motion } from 'framer-motion';
import { useAppStore } from '../store';
import { getTimeOfDay, getRoomBrightness, ROOM_THEMES } from '../utils/homeGame';
import { getRealBirthday } from '../utils/birthday';

const Pukku = (props: any) => <div className={`flex items-center justify-center ${props.className || ''}`}><img src="/pet.png" className="w-[80px] h-[80px] object-contain drop-shadow-md" alt="Baby" draggable={false} /></div>;
const Ukku = (props: any) => <div className={`flex items-center justify-center ${props.className || ''}`}><img src="/pet.png" className="w-[60px] h-[60px] object-contain drop-shadow-md scale-x-[-1]" alt="Baby" draggable={false} /></div>;

const PARTICLES = Array.from({length:6},(_,i)=>i);

export function CozyRoom({ theme='default', isSleeping=false, cleanliness=75, onTapBaby }:
  { theme?:string; isSleeping?:boolean; cleanliness?:number; onTapBaby?:(id:'ukku'|'pukku')=>void }) {
  const tod = getTimeOfDay();
  const bright = getRoomBrightness();
  const t = ROOM_THEMES.find(r=>r.id===theme)||ROOM_THEMES[0];
  const isNight = tod==='night'||tod==='dusk';
  const debugBirthday = useAppStore(s => s.debugBirthday);
  const birthdayPerson = debugBirthday || getRealBirthday();
  
  return (
    <div className="relative w-full rounded-[28px] overflow-hidden shadow-xl border-4 border-white/20" style={{height:280, filter:`brightness(${bright})`}}>
      {/* Background Image or CSS Fallback */}
      {(t as any).image ? (
        <img src={(t as any).image} alt={t.name} className="absolute inset-0 w-full h-full object-cover" />
      ) : (
        <div className="absolute inset-0" style={{background:`linear-gradient(180deg,${t.wall[0]} 0%,${t.wall[1]} 65%,${t.floor} 65%,${t.floor} 100%)`}}/>
      )}

      {/* Dynamic Overlays (Only show if no image to avoid clutter, or for subtle effects) */}
      {!(t as any).image && (
        <>
          {/* Window */}
          <div className="absolute top-4 left-5 w-16 h-20 rounded-xl border-4 border-white/40 overflow-hidden shadow-inner" style={{background:t.sky[tod]}}>
            {tod==='night'&&<>{['⭐','✨','⭐','✨'].map((s,i)=>(
              <motion.span key={i} animate={{opacity:[0.3,1,0.3]}} transition={{duration:2+i,repeat:Infinity,delay:i*0.5}}
                className="absolute text-[8px]" style={{top:4+i*4,left:3+i*10}}>{s}</motion.span>
            ))}</>}
            {tod==='day'&&<motion.span animate={{y:[-2,2,-2]}} transition={{duration:4,repeat:Infinity}} className="absolute top-2 right-1 text-lg">☀️</motion.span>}
            {tod==='dawn'&&<span className="absolute bottom-1 right-1 text-sm">🌅</span>}
          </div>
          {/* Curtains */}
          <div className="absolute top-3 left-4 w-[18px] h-[22px] rounded-b-full" style={{background:t.accent+'44'}}/>
          <div className="absolute top-3 left-[72px] w-[18px] h-[22px] rounded-b-full" style={{background:t.accent+'44'}}/>
        </>
      )}

      {/* Universal Lighting / Mood Overlays */}
      <div className="absolute inset-0 pointer-events-none transition-colors duration-1000" 
           style={{ background: birthdayPerson ? 'rgba(255, 138, 180, 0.15)' : (isNight ? 'rgba(13, 27, 42, 0.2)' : 'transparent') }} />
      
      {/* Birthday Decorations */}
      {birthdayPerson && (
        <div className="absolute inset-0 pointer-events-none z-10">
          {/* Party Banners */}
          <div className="absolute top-0 left-0 right-0 h-8 flex justify-around items-start overflow-hidden">
            {['🚩','💛','🚩','💛','🚩','💛','🚩'].map((b,i)=>(
              <motion.span key={i} initial={{ y: -20 }} animate={{ y: 0 }} transition={{ delay: i*0.1 }} className="text-lg">{b}</motion.span>
            ))}
          </div>
          {/* Balloons */}
          <motion.span animate={{ y: [-5, 5, -5], rotate: [-5, 5, -5] }} transition={{ duration: 4, repeat: Infinity }} className="absolute top-10 left-4 text-2xl">🎈</motion.span>
          <motion.span animate={{ y: [5, -5, 5], rotate: [5, -5, 5] }} transition={{ duration: 5, repeat: Infinity, delay: 1 }} className="absolute top-12 right-12 text-2xl">🎈</motion.span>
          <motion.span animate={{ y: [-3, 3, -3] }} transition={{ duration: 3, repeat: Infinity, delay: 0.5 }} className="absolute bottom-1/2 right-4 text-xl">🎁</motion.span>
          <motion.span animate={{ y: [3, -3, 3] }} transition={{ duration: 3.5, repeat: Infinity }} className="absolute bottom-1/2 left-10 text-xl">🍰</motion.span>
        </div>
      )}
      
      {/* Furniture (Emoji placeholders if needed) */}
      {!(t as any).image && (
        <>
          <span className="absolute bottom-[38%] left-4 text-2xl">🛋️</span>
          <span className="absolute bottom-[38%] right-5 text-lg">🧸</span>
          <motion.span animate={{scale:[1,1.05,1]}} transition={{duration:6,repeat:Infinity}} className="absolute bottom-[38%] right-[72px] text-lg">🪴</motion.span>
        </>
      )}
      
      {cleanliness<40&&<span className="absolute bottom-[36%] left-[45%] text-sm opacity-40">🧹</span>}

      {/* Babies */}
      <div className="absolute bottom-[8%] left-1/2 -translate-x-1/2 flex items-end gap-1">
        <motion.div onClick={()=>onTapBaby?.('pukku')} whileTap={{scale:0.85}}
          animate={isSleeping?{y:[0,3,0],scale:0.9}:{y:[0,-4,0]}} transition={{duration:isSleeping?4:2.5,repeat:Infinity}}
          className="w-[90px] h-[90px] cursor-pointer relative">
          <Pukku className="w-full h-full drop-shadow-xl"/>
          {isSleeping&&<motion.span animate={{opacity:[0,1,0],y:[-5,-15]}} transition={{duration:2,repeat:Infinity}} className="absolute -top-3 right-0 text-sm">💤</motion.span>}
        </motion.div>
        <motion.div onClick={()=>onTapBaby?.('ukku')} whileTap={{scale:0.8}}
          animate={isSleeping?{y:[0,2,0],scale:0.6}:{y:[0,-3,0],scale:0.7}} transition={{duration:isSleeping?4.5:3,repeat:Infinity}}
          className="w-[70px] h-[70px] cursor-pointer origin-bottom relative -ml-3">
          <Ukku className="w-full h-full drop-shadow-xl"/>
          {isSleeping&&<motion.span animate={{opacity:[0,1,0],y:[-3,-10]}} transition={{duration:2.5,repeat:Infinity,delay:0.5}} className="absolute -top-2 right-0 text-[10px]">💤</motion.span>}
        </motion.div>
      </div>
      {/* Floating particles */}
      {!isSleeping&&PARTICLES.map(i=>(
        <motion.div key={i} animate={{y:[-10,10,-10],x:[0,5,-5,0],opacity:[0,0.6,0]}}
          transition={{duration:4+i*1.5,repeat:Infinity,delay:i*0.8}}
          className="absolute w-1 h-1 rounded-full" style={{background:t.accent,top:`${15+i*12}%`,left:`${20+i*12}%`}}/>
      ))}
      {/* Sleep overlay */}
      {isSleeping&&<div className="absolute inset-0 bg-indigo-950/30 pointer-events-none"/>}
    </div>
  );
}
