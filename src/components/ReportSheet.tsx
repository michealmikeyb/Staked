import { useState, useEffect } from 'react';
import { useBackend } from '../lib/api/context';
import styles from './ReportSheet.module.css';

const REASONS = ['Spam', 'Harassment', 'Hate speech', 'NSFW', 'Misinformation', 'Other'];

export type ReportTarget =
  | { type: 'post'; postId: string }
  | { type: 'comment'; commentId: string }
  | null;

interface Props {
  target: ReportTarget;
  onClose: () => void;
}

export default function ReportSheet({ target, onClose }: Props) {
  const backend = useBackend();
  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [detail, setDetail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!target) {
      setSelectedReason(null);
      setDetail('');
      setError(null);
      setSuccess(false);
    }
  }, [target]);

  useEffect(() => {
    if (!success) return;
    const timer = setTimeout(onClose, 1500);
    return () => clearTimeout(timer);
  }, [success, onClose]);

  if (!target) return null;

  const handleSubmit = async () => {
    if (!selectedReason) return;
    const reason = detail.trim() ? `${selectedReason} — ${detail.trim()}` : selectedReason;
    setSubmitting(true);
    setError(null);
    try {
      if (target.type === 'post') {
        await backend.posts.report(target.postId, reason);
      } else {
        await backend.comments.report(target.commentId, reason);
      }
      setSuccess(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to submit report');
    } finally {
      setSubmitting(false);
    }
  };

  const title = target.type === 'post' ? 'Report post' : 'Report comment';

  return (
    <div className={`${styles.sheet} ${styles.open}`}>
      <div className={styles.header}>{title}</div>
      {success ? (
        <div className={styles.success}>Report submitted</div>
      ) : (
        <>
          <div className={styles.chips}>
            {REASONS.map((r) => (
              <button
                key={r}
                className={`${styles.chip} ${selectedReason === r ? styles.chipSelected : ''}`}
                onClick={() => setSelectedReason(r)}
              >
                {r}
              </button>
            ))}
          </div>
          <textarea
            className={styles.textarea}
            value={detail}
            onChange={(e) => setDetail(e.target.value)}
            placeholder="Additional details (optional)"
          />
          {error && <div className={styles.error}>{error}</div>}
          <div className={styles.actions}>
            <button className={styles.cancel} onClick={onClose}>Cancel</button>
            <button
              className={styles.send}
              onClick={handleSubmit}
              disabled={submitting || !selectedReason}
            >
              {submitting ? 'Submitting...' : 'Submit'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
