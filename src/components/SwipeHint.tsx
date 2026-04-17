import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const HINT_KEY = 'stakswipe_hint_seen';
const UNDO_HINT_KEY = 'stakswipe_undo_hint_seen';

interface Props {
  showUndoHint?: boolean;
}

export default function SwipeHint({ showUndoHint = false }: Props) {
  const [visible, setVisible] = useState(() => !localStorage.getItem(HINT_KEY));
  const [undoVisible, setUndoVisible] = useState(false);

  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(() => {
      setVisible(false);
      localStorage.setItem(HINT_KEY, '1');
    }, 5000);
    return () => clearTimeout(t);
  }, [visible]);

  useEffect(() => {
    if (!showUndoHint || localStorage.getItem(UNDO_HINT_KEY)) return;
    setUndoVisible(true);
    const t = setTimeout(() => {
      setUndoVisible(false);
      localStorage.setItem(UNDO_HINT_KEY, '1');
    }, 3000);
    return () => clearTimeout(t);
  }, [showUndoHint]);

  return (
    <>
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
            <div style={{ color: '#ccc', fontSize: '0.9rem', textAlign: 'center', lineHeight: 1.8 }}>
              Swipe left/right to vote<br />
              <span style={{ color: '#888' }}>Scroll down for comments</span><br />
              <span style={{ color: '#888' }}>Double-tap left/right side of a comment to vote</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {undoVisible && (
          <div style={{ position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)', zIndex: 200, pointerEvents: 'none' }}>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              style={{
                background: 'rgba(0,0,0,0.75)',
                color: '#ccc',
                fontSize: '0.85rem',
                padding: '10px 20px',
                borderRadius: 20,
                whiteSpace: 'nowrap',
              }}
            >
              ↓ Swipe down to go back
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
