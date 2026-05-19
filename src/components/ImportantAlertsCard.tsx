import React from "react";
import { ShieldAlert } from "lucide-react";
import { CareAlert } from "../types";

export const ImportantAlertsCard = ({ alerts }: { alerts: CareAlert[] }) => {
  const activeAlerts = alerts.filter(a => !a.read).sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
  if (activeAlerts.length === 0) return null;

  return (
    <div className="bg-rose/10 border border-rose/20 rounded-[2.5rem] p-6 backdrop-blur-md">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-8 h-8 rounded-full bg-rose text-white flex items-center justify-center animate-pulse">
          <ShieldAlert size={16} />
        </div>
        <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-rose">Critical Attention</h3>
      </div>
      <div className="space-y-3">
        {activeAlerts.slice(0, 2).map(alert => (
          <div key={alert.id} className="text-sm font-bold text-text/80 leading-relaxed">
            {alert.message}
          </div>
        ))}
      </div>
    </div>
  );
};
