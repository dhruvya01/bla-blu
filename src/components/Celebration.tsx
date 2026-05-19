import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";

export function Celebration({ id }: { id: number }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (id > 0) {
      setShow(true);
      const t = setTimeout(() => setShow(false), 2000);
      return () => clearTimeout(t);
    }
  }, [id]);

  if (!show) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-[100] flex items-center justify-center overflow-hidden">
      <AnimatePresence>
        {show && [...Array(20)].map((_, i) => (
          <motion.div
            key={i}
            initial={{ 
              opacity: 1, 
              scale: 0, 
              x: 0, 
              y: 0 
            }}
            animate={{ 
              opacity: [1, 1, 0], 
              scale: Math.random() * 1 + 0.5, 
              x: (Math.random() - 0.5) * window.innerWidth * 0.8, 
              y: (Math.random() - 0.5) * window.innerHeight * 0.8,
              rotate: Math.random() * 360
            }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.5, ease: "easeOut" }}
            className="absolute text-4xl"
            style={{ filter: `hue-rotate(${Math.random() * 360}deg)` }}
          >
            {['✨', '💖', '🌸', '🎉'][Math.floor(Math.random() * 4)]}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
