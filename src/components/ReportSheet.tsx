import { useState, useEffect } from 'react';
import { type AuthState } from '../lib/store';
import { reportPost, reportComment, resolveCommentId } from '../lib/lemmy';
import styles from './ReportSheet.module.css';

const REASONS = ['Spam', 'Harassment', 'Hate speech', 'NSFW', 'Misinformation', 'Other'];

export type ReportTarget =
  | { type: 'post'; postId: number }
  | { type: 'comment'; commentId: number; apId: string }
  | null;

interface Props {
  target: ReportTarget;
  auth: AuthState;
  onClose: () => void;
}

export default function ReportSheet({ target, auth, onClose }: Props) {
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
        await reportPost(auth.instance, auth.token, target.postId, reason);
      } else {
        const resolved = await resolveCommentId(auth.instance, auth.token, target.apId).catch(() => null);
        const commentId = resolved ?? target.commentId;
        await reportComment(auth.instance, auth.token, commentId, reason);
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
