import { useState } from "react";
import { motion } from "framer-motion";
import { Lock } from "lucide-react";
import { initE2E } from "../utils/e2ee";
import { sensory } from "../utils/sensory";

export function E2EESetupModal({ onComplete }: { onComplete: () => void }) {
  const [passphrase, setPassphrase] = useState("");

  const handleSave = async () => {
    if (!passphrase.trim()) return;
    await initE2E(passphrase.trim());
    sensory.play("success");
    onComplete();
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-card border border-border shadow-2xl rounded-3xl p-6 w-full max-w-sm text-center relative overflow-hidden"
      >
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-400 to-emerald-600" />
        <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <Lock size={32} className="text-emerald-500" />
        </div>
        <h2 className="text-xl font-bold text-text mb-2 tracking-tight">End-to-End Encryption</h2>
        <p className="text-sm text-text/60 mb-6 leading-relaxed">
          Your messages and photos are secured with military-grade encryption.
          Set a shared passphrase. Make sure your partner uses the exact same one!
        </p>

        <input
          type="text"
          value={passphrase}
          onChange={(e) => setPassphrase(e.target.value)}
          placeholder="E2EE Passphrase"
          className="w-full bg-bg border border-border rounded-xl px-4 py-3 mb-4 text-center focus:border-emerald-500 outline-none transition-colors"
          onKeyDown={e => e.key === "Enter" && handleSave()}
        />

        <button
          onClick={handleSave}
          disabled={!passphrase.trim()}
          className="w-full bg-emerald-500 text-white rounded-xl py-3 font-semibold disabled:opacity-50 active:scale-95 transition-all"
        >
          Secure Chat
        </button>
      </motion.div>
    </div>
  );
}
