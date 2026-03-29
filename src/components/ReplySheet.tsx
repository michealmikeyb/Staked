import { useState } from 'react';
import { type CommentView } from '../lib/lemmy';
import styles from './ReplySheet.module.css';

interface Props {
  target: CommentView | null;
  onSubmit: (content: string) => Promise<void>;
  onClose: () => void;
}

export default function ReplySheet({ target, onSubmit, onClose }: Props) {
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSend = async () => {
    if (!content.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(content.trim());
      setContent('');
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to send reply');
    } finally {
      setSubmitting(false);
    }
  };

  if (!target) return null;

  return (
    <div className={`${styles.sheet} ${styles.open}`}>
      <div className={styles.header}>↩ Replying to @{target.creator.name}</div>
      <textarea
        className={styles.textarea}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Write a reply..."
      />
      {error && <div className={styles.error}>{error}</div>}
      <div className={styles.actions}>
        <button className={styles.cancel} onClick={onClose}>Cancel</button>
        <button
          className={styles.send}
          onClick={handleSend}
          disabled={submitting || !content.trim()}
        >
          {submitting ? 'Sending...' : 'Send'}
        </button>
      </div>
    </div>
  );
}
