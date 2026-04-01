import { useMemo, useEffect, useState, useRef } from 'react';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import { useDrag } from '@use-gesture/react';
import { useNavigate } from 'react-router-dom';
import { resolveCommentId, createComment, editComment, type PostView, type CommentView } from '../lib/lemmy';
import { type AuthState } from '../lib/store';
import CommentList from './CommentList';
import ReplySheet from './ReplySheet';
import styles from './PostCard.module.css';
import { useCommentLoader } from '../hooks/useCommentLoader';
import { useShare } from '../hooks/useShare';
import { instanceFromActorId, isImageUrl, getShareUrl } from '../lib/urlUtils';
import CreatorAvatar from './CreatorAvatar';
import Toast from './Toast';

const SWIPE_THRESHOLD = 120;
const VELOCITY_THRESHOLD = 0.5;

type SheetState =
  | { mode: 'reply'; target: CommentView }
  | { mode: 'edit';  target: CommentView }
  | { mode: 'new' }
  | null;

interface Props {
  post: PostView;
  auth: AuthState;
  zIndex: number;
  scale: number;
  onSwipeRight: () => void;
  onSwipeLeft: () => void;
  onUndo: () => void;
  onSave: () => void;
}

export default function PostCard({ post, auth, zIndex, scale, onSwipeRight, onSwipeLeft, onUndo, onSave }: Props) {
  const { post: p, community, creator, counts } = post;
  const instance = useMemo(() => instanceFromActorId(community.actor_id), [community.actor_id]);
  const { comments, commentsLoaded } = useCommentLoader(p, community, auth);
  const [sheetState, setSheetState] = useState<SheetState>(null);
  const [localReplies, setLocalReplies] = useState<CommentView[]>([]);
  const [localEdits, setLocalEdits] = useState<Record<number, string>>({});
  const [keyboardOffset, setKeyboardOffset] = useState(0);
  const [isLinkBannerPressed, setIsLinkBannerPressed] = useState(false);
  const { share, toastVisible, setToastVisible } = useShare();
  const [saveToastVisible, setSaveToastVisible] = useState(false);
  const navigate = useNavigate();

  // Raise card when keyboard appears
  useEffect(() => {
    if (!sheetState || !window.visualViewport) return;
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
  }, [sheetState]);

  // Scroll parent comment into view when replying
  useEffect(() => {
    if (sheetState?.mode !== 'reply') return;
    const el = scrollRef.current?.querySelector(
      `[data-comment-id="${sheetState.target.comment.id}"]`,
    );
    el?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
  }, [sheetState]);

  const x = useMotionValue(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef(0);
  const [pullDelta, setPullDelta] = useState(0);

  // Right swipe rotates CCW ("lifting"), left swipe CW ("sinking")
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

  const handleCommentCreate = async (content: string, parentComment?: CommentView) => {
    const parentId = parentComment
      ? await resolveCommentId(auth.instance, auth.token, parentComment.comment.ap_id).catch(() => null) ?? parentComment.comment.id
      : undefined;
    const newComment = await createComment(auth.instance, auth.token, p.id, content, parentId);
    const pathPrefix = parentComment?.comment.path ?? '0';
    setLocalReplies(prev => [...prev, {
      ...newComment,
      comment: { ...newComment.comment, path: pathPrefix + '.' + newComment.comment.id },
    }]);
  };

  const handleEditSubmit = async (content: string, target: CommentView) => {
    const localId =
      await resolveCommentId(auth.instance, auth.token, target.comment.ap_id).catch(() => null)
      ?? target.comment.id;
    await editComment(auth.instance, auth.token, localId, content);
    setLocalEdits((prev) => ({ ...prev, [target.comment.id]: content }));
  };

  const handleSubmit = async (content: string) => {
    if (!sheetState) return;
    if (sheetState.mode === 'reply') {
      await handleCommentCreate(content, sheetState.target);
    } else if (sheetState.mode === 'edit') {
      await handleEditSubmit(content, sheetState.target);
    } else {
      await handleCommentCreate(content);
    }
    // Only reached on success — errors re-throw to ReplySheet's catch block, keeping the sheet open.
    setSheetState(null);
  };

  const initialEditContent =
    sheetState?.mode === 'edit'
      ? (localEdits[sheetState.target.comment.id] ?? sheetState.target.comment.content)
      : undefined;

  return (
    <motion.div
      className={styles.card}
      style={{ zIndex, x, rotate, scale }}
      {...(bind() as object)}
    >
      <motion.div className={styles.overlay} style={{ backgroundColor: overlayColor }} />
      <motion.div
        className={styles.undoOverlay}
        style={{ opacity: Math.min(pullDelta / 80, 1) }}
      >
        <span style={{ fontSize: '3rem' }}>↩</span>
      </motion.div>

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
          if (pullDelta >= 80) onUndo();
          setPullDelta(0);
        }}
      >
        <div className={styles.meta}>
          <div className={styles.communityIcon}>{community.name.charAt(0).toUpperCase()}</div>
          <div>
            <div
              className={styles.communityName}
              style={{ cursor: 'pointer' }}
              onClick={() => navigate(`/community/${instance}/${community.name}`)}
            >
              c/{community.name}
            </div>
            <div className={styles.instanceName}>{instance}</div>
            <button
              className={styles.creatorLink}
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/user/${instanceFromActorId(creator.actor_id)}/${creator.name}`);
              }}
            >
              <CreatorAvatar name={creator.name} avatar={creator.avatar} size={16} />
              {creator.display_name ?? creator.name}
            </button>
          </div>
          <div className={styles.metaStats}>
            <span data-testid="meta-score">▲ {counts.score}</span>
            <span data-testid="meta-comments">💬 {counts.comments}</span>
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
          <button
            data-testid="save-button"
            className={styles.footerAction}
            onClick={(e) => { e.stopPropagation(); onSave(); setSaveToastVisible(true); }}
          >
            🔖 Save
          </button>
          <button
            data-testid="share-button"
            className={styles.footerAction}
            onClick={handleShare}
          >
            Share ↗
          </button>
          <button
            data-testid="comment-button"
            className={styles.footerAction}
            onClick={(e) => { e.stopPropagation(); setSheetState({ mode: 'new' }); }}
          >
            💬 Comment
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
            onSetReplyTarget={(cv) => setSheetState({ mode: 'reply', target: cv })}
            onEdit={(cv) => setSheetState({ mode: 'edit', target: cv })}
            localEdits={localEdits}
          />
        </div>
      </div>
      <div
        data-testid="reply-wrapper"
        style={{ position: 'absolute', left: 0, right: 0, bottom: keyboardOffset }}
      >
        <ReplySheet
          mode={sheetState?.mode ?? null}
          target={sheetState && sheetState.mode !== 'new' ? sheetState.target : undefined}
          initialContent={initialEditContent}
          onSubmit={handleSubmit}
          onClose={() => setSheetState(null)}
        />
      </div>
      <Toast message="Link copied" visible={toastVisible} onHide={() => setToastVisible(false)} />
      <Toast message="Saved" visible={saveToastVisible} onHide={() => setSaveToastVisible(false)} />
    </motion.div>
  );
}
