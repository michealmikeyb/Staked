import { useMemo, useEffect, useState, useRef } from 'react';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import { useDrag } from '@use-gesture/react';
import { resolveCommentId, createComment, type PostView, type CommentView } from '../lib/lemmy';
import { type AuthState } from '../lib/store';
import CommentList from './CommentList';
import ReplySheet from './ReplySheet';
import styles from './PostCard.module.css';
import { useCommentLoader } from '../hooks/useCommentLoader';
import { useShare } from '../hooks/useShare';
import { instanceFromActorId, isImageUrl, getShareUrl } from '../lib/urlUtils';
import Toast from './Toast';

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


export default function PostCard({ post, auth, zIndex, scale, onSwipeRight, onSwipeLeft, onSave }: Props) {
  const { post: p, community, creator, counts } = post;
  const instance = useMemo(() => instanceFromActorId(community.actor_id), [community.actor_id]);
  const { comments, commentsLoaded } = useCommentLoader(p, community, auth);
  const [replyTarget, setReplyTarget] = useState<CommentView | null>(null);
  const [localReplies, setLocalReplies] = useState<CommentView[]>([]);
  const [keyboardOffset, setKeyboardOffset] = useState(0);
  const [isLinkBannerPressed, setIsLinkBannerPressed] = useState(false);
  const { share, toastVisible, setToastVisible } = useShare();

  useEffect(() => {
    if (!replyTarget || !window.visualViewport) return;
    const vv = window.visualViewport;
    const handler = () => {
      setKeyboardOffset(window.innerHeight - vv.height - vv.offsetTop);
    };
    vv.addEventListener('resize', handler);
    handler();
    return () => {
      vv.removeEventListener('resize', handler);
      setKeyboardOffset(0);
    };
  }, [replyTarget]);

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

  const isImage = !!p.url && isImageUrl(p.url);
  const imageSrc = isImage ? p.url : p.thumbnail_url;
  const showLinkBanner = !!p.url && !isImage;

  const handleShare = () => share(p.name, getShareUrl(auth.instance, p.id));

  const handleReplySubmit = async (content: string) => {
    const parentApId = replyTarget!.comment.ap_id;
    const parentId = await resolveCommentId(auth.instance, auth.token, parentApId).catch(() => null)
      ?? replyTarget!.comment.id;
    const newComment = await createComment(auth.instance, auth.token, p.id, content, parentId);
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
          if (scrollRef.current && scrollRef.current.scrollTop <= 0 && delta > 0) {
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

        {showLinkBanner && (
          <div
            data-testid="link-banner"
            className={isLinkBannerPressed ? `${styles.linkBanner} ${styles.linkBannerPressed}` : styles.linkBanner}
            onPointerDown={() => setIsLinkBannerPressed(true)}
            onPointerUp={() => setIsLinkBannerPressed(false)}
            onPointerLeave={() => setIsLinkBannerPressed(false)}
            onClick={() => window.open(p.url!, '_blank', 'noopener,noreferrer')}
          >
            <span className={styles.linkBannerIcon}>🔗</span>
            <div className={styles.linkBannerContent}>
              <div className={styles.linkBannerDomain}>{instanceFromActorId(p.url!)}</div>
              <div className={styles.linkBannerHint}>Tap to open link</div>
            </div>
            <span className={styles.linkBannerArrow}>↗</span>
          </div>
        )}

        {imageSrc && <img className={styles.image} src={imageSrc} alt="" loading="lazy" />}

        {p.body && <div className={styles.excerpt}>{p.body}</div>}

        <div className={styles.footer}>
          <span>▲ {counts.score}</span>
          <span>💬 {counts.comments}</span>
          <button
            data-testid="share-button"
            className={styles.shareButton}
            onClick={handleShare}
          >
            Share ↗
          </button>
        </div>

        <div className={styles.commentsSection}>
          {commentsLoaded && comments.length === 0 && counts.comments > 0 && (
            <a
              className={styles.commentsFallback}
              href={p.ap_id}
              target="_blank"
              rel="noopener noreferrer"
            >
              {counts.comments} comments — view on {instanceFromActorId(p.ap_id)}
            </a>
          )}
          <CommentList
            comments={comments}
            localReplies={localReplies}
            auth={auth}
            onSetReplyTarget={setReplyTarget}
          />
        </div>
      </div>
      <div
        data-testid="reply-wrapper"
        style={{ position: 'absolute', left: 0, right: 0, bottom: keyboardOffset }}
      >
        <ReplySheet
          target={replyTarget}
          onSubmit={handleReplySubmit}
          onClose={() => setReplyTarget(null)}
        />
      </div>
      <Toast message="Link copied" visible={toastVisible} onHide={() => setToastVisible(false)} />
    </motion.div>
  );
}
