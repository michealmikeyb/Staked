import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  resolveCommentId, createComment, editComment, savePost,
  type CommentView,
} from '../lib/lemmy';
import { type AuthState } from '../lib/store';
import { instanceFromActorId, isImageUrl, getShareUrl } from '../lib/urlUtils';
import { useShare } from '../hooks/useShare';
import CommentList from './CommentList';
import ReplySheet from './ReplySheet';
import Toast from './Toast';
import MarkdownRenderer from './MarkdownRenderer';
import CreatorAvatar from './CreatorAvatar';
import styles from './PostCard.module.css';

interface Post {
  id: number;
  name: string;
  ap_id: string;
  url?: string | null;
  body?: string | null;
  thumbnail_url?: string | null;
  nsfw?: boolean;
}

interface Community {
  name: string;
  actor_id: string;
}

interface Creator {
  name: string;
  display_name?: string | null;
  avatar?: string | null;
  actor_id?: string;
}

interface Counts {
  score: number;
  comments: number;
}

interface Props {
  post: Post;
  community: Community;
  creator: Creator;
  counts: Counts;
  auth?: AuthState;
  comments: CommentView[];
  commentsLoaded: boolean;
  highlightCommentId?: number;
  scrollRef?: React.RefObject<HTMLDivElement>;
  onTouchStart?: React.TouchEventHandler<HTMLDivElement>;
  onTouchMove?: React.TouchEventHandler<HTMLDivElement>;
  onTouchEnd?: React.TouchEventHandler<HTMLDivElement>;
  blurNsfw?: boolean;
}

type SheetState =
  | { mode: 'reply'; target: CommentView }
  | { mode: 'edit'; target: CommentView }
  | { mode: 'new' }
  | null;

export default function PostCardShell({
  post, community, creator, counts, auth,
  comments, commentsLoaded, highlightCommentId,
  scrollRef: scrollRefProp, onTouchStart, onTouchMove, onTouchEnd,
  blurNsfw = true,
}: Props) {
  const navigate = useNavigate();
  const internalRef = useRef<HTMLDivElement>(null);
  const scrollRef = scrollRefProp ?? internalRef;

  const [nsfwRevealed, setNsfwRevealed] = useState(false);
  const [sheetState, setSheetState] = useState<SheetState>(null);
  const [localReplies, setLocalReplies] = useState<CommentView[]>([]);
  const [localEdits, setLocalEdits] = useState<Record<number, string>>({});
  const [keyboardOffset, setKeyboardOffset] = useState(0);
  const [saveToastVisible, setSaveToastVisible] = useState(false);
  const [isLinkBannerPressed, setIsLinkBannerPressed] = useState(false);
  const { share, toastVisible, setToastVisible } = useShare();

  const instance = instanceFromActorId(community.actor_id);
  const isImage = !!post.url && isImageUrl(post.url);
  const imageSrc = isImage ? post.url : post.thumbnail_url;
  const showLinkBanner = !!post.url && !isImage;
  const showNsfwBlur = !!post.nsfw && blurNsfw && !nsfwRevealed;

  useEffect(() => {
    if (!sheetState || !window.visualViewport) return;
    const vv = window.visualViewport;
    const handler = () => setKeyboardOffset(window.innerHeight - vv.height - vv.offsetTop);
    vv.addEventListener('resize', handler);
    handler();
    return () => { vv.removeEventListener('resize', handler); setKeyboardOffset(0); };
  }, [sheetState]);

  useEffect(() => {
    if (highlightCommentId == null) return;
    const timeout = setTimeout(() => {
      const el = scrollRef.current?.querySelector(`[data-comment-id="${highlightCommentId}"]`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
    return () => clearTimeout(timeout);
  }, [highlightCommentId, scrollRef]);

  useEffect(() => {
    if (sheetState?.mode !== 'reply') return;
    const el = scrollRef.current?.querySelector(`[data-comment-id="${sheetState.target.comment.id}"]`);
    el?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
  }, [sheetState, scrollRef]);

  const handleShare = () => share(post.name, getShareUrl(auth?.instance ?? instance, post.id));

  const handleSave = async () => {
    if (!auth) return;
    await savePost(auth.instance, auth.token, post.id);
    setSaveToastVisible(true);
  };

  const handleCommentCreate = async (content: string, parentComment?: CommentView) => {
    if (!auth) return;
    const parentId = parentComment
      ? await resolveCommentId(auth.instance, auth.token, parentComment.comment.ap_id).catch(() => null) ?? parentComment.comment.id
      : undefined;
    const newComment = await createComment(auth.instance, auth.token, post.id, content, parentId);
    const pathPrefix = parentComment?.comment.path ?? '0';
    setLocalReplies(prev => [...prev, {
      ...newComment,
      comment: { ...newComment.comment, path: pathPrefix + '.' + newComment.comment.id },
    }]);
  };

  const handleEditSubmit = async (content: string, target: CommentView) => {
    if (!auth) return;
    const localId = await resolveCommentId(auth.instance, auth.token, target.comment.ap_id).catch(() => null) ?? target.comment.id;
    await editComment(auth.instance, auth.token, localId, content);
    setLocalEdits(prev => ({ ...prev, [target.comment.id]: content }));
  };

  const handleSubmit = async (content: string) => {
    if (!sheetState) return;
    if (sheetState.mode === 'reply') await handleCommentCreate(content, sheetState.target);
    else if (sheetState.mode === 'edit') await handleEditSubmit(content, sheetState.target);
    else await handleCommentCreate(content);
    setSheetState(null);
  };

  const initialEditContent = sheetState?.mode === 'edit'
    ? (localEdits[sheetState.target.comment.id] ?? sheetState.target.comment.content)
    : undefined;

  return (
    <div style={{ position: 'relative', flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
      <div
        ref={scrollRef}
        data-testid="scroll-content"
        className={styles.scrollContent}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
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
            {creator.actor_id ? (
              <button
                className={styles.creatorLink}
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/user/${instanceFromActorId(creator.actor_id!)}/${creator.name}`);
                }}
              >
                <CreatorAvatar name={creator.name} avatar={creator.avatar ?? undefined} size={16} />
                {creator.display_name ?? creator.name}
              </button>
            ) : (
              <div className={styles.instanceName}>{creator.display_name ?? creator.name}</div>
            )}
          </div>
          <div className={styles.metaStats}>
            <span data-testid="meta-score">▲ {counts.score}</span>
            <span data-testid="meta-comments">💬 {counts.comments}</span>
          </div>
        </div>

        <div className={styles.title}>{post.name}</div>

        {showLinkBanner && (
          <div
            data-testid="link-banner"
            className={isLinkBannerPressed ? `${styles.linkBanner} ${styles.linkBannerPressed}` : styles.linkBanner}
            onPointerDown={() => setIsLinkBannerPressed(true)}
            onPointerUp={() => setIsLinkBannerPressed(false)}
            onPointerLeave={() => setIsLinkBannerPressed(false)}
            onClick={() => window.open(post.url!, '_blank', 'noopener,noreferrer')}
          >
            <span className={styles.linkBannerIcon}>🔗</span>
            <div className={styles.linkBannerContent}>
              <div className={styles.linkBannerDomain}>{instanceFromActorId(post.url!)}</div>
              <div className={styles.linkBannerHint}>Tap to open link</div>
            </div>
            <span className={styles.linkBannerArrow}>↗</span>
          </div>
        )}

        {imageSrc && (
          showNsfwBlur ? (
            <div
              data-testid="nsfw-blur-overlay"
              role="button"
              tabIndex={0}
              aria-label="Tap to reveal NSFW image"
              onClick={() => setNsfwRevealed(true)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setNsfwRevealed(true); }}
              style={{
                position: 'relative', cursor: 'pointer',
                borderRadius: 8, overflow: 'hidden',
                background: '#2a2d35', height: 180,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <div style={{
                position: 'absolute', inset: 0,
                background: 'linear-gradient(135deg,#3a2d35,#2a2d3a)',
                filter: 'blur(20px)', transform: 'scale(1.1)',
              }} />
              <div style={{
                position: 'relative', zIndex: 1,
                background: '#2a2d35', border: '1px solid #3a3d45',
                borderRadius: 10, padding: '8px 18px', textAlign: 'center',
              }}>
                <div style={{ color: '#f5f5f5', fontSize: 13, fontWeight: 600 }}>Tap to reveal NSFW</div>
              </div>
            </div>
          ) : (
            <img className={styles.image} src={imageSrc} alt="" loading="lazy" />
          )
        )}

        {post.body && <MarkdownRenderer content={post.body} className={styles.excerpt} />}

        <div className={styles.footer}>
          {auth && (
            <button
              data-testid="save-button"
              className={styles.footerAction}
              onClick={handleSave}
            >
              🔖 Save
            </button>
          )}
          <button
            data-testid="share-button"
            className={styles.footerAction}
            onClick={handleShare}
          >
            Share ↗
          </button>
          {auth && (
            <button
              data-testid="comment-button"
              className={styles.footerAction}
              onClick={() => setSheetState({ mode: 'new' })}
            >
              💬 Comment
            </button>
          )}
        </div>

        <div className={styles.commentsSection}>
          {commentsLoaded && comments.length === 0 && counts.comments > 0 && (
            <a
              className={styles.commentsFallback}
              href={post.ap_id}
              target="_blank"
              rel="noopener noreferrer"
            >
              {counts.comments} comments — view on {instanceFromActorId(post.ap_id)}
            </a>
          )}
          <CommentList
            comments={comments}
            localReplies={localReplies}
            auth={auth ?? { instance, token: '', username: '' }}
            onSetReplyTarget={(cv) => setSheetState({ mode: 'reply', target: cv })}
            onEdit={(cv) => setSheetState({ mode: 'edit', target: cv })}
            localEdits={localEdits}
            highlightCommentId={highlightCommentId}
          />
        </div>
      </div>

      {auth && (
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
      )}

      <Toast message="Saved" visible={saveToastVisible} onHide={() => setSaveToastVisible(false)} />
      <Toast message="Link copied" visible={toastVisible} onHide={() => setToastVisible(false)} />
    </div>
  );
}
