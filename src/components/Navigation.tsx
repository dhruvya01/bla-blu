import React from "react";
import { Home, Sprout, Heart, MessageCircle, Settings as SettingsIcon, Droplets, Calendar, History, CalendarDays, MapPin, Navigation2 } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "../utils";
import { useAppStore } from "../store";
import { useShallow } from "zustand/react/shallow";
import { ViewType } from "../types";
import { sensory } from "../utils/sensory";

export function Navigation() {
    const { view, setView, careTab, setCareTab, user, messages, calendarEvents, envelopes } = useAppStore(useShallow(state => ({
    view: state.view,
    setView: state.setView,
    careTab: state.careTab,
    setCareTab: state.setCareTab,
    user: state.user,
    messages: state.messages,
    calendarEvents: state.calendarEvents,
    envelopes: state.envelopes
  })));

  const unreadCount = (messages || []).filter(m => m.senderId !== user?.uid && m.status !== "seen").length;
  const unopenedEnvelopes = (envelopes || []).filter((e: any) => e.recipientId === user?.uid && !e.opened).length;

  return (
    <div className="absolute bottom-[calc(env(safe-area-inset-bottom,0px)+12px)] left-6 right-6 z-50">
      <nav className="flex items-center justify-between py-3 px-3 backdrop-blur-2xl bg-card shadow-2xl shadow-primary/10 rounded-[2.5rem] max-w-sm mx-auto border border-border">
        <NavItem active={view === "home"} onClick={() => setView("home")} icon={<Home size={22} />} label="Home" badge={unopenedEnvelopes > 0 ? unopenedEnvelopes : undefined} />
        <NavItem active={view === "chat"} onClick={() => setView("chat")} icon={<MessageCircle size={22} />} label="Chat" badge={unreadCount > 0 ? unreadCount : undefined} />
        <NavItem active={view === "journey"} onClick={() => setView("journey")} icon={<Navigation2 size={22} />} label="Map" />
        <NavItem active={view === "habits" || view === "period" || view === "history" || view === "sanctuary" || view === "calendar"} onClick={() => setView("period")} icon={<Heart size={22} />} label="Love" />
        <NavItem active={view === "planner"} onClick={() => setView("planner")} icon={<CalendarDays size={22} />} label="Dates" />
      </nav>
    </div>
  );
}

function NavItem({ active, onClick, icon, label, badge }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string, badge?: number }) {
  return (
    <button 
      onClick={() => {
        if (active) return;
        sensory.tap();
        onClick();
      }} 
      className={cn(
        "flex flex-col items-center justify-center w-14 h-14 selection:bg-transparent transition-all duration-500 relative group", 
        active ? "text-primary scale-100" : "text-text/30 hover:text-text/60 scale-95 hover:scale-100"
      )}
    >
      <div className="relative flex items-center justify-center w-full h-full">
        {/* Active Background Pill - Animated via layoutId */}
        {active && (
          <motion.div
            layoutId="nav-active-pill"
            className="absolute inset-0 bg-primary/10 rounded-2xl"
            transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
          />
        )}
        
        {/* Icon */}
        <motion.div
           animate={{ 
             y: active ? -2 : 0,
             scale: active ? 1.05 : 0.95
           }}
           transition={{ duration: 0.4, type: "spring", bounce: 0.4 }}
           className="relative z-10"
        >
          {icon}
        </motion.div>

        {/* Badge */}
        {badge !== undefined && (
          <motion.div 
             initial={{ scale: 0, y: 5 }}
             animate={{ scale: 1, y: 0 }}
             className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 bg-rose text-white text-[9px] font-bold rounded-full flex items-center justify-center border-2 border-bg shadow-sm z-20"
          >
            {badge > 9 ? "9+" : badge}
          </motion.div>
        )}
      </div>

      {/* Label underneath */}
      <motion.span 
        animate={{
          opacity: active ? 1 : 0,
          y: active ? 24 : 10
        }}
        transition={{ duration: 0.3 }}
        className="absolute text-[9px] font-bold tracking-widest uppercase pointer-events-none"
      >
        {label}
      </motion.span>
    </button>
  );
}

