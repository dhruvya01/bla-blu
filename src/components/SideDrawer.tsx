import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  X, 
  Settings, 
  Palette, 
  LogOut, 
  Calendar, 
  History, 
  Droplets,
  ChevronRight,
  Heart,
  User as UserIcon,
  Bell,
  Sparkles,
  Flower2,
  Image as ImageIcon,
  Lock,
  Home,
  AlertCircle
} from "lucide-react";
import { useAppStore } from "../store";
import { useShallow } from "zustand/react/shallow";
import { cn } from "../utils";
import { sensory } from "../utils/sensory";
import { ViewType, CareTabType, ThemeType } from "../types";

interface SideDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SideDrawer({ isOpen, onClose }: SideDrawerProps) {
  const { setView, setCareTab, theme, setTheme, setUser, setRoomId, user, partner } = useAppStore(useShallow(state => ({
    setView: state.setView,
    setCareTab: state.setCareTab,
    theme: state.theme,
    setTheme: state.setTheme,
    setUser: state.setUser,
    setRoomId: state.setRoomId,
    user: state.user,
    partner: state.partner
  })));

  const handleNavigate = (view: ViewType, tab?: CareTabType) => {
    setView(view);
    if (tab) setCareTab(tab);
    onClose();
  };

  const handleLogout = () => {
    localStorage.clear();
    setUser(null);
    setRoomId(null);
    onClose();
  };

  const menuGroups = [
    {
      title: "Our World",
      items: [
        { label: "Home", icon: <Home size={24} />, onClick: () => handleNavigate("home"), color: "bg-rose-400/20 text-rose-400 font-bold" },
        { label: "Calendar", icon: <Calendar size={24} />, onClick: () => handleNavigate("planner"), color: "bg-primary/20 text-primary" },
        { label: "Scrapbook", icon: <ImageIcon size={24} />, onClick: () => handleNavigate("timeline"), color: "bg-indigo-500/20 text-indigo-500" },
        { label: "Locked Folder", icon: <Lock size={24} />, onClick: () => handleNavigate("vault"), color: "bg-emerald-500/20 text-emerald-500" },
        { label: "100 Reasons", icon: <Heart size={24} />, onClick: () => handleNavigate("jar"), color: "bg-rose/20 text-rose" },
        { label: "Mistake List", icon: <AlertCircle size={24} />, onClick: () => handleNavigate("mistakes"), color: "bg-amber-500/20 text-amber-500" },
      ]
    },
    {
      title: "Care & Health",
      items: [
        { label: "Health Hub", icon: <Flower2 size={24} />, onClick: () => handleNavigate("sanctuary"), color: "bg-mint/20 text-mint" },
        { label: "Cycle Tracker", icon: <Droplets size={24} />, onClick: () => handleNavigate("period"), color: "bg-rose-400/20 text-rose-400" },
      ]
    }
  ];

  const themes: { id: ThemeType; color: string; label: string }[] = [
    { id: "pink", color: "bg-rose-400", label: "Sweet" },
    { id: "lavender", color: "bg-violet-400", label: "Dreamy" },
    { id: "mint", color: "bg-emerald-400", label: "Mint" },
    { id: "peach", color: "bg-orange-400", label: "Peach" },
    { id: "ocean", color: "bg-sky-400", label: "Ocean" },
    { id: "honey", color: "bg-amber-400", label: "Honey" },
    { id: "rose", color: "bg-rose-600", label: "Rose" },
    { id: "dark", color: "bg-slate-800", label: "Dark" },
    { id: "amoled", color: "bg-black ring-2 ring-rose-500/30", label: "OLED Pink" },
    { id: "amoled-cyan", color: "bg-black ring-2 ring-cyan-500/30", label: "OLED Cyan" },
    { id: "amoled-gold", color: "bg-black ring-2 ring-amber-500/30", label: "OLED Gold" },
    { id: "amoled-violet", color: "bg-black ring-2 ring-violet-500/30", label: "OLED Violet" },
    { id: "amoled-ruby", color: "bg-black ring-2 ring-rose-600/30", label: "OLED Ruby" },
    { id: "midnight", color: "bg-indigo-900", label: "Midnight" },
    { id: "aurora", color: "bg-emerald-900", label: "Aurora" },
    { id: "mocha", color: "bg-amber-900", label: "Mocha" },
    { id: "berry", color: "bg-purple-900", label: "Berry" },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[1000] bg-bg/80 backdrop-blur-xl flex flex-col"
        >
          {/* Header */}
          <div className="p-8 flex items-center justify-between">
             <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                   <Sparkles size={24} />
                </div>
                <div>
                   <h2 className="text-xl font-display text-text">Menu</h2>
                   <p className="text-[10px] font-black uppercase tracking-widest text-text/30">Explore your space</p>
                </div>
             </div>
             <motion.button 
               whileTap={{ scale: 0.9 }}
               onClick={onClose}
               className="w-12 h-12 rounded-2xl bg-card border border-border flex items-center justify-center text-text shadow-sm"
             >
                <X size={24} />
             </motion.button>
          </div>

          <div className="flex-1 overflow-y-auto px-8 py-4 space-y-10 no-scrollbar">
             {menuGroups.map((group, gIdx) => (
               <div key={gIdx} className="space-y-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] text-text/20 ml-2">{group.title}</p>
                  <div className="grid grid-cols-1 gap-3">
                     {group.items.map((item, iIdx) => (
                       <motion.button
                         key={iIdx}
                         whileTap={{ scale: 0.98 }}
                         onClick={item.onClick}
                         className="w-full flex items-center gap-5 p-4 rounded-[2rem] bg-card/50 border border-border hover:bg-card transition-all shadow-sm group"
                       >
                          <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform", item.color)}>
                             {item.icon}
                          </div>
                          <span className="text-base font-bold text-text/80 tracking-tight">{item.label}</span>
                          <ChevronRight size={20} className="ml-auto text-text/20 group-hover:text-text/60 transition-colors" />
                       </motion.button>
                     ))}
                  </div>
               </div>
             ))}

             {/* Personalization Section */}
             <div className="space-y-6">
                <div className="flex items-center gap-2 ml-2">
                   <Palette size={14} className="text-text/30" />
                   <p className="text-[10px] font-black uppercase tracking-[0.3em] text-text/20">Personalize Aura</p>
                </div>
                <div className="bg-card/40 rounded-[2.5rem] p-6 border border-border">
                   <div className="grid grid-cols-5 gap-4">
                      {themes.map((t) => (
                         <button
                           key={t.id}
                           onClick={() => { sensory.play('pop'); setTheme(t.id); }}
                           className="flex flex-col items-center gap-3 group"
                         >
                            <div className={cn(
                              "w-12 h-12 rounded-2xl shadow-lg transition-all group-hover:scale-110 ring-offset-4 ring-offset-bg",
                              t.color,
                              theme === t.id ? "ring-2 ring-primary" : "opacity-40"
                            )} />
                            <span className="text-[8px] font-black uppercase tracking-tighter opacity-40 group-hover:opacity-100">{t.label}</span>
                         </button>
                      ))}
                   </div>
                </div>
             </div>
          </div>

          {/* Footer */}
          <div className="p-8 border-t border-border">
             <div className="flex items-center justify-between gap-4">
                <button 
                  onClick={() => handleNavigate("settings")}
                  className="flex-1 flex items-center justify-center gap-2 p-4 rounded-2xl bg-card border border-border text-text/60 font-bold text-xs"
                >
                   <Settings size={18} />
                   <span>Settings</span>
                </button>
                <button 
                  onClick={handleLogout}
                  className="p-4 rounded-2xl bg-rose/5 text-rose border border-rose/10 flex items-center justify-center"
                >
                   <LogOut size={18} />
                </button>
             </div>
             <p className="text-center text-[9px] font-black text-text/20 mt-6 uppercase tracking-[0.3em]">Blablu • Just for us</p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
