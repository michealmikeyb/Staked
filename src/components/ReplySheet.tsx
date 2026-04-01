import { useState, useEffect } from 'react';
import { type CommentView } from '../lib/lemmy';
import styles from './ReplySheet.module.css';

interface Props {
  mode: 'reply' | 'edit' | 'new' | null;
  target?: CommentView;
  initialContent?: string;
  onSubmit: (content: string) => Promise<void>;
  onClose: () => void;
}

export default function ReplySheet({ mode, target, initialContent, onSubmit, onClose }: Props) {
  const [content, setContent] = useState(initialContent ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setContent(initialContent ?? '');
    setError(null);
  }, [mode, initialContent]);

  const handleSend = async () => {
    if (!content.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(content.trim());
      setContent('');
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to send');
    } finally {
      setSubmitting(false);
    }
  };

  if (!mode) return null;

  const header =
    mode === 'reply'
      ? `↩ Replying to @${target?.creator.display_name ?? target?.creator.name ?? ''}`
      : mode === 'edit'
      ? '✏ Editing your comment'
      : '💬 Commenting on post';

  return (
    <div className={`${styles.sheet} ${styles.open}`}>
      <div className={styles.header}>{header}</div>
      <textarea
        className={styles.textarea}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder={mode === 'edit' ? 'Edit your comment...' : 'Write a comment...'}
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
