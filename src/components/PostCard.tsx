import { useMemo, useEffect, useState, useRef } from 'react';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import { useDrag } from '@use-gesture/react';
import { fetchComments, resolvePostId, resolveCommentId, createComment, type PostView, type CommentView } from '../lib/lemmy';
import { type AuthState } from '../lib/store';
import CommentList from './CommentList';
import ReplySheet from './ReplySheet';
import styles from './PostCard.module.css';

const SWIPE_THRESHOLD = 120;
const VELOCITY_THRESHOLD = 0.5;

interface Props {
  post: PostView;
  auth: AuthState;
  zIndex: number;
  scale: number;
  onSwipeRight: () => void;
  onSwipeLeft: () => void;
  onSave: () => void;
}

function communityInitial(name: string): string {
  return name.charAt(0).toUpperCase();
}

function instanceFromActorId(actorId: string): string {
  try { return new URL(actorId).hostname; } catch { return ''; }
}

const IMAGE_EXT = /\.(jpg|jpeg|png|gif|webp|avif|bmp)(\?.*)?$/i;
function isImageUrl(url: string): boolean {
  try { return IMAGE_EXT.test(new URL(url).pathname); } catch { return false; }
}

// Posts federate across instances — ap_id gives the canonical source instance + local post ID.
function sourceFromApId(apId: string): { instance: string; postId: number } | null {
  try {
    const url = new URL(apId);
    const postId = parseInt(url.pathname.split('/').pop() ?? '', 10);
    return isNaN(postId) ? null : { instance: url.hostname, postId };
  } catch { return null; }
}

export default function PostCard({ post, auth, zIndex, scale, onSwipeRight, onSwipeLeft, onSave }: Props) {
  const { post: p, community, creator, counts } = post;
  const instance = useMemo(() => instanceFromActorId(community.actor_id), [community.actor_id]);
  const [comments, setComments] = useState<CommentView[]>([]);
  const [commentsLoaded, setCommentsLoaded] = useState(false);
  const [replyTarget, setReplyTarget] = useState<CommentView | null>(null);
  const [localReplies, setLocalReplies] = useState<CommentView[]>([]);

  // Track which instance+token produced the successful comment fetch so replies go to the right place.
  const resolvedInstanceRef = useRef<string>(auth.instance);
  const resolvedTokenRef = useRef<string>(auth.token);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      let comments: CommentView[] = [];
      const source = sourceFromApId(p.ap_id);

      if (source) {
        const sourceToken = source.instance === auth.instance ? auth.token : '';
        comments = await fetchComments(source.instance, sourceToken, source.postId).catch(() => []);
        if (comments.length > 0) {
          resolvedInstanceRef.current = source.instance;
          resolvedTokenRef.current = sourceToken;
        }
      }

      // Cross-posts, non-Lemmy sources (Kbin/Mbin ap_ids etc.), or empty source fetch:
      // resolve via the community's home instance.
      if (comments.length === 0) {
        const communityInstance = instanceFromActorId(community.actor_id);
        if (communityInstance && communityInstance !== source?.instance) {
          const localId = await resolvePostId(communityInstance, p.ap_id).catch(() => null);
          if (localId != null) {
            const communityToken = communityInstance === auth.instance ? auth.token : '';
            comments = await fetchComments(communityInstance, communityToken, localId).catch(() => []);
            if (comments.length > 0) {
              resolvedInstanceRef.current = communityInstance;
              resolvedTokenRef.current = communityToken;
            }
          }
        }
      }

      // Last resort: user's home instance with the already-known local post ID.
      // Try authenticated first; fall back to anonymous if token is expired (401).
      if (comments.length === 0 && source?.instance !== auth.instance) {
        comments = await fetchComments(auth.instance, auth.token, p.id).catch(() =>
          fetchComments(auth.instance, '', p.id).catch(() => [])
        );
        if (comments.length > 0) {
          resolvedInstanceRef.current = auth.instance;
          resolvedTokenRef.current = auth.token;
        }
      }

      // Merge in home-instance comments so replies posted there appear immediately,
      // even before they federate back to the source instance.
      if (auth.token && source?.instance !== auth.instance) {
        const homeComments = await fetchComments(auth.instance, auth.token, p.id).catch(() => []);
        if (homeComments.length > 0) {
          const seenApIds = new Set(comments.map(c => c.comment.ap_id));
          const novel = homeComments.filter(c => !seenApIds.has(c.comment.ap_id));
          if (novel.length > 0) {
            // Remap each novel comment's path to use source-instance IDs so threading is correct.
            const homeIdToApId = new Map(homeComments.map(c => [c.comment.id, c.comment.ap_id]));
            const sourceApIdToComment = new Map(comments.map(c => [c.comment.ap_id, c]));

            const result = [...comments];
            for (const nc of novel) {
              const pathParts = nc.comment.path.split('.');
              const parentLocalId = pathParts.length > 2 ? parseInt(pathParts[pathParts.length - 2]) : null;
              const parentApId = parentLocalId != null ? homeIdToApId.get(parentLocalId) : null;
              const parentInSource = parentApId ? sourceApIdToComment.get(parentApId) : null;

              if (parentInSource) {
                const sourcePath = parentInSource.comment.path + '.' + nc.comment.id;
                const remapped = { ...nc, comment: { ...nc.comment, path: sourcePath } };
                const parentPath = parentInSource.comment.path;
                const parentFoundIdx = result.findIndex(c => c.comment.ap_id === parentApId);
                let insertIdx = parentFoundIdx + 1;
                while (insertIdx < result.length && result[insertIdx].comment.path.startsWith(parentPath + '.')) {
                  insertIdx++;
                }
                result.splice(insertIdx, 0, remapped);
              } else {
                result.push(nc);
              }
            }
            comments = result;
          }
        }
      }

      if (!cancelled) { setComments(comments); setCommentsLoaded(true); }
    };

    load();
    return () => { cancelled = true; };
  }, [auth, p.ap_id, p.id, community.actor_id]);

  const x = useMotionValue(0);

  const scrollRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef(0);
  const [pullDelta, setPullDelta] = useState(0);

  // Right swipe rotates CCW ("lifting"), left swipe CW ("sinking") — opposite of standard Tinder.
  const rotate = useTransform(x, [-150, 0, 150], [12, 0, -12]);

  const overlayColor = useTransform(x, (v) => {
    const opacity = Math.min(Math.abs(v) / 120, 1) * 0.45;
    return v > 0 ? `rgba(255,107,53,${opacity})` : `rgba(80,80,80,${opacity})`;
  });

  const bind = useDrag(({ movement: [mx], velocity: [vx], last }) => {
    x.set(mx);
    if (last) {
      const shouldSwipe = Math.abs(mx) > SWIPE_THRESHOLD || Math.abs(vx) > VELOCITY_THRESHOLD;
      if (shouldSwipe && mx > 0) {
        animate(x, 600, { duration: 0.3, onComplete: onSwipeRight });
      } else if (shouldSwipe && mx < 0) {
        animate(x, -600, { duration: 0.3, onComplete: onSwipeLeft });
      } else {
        animate(x, 0, { type: 'spring', stiffness: 400, damping: 30 });
      }
    }
  }, { axis: 'x', filterTaps: true, pointer: { touch: true } });

  const imageSrc = (p.url && isImageUrl(p.url)) ? p.url : p.thumbnail_url;

  const handleReplySubmit = async (content: string) => {
    const parentApId = replyTarget!.comment.ap_id;
    const parentId = await resolveCommentId(resolvedInstanceRef.current, resolvedTokenRef.current, parentApId).catch(() => null)
      ?? replyTarget!.comment.id;
    const newComment = await createComment(resolvedInstanceRef.current, resolvedTokenRef.current, p.id, content, parentId);
    const remapped = {
      ...newComment,
      comment: { ...newComment.comment, path: replyTarget!.comment.path + '.' + newComment.comment.id },
    };
    setLocalReplies((prev) => [...prev, remapped]);
    setReplyTarget(null);
  };

  return (
    <motion.div
      className={styles.card}
      style={{ zIndex, x, rotate, scale }}
      {...(bind() as object)}
    >
      <motion.div className={styles.overlay} style={{ backgroundColor: overlayColor }} />
      <motion.div
        className={styles.saveOverlay}
        style={{ opacity: Math.min(pullDelta / 80, 1) }}
      />

      <div
        ref={scrollRef}
        data-testid="scroll-content"
        className={styles.scrollContent}
        onTouchStart={(e) => { touchStartY.current = e.touches[0].clientY; }}
        onTouchMove={(e) => {
          const delta = e.touches[0].clientY - touchStartY.current;
          if (scrollRef.current && scrollRef.current.scrollTop === 0 && delta > 0) {
            setPullDelta(delta);
          } else {
            setPullDelta(0);
          }
        }}
        onTouchEnd={() => {
          if (pullDelta >= 80) onSave();
          setPullDelta(0);
        }}
      >
        <div className={styles.meta}>
          <div className={styles.communityIcon}>{communityInitial(community.name)}</div>
          <div>
            <div className={styles.communityName}>c/{community.name}</div>
            <div className={styles.instanceName}>{instance} • {creator.display_name ?? creator.name}</div>
          </div>
        </div>

        <div className={styles.title}>{p.name}</div>

        {imageSrc && <img className={styles.image} src={imageSrc} alt="" loading="lazy" />}

        {p.body && <div className={styles.excerpt}>{p.body}</div>}

        <div className={styles.footer}>
          <span>▲ {counts.score}</span>
          <span>💬 {counts.comments}</span>
        </div>

        <div className={styles.commentsSection}>
          {commentsLoaded && comments.length === 0 && counts.comments > 0 && (
            <a
              className={styles.commentsFallback}
              href={p.ap_id}
              target="_blank"
              rel="noopener noreferrer"
            >
              {counts.comments} comments — view on {new URL(p.ap_id).hostname}
            </a>
          )}
          <CommentList
            comments={comments}
            localReplies={localReplies}
            auth={auth}
            postId={p.id}
            instance={auth.instance}
            token={auth.token}
            replyTarget={replyTarget}
            onSetReplyTarget={setReplyTarget}
          />
        </div>
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}>
        <ReplySheet
          target={replyTarget}
          onSubmit={handleReplySubmit}
          onClose={() => setReplyTarget(null)}
        />
      </div>
    </motion.div>
  );
}
