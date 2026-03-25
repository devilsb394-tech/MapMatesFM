import React from 'react';
import { motion } from 'motion/react';

export default function SplashScreen() {
  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-white">
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 1, ease: "easeOut" }}
        className="flex flex-col items-center"
      >
        <div className="w-24 h-24 bg-blue-600 rounded-3xl flex items-center justify-center shadow-2xl mb-6">
          <span className="text-white text-5xl font-black tracking-tighter">MM</span>
        </div>
        <h1 className="text-4xl font-black tracking-tighter text-neutral-900 mb-2">MAPMATES</h1>
        <div className="flex gap-1">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              animate={{
                scale: [1, 1.5, 1],
                opacity: [0.3, 1, 0.3],
              }}
              transition={{
                duration: 1,
                repeat: Infinity,
                delay: i * 0.2,
              }}
              className="w-2 h-2 bg-blue-600 rounded-full"
            />
          ))}
        </div>
      </motion.div>
      
      <div className="absolute bottom-12 text-neutral-400 font-medium tracking-tight text-sm">
        Created by <span className="text-neutral-900 font-bold">Faizan Zeeshan</span>
      </div>
    </div>
  );
}
