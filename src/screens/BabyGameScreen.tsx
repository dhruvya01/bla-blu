import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Coins, Star, Utensils, Moon, ShowerHead, ChefHat, ShoppingCart, CheckSquare, Sparkles } from 'lucide-react';
import { useAppStore } from '../store';
import { sensory } from '../utils/sensory';
import { cn } from '../utils';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/config';
import { BabyState, BabyEvolution } from '../types';
import { CozyRoom } from '../components/CozyRoom';
import {
  RECIPES, SUPPLIES, ROOM_THEMES, DAILY_TASKS, INITIAL_HOME,
  HomeGameData, getTimeGreeting, getAgeShort, canCookRecipe, shouldResetTasks
} from '../utils/homeGame';

const PUKKU_BD = new Date(2024, 9, 13).getTime();
const UKKU_BD = new Date(2026, 3, 14).getTime();
const ANJALI_BD = new Date(2008, 0, 5).getTime();
const DHRUVYA_BD = new Date(2008, 5, 9).getTime();

export function BabyGameScreen() {
  const { user, roomId, babyEvolution, addCoins, feedBaby, cleanBaby, setBabyEvolution, setView } = useAppStore();
  const [babyState, setBabyState] = useState<BabyState|null>(null);
  const [home, setHome] = useState<HomeGameData>(INITIAL_HOME);
  const [tab, setTab] = useState<'home'|'cook'|'shop'|'tasks'>('home');
  const [cooking, setCooking] = useState<string|null>(null);
  const [cookingTime, setCookingTime] = useState(0);
  const [bathing, setBathing] = useState<'ukku'|'pukku'|null>(null);
  const [bathingTime, setBathingTime] = useState(0);
  const [feedTarget, setFeedTarget] = useState<'ukku'|'pukku'>('pukku');

  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;
    if (cookingTime > 0) {
      timer = setInterval(() => setCookingTime(p => Math.max(0, p - 1)), 1000);
    }
    return () => clearInterval(timer);
  }, [cookingTime]);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;
    if (bathingTime > 0) {
      timer = setInterval(() => setBathingTime(p => Math.max(0, p - 1)), 1000);
    }
    return () => clearInterval(timer);
  }, [bathingTime]);
  const [sleepCD, setSleepCD] = useState(0);
  const sleepRef = useRef<ReturnType<typeof setInterval>|null>(null);
  const { coins, ukkuHunger, pukkuHunger, ukkuHygiene, pukkuHygiene, lovePoints, level } = babyEvolution;
  const isSleeping = babyState?.isSleeping || false;

  // Firestore sync
  useEffect(() => {
    if (!roomId) return;
    const u1 = onSnapshot(doc(db,'pairs',roomId,'babyState','current'), s => { if(s.exists()) setBabyState(s.data() as BabyState); });
    const u3 = onSnapshot(doc(db,'pairs',roomId,'homeGame','current'), s => {
      if(s.exists()) setHome(s.data() as HomeGameData);
      else setDoc(doc(db,'pairs',roomId,'homeGame','current'), INITIAL_HOME);
    });
    return ()=>{ u1(); u3(); };
  }, [roomId, setBabyEvolution]);

  // Daily task reset
  useEffect(() => {
    if (shouldResetTasks(home.lastTaskReset) && roomId) {
      const reset = { dailyTasks:{}, lastTaskReset: Date.now() };
      setDoc(doc(db,'pairs',roomId,'homeGame','current'), reset, {merge:true});
    }
  }, [home.lastTaskReset, roomId]);

  const saveHome = (update: Partial<HomeGameData>) => {
    if (!roomId) return;
    setDoc(doc(db,'pairs',roomId,'homeGame','current'), update, {merge:true});
  };

  const completeTask = (taskId: string, reward: number) => {
    if (home.dailyTasks[taskId]) return;
    addCoins(reward);
    saveHome({ dailyTasks: { ...home.dailyTasks, [taskId]: true } });
    sensory.play('sparkle');
  };

  const handleCook = (recipeId: string) => {
    const recipe = RECIPES.find(r=>r.id===recipeId);
    if (!recipe || !canCookRecipe(recipe, home.supplies)) return;
    setCooking(recipeId);
    setCookingTime(90); // 1:30 min
    const newSupplies = {...home.supplies};
    Object.entries(recipe.ingredients).forEach(([id,qty])=>{ newSupplies[id]=(newSupplies[id]||0)-qty; });
    const meal = { id: Date.now().toString(), recipeId, preparedBy: user?.uid||'', preparedAt: Date.now() };
    setTimeout(()=>{
      saveHome({ supplies: newSupplies, preparedMeals: [...home.preparedMeals, meal] });
      completeTask('cook_meal', 3);
      setCooking(null);
      setCookingTime(0);
      sensory.play('levelUp');
    }, 90000);
  };

  const handleFeedMeal = (mealIdx: number) => {
    const meal = home.preparedMeals[mealIdx];
    if (!meal) return;
    const recipe = RECIPES.find(r=>r.id===meal.recipeId);
    if (!recipe) return;
    feedBaby(feedTarget, recipe.nutrition);
    const meals = home.preparedMeals.filter((_,i)=>i!==mealIdx);
    saveHome({ preparedMeals: meals });
    if (roomId) {
      const key = feedTarget==='ukku'?'ukkuHunger':'pukkuHunger';
      const cur = (babyEvolution as any)[key]||0;
      setDoc(doc(db,'pairs',roomId,'babyEvolution','current'), { [key]: Math.min(100,cur+recipe.nutrition) }, {merge:true});
    }
    completeTask(feedTarget==='ukku'?'feed_ukku':'feed_pukku', 3);
    sensory.play('pop');
  };

  const handleBuySupply = (supplyId: string, cost: number) => {
    if (coins < cost) return;
    addCoins(-cost);
    const newS = {...home.supplies, [supplyId]: (home.supplies[supplyId]||0)+1 };
    saveHome({ supplies: newS });
    sensory.play('pop');
  };

  const handleBuyTheme = (themeId: string, cost: number) => {
    if (coins < cost || home.ownedThemes.includes(themeId)) return;
    addCoins(-cost);
    saveHome({ ownedThemes: [...home.ownedThemes, themeId], roomTheme: themeId });
    sensory.play('levelUp');
  };

  const handleApplyTheme = (id: string) => { if(home.ownedThemes.includes(id)) saveHome({roomTheme:id}); };

  const handleClean = (babyId: 'ukku'|'pukku') => {
    if (isSleeping || bathing) return;
    setBathing(babyId);
    setBathingTime(60); // 1 min
    setTimeout(() => {
        cleanBaby(babyId, 30);
        saveHome({ cleanliness: Math.min(100, home.cleanliness+15) });
        if (roomId) {
        const k = babyId==='ukku'?'ukkuHygiene':'pukkuHygiene';
        setDoc(doc(db,'pairs',roomId,'babyEvolution','current'), { [k]: Math.min(100,(babyEvolution as any)[k]+30) }, {merge:true});
        }
        completeTask('bath_babies', 3);
        sensory.play('sparkle');
        setBathing(null);
        setBathingTime(0);
    }, 60000);
  };

  const handleCleanRoom = () => {
    saveHome({ cleanliness: Math.min(100, home.cleanliness+25), lastClean: Date.now() });
    completeTask('clean_room', 2);
    sensory.play('sparkle');
  };

  const handleSleep = async () => {
    if (!roomId || !user) return;
    const isHer = user.perspective==='her';
    const f = isHer?'anjaliReadyToSleep':'dhruvyaReadyToSleep';
    const tf = isHer?'anjaliLastClick':'dhruvyaLastClick';
    sensory.play('pop');
    const now = Date.now();
    await setDoc(doc(db,'pairs',roomId,'babyState','current'), {[f]:true,[tf]:now}, {merge:true});
    if(sleepRef.current) clearInterval(sleepRef.current);
    setSleepCD(15);
    sleepRef.current = setInterval(()=>setSleepCD(p=>{
      if(p<=1){ clearInterval(sleepRef.current!); setDoc(doc(db,'pairs',roomId,'babyState','current'),{[f]:false},{merge:true}).catch(()=>{}); return 0; }
      return p-1;
    }),1000);
    if(babyState){
      const or = isHer?babyState.dhruvyaReadyToSleep:babyState.anjaliReadyToSleep;
      const ot = isHer?(babyState as any).dhruvyaLastClick:(babyState as any).anjaliLastClick;
      if(or && ot && now-ot<15000){
        clearInterval(sleepRef.current!); setSleepCD(0);
        await setDoc(doc(db,'pairs',roomId,'babyState','current'),{isSleeping:true,mood:'sleepy',anjaliReadyToSleep:false,dhruvyaReadyToSleep:false},{merge:true});
        completeTask('sleep_babies',3); sensory.important();
      }
    }
  };

  const handleWake = async () => {
    if(!roomId) return;
    await setDoc(doc(db,'pairs',roomId,'babyState','current'),{isSleeping:false,mood:'happy',anjaliReadyToSleep:false,dhruvyaReadyToSleep:false},{merge:true});
    sensory.play('levelUp');
  };

  const handleTapBaby = (id:'ukku'|'pukku') => {
    if(isSleeping) return;
    sensory.tap(); sensory.play('pop');
    const taps = parseInt(localStorage.getItem('blablu_baby_taps')||'0')+1;
    localStorage.setItem('blablu_baby_taps', String(taps));
    if(taps%10===0){ setBabyEvolution({lovePoints:lovePoints+1}); sensory.play('levelUp'); }
  };

  const tasksCompleted = DAILY_TASKS.filter(t=>home.dailyTasks[t.id]).length;

  return (
    <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="flex-1 w-full bg-bg overflow-y-auto no-scrollbar pb-32">
      {/* Gamified Header */}
      <div className="sticky top-0 z-30 bg-bg/80 backdrop-blur-2xl pt-safe-top pb-4 px-5 border-b border-white/10 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-3 mt-2">
          <motion.button 
            whileTap={{scale:0.9}} 
            onClick={()=>setView('home')} 
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-card border border-white/50 dark:border-white/10 shadow-sm hover:bg-white/5 transition-colors"
          >
            <ArrowLeft size={18} className="text-text/70"/>
            <span className="text-sm font-bold text-text/70">Home</span>
          </motion.button>
          <div className="px-5 py-2.5 bg-amber-400/20 rounded-[20px] border border-amber-400/30 flex items-center gap-2 shadow-sm">
            <div className="w-7 h-7 rounded-full bg-amber-400 flex items-center justify-center shadow-md">
              <Coins size={14} className="text-amber-900" />
            </div>
            <div className="flex flex-col">
              <span className="text-[8px] font-black uppercase text-amber-600 leading-none tracking-widest">Babies' Money</span>
              <span className="text-[12px] font-black text-amber-900">{coins}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Room View */}
      <div className="mx-4 mt-4 relative group">
        <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-[32px] opacity-0 group-hover:opacity-100 transition-opacity duration-1000 -z-10" />
        <motion.div whileHover={{scale:1.01}} transition={{type:"spring", stiffness: 300, damping: 25}}>
           <CozyRoom theme={home.roomTheme} isSleeping={isSleeping} cleanliness={home.cleanliness} onTapBaby={handleTapBaby}/>
        </motion.div>
      </div>

      {/* Family quick-stats */}
      <div className="mx-4 mt-6 grid grid-cols-2 gap-3">
        {([
           {id:'dhruvya',n:'Dhruvya',c:'indigo',age:getAgeShort(DHRUVYA_BD), role:'Papa'},
           {id:'anjali',n:'Anjali',c:'emerald',age:getAgeShort(ANJALI_BD), role:'Mumma'},
           {id:'pukku',n:'Pukku',c:'blue',h:Math.round(pukkuHunger||0),hy:Math.round(pukkuHygiene||0),age:getAgeShort(PUKKU_BD)},
           {id:'ukku',n:'Ukku',c:'rose',h:Math.round(ukkuHunger||0),hy:Math.round(ukkuHygiene||0),age:getAgeShort(UKKU_BD)}
         ] as const).map(b=>(
          <motion.div key={b.id} whileHover={{y:-2}} className={cn("bg-card border border-white/50 dark:border-white/5 shadow-sm relative overflow-hidden group flex flex-col justify-between", 'role' in b ? "rounded-[20px] p-3" : "rounded-[32px] p-4")}>
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-current to-transparent opacity-5 rounded-bl-[100px] pointer-events-none" style={{color: b.c === 'blue' ? '#3b82f6' : b.c === 'rose' ? '#f43f5e' : b.c === 'indigo' ? '#6366f1' : '#10b981'}} />
            <div className={cn("flex items-start justify-between relative z-10", 'role' in b ? "mb-2" : "mb-4")}>
              <div className="flex items-center gap-2">
                <div className={cn("rounded-[12px] flex items-center justify-center text-white text-xs font-black shadow-inner border border-white/20 shrink-0", 'role' in b ? "w-8 h-8" : "w-10 h-10", b.c==='blue'?'bg-blue-500':b.c==='rose'?'bg-rose-500':b.c==='indigo'?'bg-indigo-500':'bg-emerald-500')}>
                  {b.n[0]}
                </div>
                <div className="flex flex-col">
                  <span className={cn("font-bold tracking-tight text-text leading-tight", 'role' in b ? "text-[12px]" : "text-[14px]")}>{b.n}</span>
                  <span className="text-[9px] font-bold text-text/40">{b.age}</span>
                </div>
              </div>
              {'role' in b && (
                 <span className="text-xl leading-none">{b.role === 'Papa' ? '👨🏻' : '👩🏻'}</span>
              )}
            </div>
            
            {'role' in b ? (
              <div className="flex items-center gap-1.5 py-1.5 px-2 bg-text/5 rounded-[10px] relative z-10 shadow-[inset_0_1px_2px_rgba(0,0,0,0.05)] w-fit mt-1">
                <span className="text-[9px] font-black text-text/50 uppercase tracking-widest">{b.role}</span>
              </div>
            ) : (
              <div className="space-y-3 mt-2 relative z-10">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[9px] font-bold text-text/50 uppercase flex items-center gap-1">🍼 Fullness</span>
                    <span className="text-[9px] font-black text-text/60">{b.h}%</span>
                  </div>
                  <div className="w-full h-2 bg-text/5 rounded-full overflow-hidden shadow-inner border border-text/5">
                    <motion.div initial={{width:0}} animate={{width:`${b.h}%`}} transition={{type:"spring", stiffness:50, damping: 15}} className={cn('h-full rounded-full shadow-sm',b.h>70?'bg-emerald-400':b.h>30?'bg-amber-400':'bg-rose-500')}/>
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[9px] font-bold text-text/50 uppercase flex items-center gap-1">✨ Clean</span>
                    <span className="text-[9px] font-black text-text/60">{b.hy}%</span>
                  </div>
                  <div className="w-full h-2 bg-text/5 rounded-full overflow-hidden shadow-inner border border-text/5">
                    <motion.div initial={{width:0}} animate={{width:`${b.hy}%`}} transition={{type:"spring", stiffness:50, damping: 15}} className={cn('h-full rounded-full shadow-sm',b.hy>70?'bg-sky-400':b.hy>30?'bg-amber-400':'bg-rose-500')}/>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        ))}
      </div>

      {/* Tab Bar */}
      <div className="mx-4 mt-6 flex bg-card border border-white/50 dark:border-white/5 rounded-[24px] p-2 gap-2 shadow-sm">
        {([['home','🏠','Home'],['cook','🍳','Cook'],['shop','🛒','Shop'],['tasks','✅','Tasks']] as const).map(([k,e,l])=>(
          <motion.button whileTap={{scale:0.92}} key={k} onClick={()=>setTab(k as any)} className={cn('flex-1 py-3 rounded-[16px] text-[10px] font-black uppercase tracking-widest transition-all flex flex-col items-center justify-center gap-1.5 relative overflow-hidden',tab===k?'bg-primary text-white shadow-md':'text-text/40 hover:bg-text/5')}>
            {tab===k && <div className="absolute inset-0 bg-white/20 animate-pulse" />}
            <span className="text-xl relative z-10 drop-shadow-sm">{e}</span>
            <span className="relative z-10">{l}</span>
            {k==='tasks'&&tasksCompleted>0&&<span className="absolute top-1 right-2 w-4 h-4 rounded-full bg-emerald-400 text-white text-[8px] flex items-center justify-center shadow-sm border border-white/20 z-10">{tasksCompleted}</span>}
          </motion.button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="px-4 mt-4 pb-8">
        <AnimatePresence mode="sync">
          {/* ── HOME TAB ── */}
          {tab==='home'&&<motion.div key="home" initial={{opacity:0, scale:0.95}} animate={{opacity:1, scale:1}} transition={{type:"spring", stiffness: 300, damping:25}} className="space-y-4">
            {/* Sleep Card */}
            <div className="bg-card border border-white/50 dark:border-white/5 rounded-[32px] p-5 flex items-center gap-4 shadow-sm relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-bl-[100px] pointer-events-none" />
              {!isSleeping?<>
                <div className="flex-1 relative z-10">
                  <p className="text-[13px] font-black text-text uppercase tracking-widest flex items-center gap-1.5">Bedtime 🌙</p>
                  <p className="text-[10px] text-text/50 font-medium mt-0.5">Both tap within 15s</p>
                  {sleepCD>0&&<p className="text-[10px] text-emerald-500 font-black mt-1 animate-pulse">Waiting... {sleepCD}s ⏳</p>}
                </div>
                <div className="flex gap-2 relative z-10">{['her','his'].map(p=>{
                  const r=p==='her'?babyState?.anjaliReadyToSleep:babyState?.dhruvyaReadyToSleep;
                  return <div key={p} className={cn('w-3.5 h-3.5 rounded-full border-2',r?'bg-emerald-400 border-emerald-300 shadow-[0_0_10px_#34d399]':'bg-text/10 border-text/10')}/>;
                })}</div>
                <motion.button whileTap={{scale:0.9}} onClick={handleSleep}
                  className={cn('w-14 h-14 rounded-[20px] flex items-center justify-center shadow-md relative z-10 transition-all duration-300',(user?.perspective==='her'?babyState?.anjaliReadyToSleep:babyState?.dhruvyaReadyToSleep)?'bg-emerald-500 text-white scale-105':'bg-bg text-text/40 border border-white/50 dark:border-white/10')}><Moon size={22}/></motion.button>
              </>:<>
                <motion.span animate={{scale:[1,1.1,1], rotate:[-5,5,-5]}} transition={{repeat:Infinity,duration:3}} className="text-4xl filter drop-shadow-md relative z-10">💤</motion.span>
                <div className="flex-1 relative z-10"><p className="text-[14px] font-black text-indigo-600 uppercase tracking-widest">Sleeping...</p></div>
                <motion.button whileTap={{scale:0.9}} onClick={handleWake} className="px-5 py-3.5 bg-amber-400 text-amber-900 rounded-[20px] text-[11px] font-black uppercase flex items-center gap-1.5 shadow-md relative z-10"><Star size={14}/>Wake Up</motion.button>
              </>}
            </div>
            {/* Quick Actions */}
            <div className="grid grid-cols-2 gap-3">
              {([{id:'pukku',n:'Feed Pukku',e:'🍼',c:'blue'},{id:'ukku',n:'Feed Ukku',e:'🍼',c:'rose'}] as const).map(b=>(
                <motion.button key={b.id} whileTap={{scale:0.95}} onClick={()=>{setFeedTarget(b.id);setTab('home');}}
                  className="bg-card border border-white/50 dark:border-white/5 rounded-[28px] p-4 flex flex-col items-start gap-2 shadow-sm relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-bl from-current to-transparent opacity-5 rounded-bl-[100px] pointer-events-none" style={{color: b.c === 'blue' ? '#3b82f6' : '#f43f5e'}} />
                  <div className="w-12 h-12 rounded-[16px] bg-bg flex items-center justify-center text-2xl shadow-inner border border-text/5 relative z-10 mb-1">{b.e}</div>
                  <div className="text-left relative z-10"><p className="text-[11px] font-black text-text uppercase tracking-widest leading-tight">{b.n}</p>
                    <p className="text-[9px] text-text/40 font-bold mt-0.5 bg-text/5 px-2 py-0.5 rounded-md inline-block">{home.preparedMeals.length} meals ready</p></div>
                </motion.button>
              ))}
              {([{n:'Bath Pukku',e:'🛁',act:()=>handleClean('pukku'),id:'pukku'},{n:'Bath Ukku',e:'🛁',act:()=>handleClean('ukku'),id:'ukku'},
                 {n:'Tidy Room',e:'🧹',act:handleCleanRoom},{n:'Water Plant',e:'🪴',act:()=>completeTask('water_plant',1)}] as const).map((a,i)=>(
                <motion.button key={i} whileTap={{scale:0.95}} onClick={(a as any).act} className="bg-card border border-white/50 dark:border-white/5 rounded-[28px] p-4 flex flex-col items-start gap-2 shadow-sm relative overflow-hidden group">
                  <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="w-12 h-12 rounded-[16px] bg-bg flex items-center justify-center text-2xl shadow-inner border border-text/5 relative z-10 mb-1">
                    {('id' in a && bathing === a.id) ? <span className="text-sm font-black text-primary animate-pulse">{bathingTime}s</span> : a.e}
                  </div>
                  <p className="text-[11px] font-black text-text uppercase tracking-widest leading-tight relative z-10">{('id' in a && bathing === a.id) ? 'Cleaning...' : a.n}</p>
                </motion.button>
              ))}
            </div>
            {/* Prepared meals feed */}
            {home.preparedMeals.length>0&&<div className="bg-card border border-white/50 dark:border-white/5 rounded-[32px] p-5 shadow-sm mt-4">
              <div className="flex items-center justify-between mb-4">
                <p className="text-[11px] font-black text-text uppercase tracking-widest">Ready to Serve</p>
                <div className="flex gap-1.5 p-1 bg-bg rounded-[12px] border border-text/5 shadow-inner">
                  <button onClick={()=>setFeedTarget('pukku')} className={cn('px-3 py-1.5 rounded-[8px] text-[9px] font-black uppercase transition-all',feedTarget==='pukku'?'bg-blue-500 text-white shadow-sm':'text-text/40 hover:text-text')}>Pukku</button>
                  <button onClick={()=>setFeedTarget('ukku')} className={cn('px-3 py-1.5 rounded-[8px] text-[9px] font-black uppercase transition-all',feedTarget==='ukku'?'bg-rose-500 text-white shadow-sm':'text-text/40 hover:text-text')}>Ukku</button>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">{home.preparedMeals.map((m,i)=>{
                const r=RECIPES.find(x=>x.id===m.recipeId);
                return r?<motion.button key={m.id} whileTap={{scale:0.9}} onClick={()=>handleFeedMeal(i)}
                  className="bg-bg border border-white/50 dark:border-white/5 rounded-[20px] p-3 flex flex-col items-center gap-1.5 shadow-sm relative overflow-hidden group">
                  <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <span className="text-3xl filter drop-shadow-md relative z-10">{r.emoji}</span>
                  <span className="text-[9px] font-black text-text/70 uppercase leading-tight text-center relative z-10">{r.name}</span>
                  <span className="text-[8px] text-primary font-black bg-primary/10 px-2 py-0.5 rounded-full relative z-10">+{r.nutrition}🍼</span>
                </motion.button>:null;
              })}</div>
            </div>}
          </motion.div>}

          {/* ── COOK TAB ── */}
          {tab==='cook'&&<motion.div key="cook" initial={{opacity:0}} animate={{opacity:1}} className="space-y-3">
            <p className="text-[10px] font-black text-text/40 uppercase tracking-widest px-1">Pantry</p>
            <div className="flex flex-wrap gap-1.5">{SUPPLIES.filter(s=>(home.supplies[s.id]||0)>0).map(s=>(
              <div key={s.id} className="bg-card border border-border rounded-xl px-2.5 py-1.5 flex items-center gap-1">
                <span className="text-sm">{s.emoji}</span><span className="text-[9px] font-black text-text/60">{home.supplies[s.id]}</span>
              </div>
            ))}{Object.keys(home.supplies).filter(k=>(home.supplies[k]||0)>0).length===0&&<p className="text-[10px] text-text/30 italic">Empty pantry — visit the shop!</p>}</div>
            <p className="text-[10px] font-black text-text/40 uppercase tracking-widest px-1 mt-4">Recipes</p>
            <div className="grid grid-cols-2 gap-2">{RECIPES.map(r=>{
              const can=canCookRecipe(r,home.supplies);
              const isCooking=cooking===r.id;
              return <motion.button key={r.id} whileTap={can?{scale:0.95}:{}} onClick={()=>can&&!cooking&&handleCook(r.id)}
                className={cn('bg-card border-2 rounded-2xl p-4 flex flex-col items-center gap-2 transition-all',can?'border-primary/20':'border-border opacity-40',isCooking&&'animate-pulse border-amber-400')}>
                <span className="text-3xl">{r.emoji}</span>
                <p className="text-[10px] font-bold text-text">{r.name}</p>
                <div className="flex flex-wrap justify-center gap-1">{Object.entries(r.ingredients).map(([id,qty])=>{
                  const s=SUPPLIES.find(x=>x.id===id);
                  return <span key={id} className={cn('text-[8px] px-1 rounded',((home.supplies[id]||0)>=qty)?'text-emerald-600 bg-emerald-50':'text-rose-500 bg-rose-50')}>{s?.emoji}{qty}</span>;
                })}</div>
                <span className="text-[8px] font-black text-primary">+{r.nutrition}🍼 +{r.happiness}💕</span>
                {isCooking && <span className="text-[9px] font-black text-amber-600 animate-bounce">Cooking... {Math.floor(cookingTime/60)}:{(cookingTime%60).toString().padStart(2,'0')}</span>}
              </motion.button>;
            })}</div>
          </motion.div>}

          {/* ── SHOP TAB ── */}
          {tab==='shop'&&<motion.div key="shop" initial={{opacity:0}} animate={{opacity:1}} className="space-y-4">
            <p className="text-[10px] font-black text-text/40 uppercase tracking-widest px-1">Groceries</p>
            <div className="grid grid-cols-3 gap-2">{SUPPLIES.map(s=>(
              <motion.button key={s.id} whileTap={{scale:0.93}} onClick={()=>handleBuySupply(s.id,s.cost)}
                className={cn('bg-card border-2 rounded-2xl p-3 flex flex-col items-center gap-1.5 transition-all',coins>=s.cost?'border-border':'border-border opacity-40')}>
                <span className="text-2xl">{s.emoji}</span>
                <p className="text-[9px] font-bold text-text">{s.name}</p>
                <p className="text-[8px] font-black text-amber-600">{s.cost} BM</p>
                {(home.supplies[s.id]||0)>0&&<span className="text-[8px] text-text/30">×{home.supplies[s.id]}</span>}
              </motion.button>
            ))}</div>
            <p className="text-[10px] font-black text-text/40 uppercase tracking-widest px-1">Room Themes</p>
            <div className="grid grid-cols-2 gap-2">{ROOM_THEMES.map(t=>{
              const owned=home.ownedThemes.includes(t.id);
              const active=home.roomTheme===t.id;
              return <motion.button key={t.id} whileTap={{scale:0.95}}
                onClick={()=>owned?handleApplyTheme(t.id):handleBuyTheme(t.id,t.cost)}
                className={cn('bg-card border-2 rounded-2xl p-4 flex flex-col items-center gap-2 transition-all',active?'border-primary shadow-md shadow-primary/10':'border-border',!owned&&coins<t.cost&&'opacity-40')}>
                <div className="w-full h-10 rounded-lg overflow-hidden" style={{background:`linear-gradient(135deg,${t.wall[0]},${t.wall[1]},${t.floor})`}}/>
                <span className="text-lg">{t.emoji}</span>
                <p className="text-[10px] font-bold text-text">{t.name}</p>
                <p className="text-[8px] font-black">{active?'✓ Active':owned?'Tap to Apply':`${t.cost} BM`}</p>
              </motion.button>;
            })}</div>
          </motion.div>}

          {/* ── TASKS TAB ── */}
          {tab==='tasks'&&<motion.div key="tasks" initial={{opacity:0}} animate={{opacity:1}} className="space-y-2">
            <div className="flex items-center justify-between px-1 mb-2">
              <p className="text-[10px] font-black text-text/40 uppercase tracking-widest">Daily Routines</p>
              <span className="text-[9px] font-black text-primary">{tasksCompleted}/{DAILY_TASKS.length}</span>
            </div>
            {/* Progress */}
            <div className="h-2 bg-text/5 rounded-full overflow-hidden mb-3"><motion.div animate={{width:`${(tasksCompleted/DAILY_TASKS.length)*100}%`}} className="h-full bg-primary rounded-full"/></div>
            {tasksCompleted===DAILY_TASKS.length&&<div className="bg-primary/10 border border-primary/20 rounded-2xl p-4 text-center mb-3">
              <span className="text-3xl">🎉</span><p className="text-[11px] font-black text-primary uppercase tracking-widest mt-1">All Done! Amazing parents!</p>
            </div>}
            {DAILY_TASKS.map(t=>(
              <div key={t.id} className={cn('bg-card border border-border rounded-2xl p-3.5 flex items-center gap-3 transition-all',home.dailyTasks[t.id]&&'opacity-50')}>
                <span className="text-xl">{t.emoji}</span>
                <div className="flex-1"><p className="text-[11px] font-bold text-text">{t.name}</p><p className="text-[8px] text-text/30 font-black">+{t.reward} Babies' Money</p></div>
                {home.dailyTasks[t.id]?<span className="text-emerald-500 text-sm">✓</span>
                  :<span className="w-5 h-5 rounded-full border-2 border-text/10"/>}
              </div>
            ))}
          </motion.div>}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
