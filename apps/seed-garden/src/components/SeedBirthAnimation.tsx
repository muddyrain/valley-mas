import { motion } from 'framer-motion';

export function SeedBirthAnimation({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-garden-warm/80 backdrop-blur"
    >
      <motion.div
        animate={{ rotate: [0, 8, -8, 0], scale: [1, 1.1, 1] }}
        transition={{ repeat: Infinity, duration: 1.6 }}
        className="text-6xl"
      >
        🌱
      </motion.div>
      <div className="absolute bottom-1/3 text-garden-ink font-bold">
        种子精灵正在揉捏一颗新种子...
      </div>
    </motion.div>
  );
}
