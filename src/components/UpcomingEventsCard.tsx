import React from "react";
import { CalendarDays } from "lucide-react";
import { cn } from "../utils";

export const UpcomingEventsCard = ({ events = [], isMale }: { events?: any[], isMale?: boolean }) => {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const thirtyDaysLater = new Date();
  thirtyDaysLater.setDate(now.getDate() + 30);

  const upcoming = events.filter(e => {
    if (!e.date) return false;
    const d = new Date(e.date);
    return d >= now && d <= thirtyDaysLater;
  }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return (
    <div className={cn(
      "premium-card p-8 backdrop-blur-xl rounded-[2.5rem] border",
      isMale ? "bg-card border-border shadow-sm" : "bg-card/40 border-border shadow-sm"
    )}>
      <div className="flex items-center justify-between mb-6">
        <h3 className={cn("text-[10px] font-black uppercase tracking-[0.3em] flex items-center gap-2", isMale ? "text-text/50" : "text-text/30")}>
          <CalendarDays size={14} className={isMale ? "text-text/40" : "text-primary/40"} /> Upcoming Moments
        </h3>
        {upcoming.length > 0 && (
          <span className={cn(
            "text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest border",
            isMale ? "bg-bg text-text/80 border-border" : "bg-primary/10 text-primary border-transparent"
          )}>
            {upcoming.length} Planned
          </span>
        )}
      </div>

      <div className="space-y-4">
        {upcoming.length > 0 ? (
          upcoming.slice(0, 3).map((event, idx) => {
            const evDate = new Date(event.date);
            const diffTime = evDate.getTime() - now.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            
            return (
              <div key={event.id || idx} className={cn(
                "flex items-start gap-4 p-4 rounded-3xl border transition-all shadow-sm",
                isMale 
                  ? "bg-bg border-border hover:bg-card" 
                  : "bg-card/60 border-border hover:bg-card"
              )}>
                <div className={cn(
                  "flex flex-col items-center justify-center w-12 h-14 rounded-2xl border",
                  isMale ? "bg-card text-text border-border" : "bg-primary/5 text-primary border-primary/10"
                )}>
                  <span className="text-[8px] font-black uppercase">{evDate.toLocaleDateString('en-US', { month: 'short' })}</span>
                  <span className="text-xl font-black">{evDate.getDate()}</span>
                </div>
                <div className="flex-1">
                  <h4 className={cn("font-bold text-sm leading-tight mb-1", isMale ? "text-text" : "text-text")}>{event.title}</h4>
                  <p className={cn("text-[9px] font-black uppercase tracking-widest", isMale ? "text-text/50" : "text-text/30")}>
                    {diffDays === 0 ? "Today" : diffDays === 1 ? "Tomorrow" : `In ${diffDays} days`}
                  </p>
                </div>
              </div>
            );
          })
        ) : (
          <div className={cn(
             "py-8 text-center rounded-3xl border border-dashed",
             isMale ? "bg-card/20 border-border" : "bg-card/40 border-border"
          )}>
            <p className={cn("text-[10px] font-bold uppercase tracking-[0.2em]", isMale ? "text-text/40" : "text-text/20")}>No upcoming moments planned</p>
          </div>
        )}
      </div>
    </div>
  );
};
