import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const HINT_KEY = 'stakswipe_hint_seen';

export default function SwipeHint() {
  const [visible, setVisible] = useState(() => !localStorage.getItem(HINT_KEY));

  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(() => {
      setVisible(false);
      localStorage.setItem(HINT_KEY, '1');
    }, 3000);
    return () => clearTimeout(t);
  }, [visible]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{
            position: 'fixed',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 32,
            pointerEvents: 'none',
            zIndex: 200,
            background: 'rgba(0,0,0,0.5)',
          }}
        >
          <div style={{ display: 'flex', gap: 60, fontSize: '2rem' }}>
            <span>👎 ←</span>
            <span>→ 👍</span>
          </div>
          <div style={{ color: '#ccc', fontSize: '0.85rem', textAlign: 'center' }}>
            Swipe to vote<br />
            <span style={{ color: '#888' }}>Scroll down for comments</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
