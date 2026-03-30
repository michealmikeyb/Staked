import { useState, useEffect, useRef } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import {
  markReplyAsRead, markMentionAsRead, createComment, resolveCommentId,
  type CommentView, type NotifItem,
} from '../lib/lemmy';
import { type AuthState } from '../lib/store';
import { instanceFromActorId, isImageUrl } from '../lib/urlUtils';
import { useCommentLoader } from '../hooks/useCommentLoader';
import HeaderBar from './HeaderBar';
import CommentList from './CommentList';
import ReplySheet from './ReplySheet';
import styles from './PostCard.module.css';

const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

interface Props {
  auth: AuthState;
  setUnreadCount: React.Dispatch<React.SetStateAction<number>>;
}

export default function PostDetailPage({ auth, setUnreadCount }: Props) {
  useParams<{ notifId: string }>();
  const { state } = useLocation();
  const navigate = useNavigate();
  const notification = state?.notification as NotifItem | undefined;

  const [replyTarget, setReplyTarget] = useState<CommentView | null>(null);
  const [localReplies, setLocalReplies] = useState<CommentView[]>([]);
  const [keyboardOffset, setKeyboardOffset] = useState(0);
  const [isLinkBannerPressed, setIsLinkBannerPressed] = useState(false);
  const [showDrawer, setShowDrawer] = useState(false);
  const markedReadRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { comments, commentsLoaded, resolvedInstanceRef, resolvedTokenRef } = useCommentLoader(
    notification?.data.post ?? { ap_id: '', id: 0 },
    notification?.data.community ?? { actor_id: '' },
    auth,
  );

  // Match the notification comment by ap_id to get the source-instance local ID,
  // since the notification ID is from the home instance which differs on federated posts.
  const notifCommentApId = notification?.data.comment.ap_id;
  const highlightCommentId = commentsLoaded
    ? comments.find((c) => c.comment.ap_id === notifCommentApId)?.comment.id
    : undefined;

  // Scroll highlighted comment into view once resolved
  useEffect(() => {
    if (highlightCommentId == null) return;
    const timeout = setTimeout(() => {
      const el = scrollRef.current?.querySelector(`[data-comment-id="${highlightCommentId}"]`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
    return () => clearTimeout(timeout);
  }, [highlightCommentId]);

  // Mark as read on mount (once)
  useEffect(() => {
    if (!notification) return;
    if (markedReadRef.current) return;
    markedReadRef.current = true;

    const doMark = async () => {
      if (notification.type === 'reply') {
        await markReplyAsRead(auth.instance, auth.token, notification.data.comment_reply.id);
      } else {
        await markMentionAsRead(auth.instance, auth.token, notification.data.person_mention.id);
      }
      setUnreadCount((prev) => Math.max(0, prev - 1));
    };
    doMark().catch(() => {});
  }, [auth, notification, setUnreadCount]);

  // Keyboard offset for reply sheet
  useEffect(() => {
    if (!replyTarget || !window.visualViewport) return;
    const vv = window.visualViewport;
    const handler = () => setKeyboardOffset(window.innerHeight - vv.height - vv.offsetTop);
    vv.addEventListener('resize', handler);
    handler();
    return () => { vv.removeEventListener('resize', handler); setKeyboardOffset(0); };
  }, [replyTarget]);

  if (!notification) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', background: '#13151a' }}>
        <HeaderBar onMenuOpen={() => {}} />
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888' }}>
          Navigate to Inbox to view this notification.
        </div>
      </div>
    );
  }

  const post = notification.data.post;
  const community = notification.data.community;
  const creator = notification.data.creator;
  const counts = notification.data.counts;

  const handleReplySubmit = async (content: string) => {
    const parentApId = replyTarget!.comment.ap_id;
    const parentId =
      await resolveCommentId(resolvedInstanceRef.current, resolvedTokenRef.current, parentApId).catch(() => null)
      ?? replyTarget!.comment.id;
    const newComment = await createComment(
      resolvedInstanceRef.current, resolvedTokenRef.current, post.id, content, parentId,
    );
    const remapped = {
      ...newComment,
      comment: { ...newComment.comment, path: replyTarget!.comment.path + '.' + newComment.comment.id },
    };
    setLocalReplies((prev) => [...prev, remapped]);
    setReplyTarget(null);
  };

  const isImage = !!post.url && isImageUrl(post.url);
  const imageSrc = isImage ? post.url : post.thumbnail_url;
  const showLinkBanner = !!post.url && !isImage;

  const communityInstance = instanceFromActorId(community.actor_id);
  const communityInitial = community.name.charAt(0).toUpperCase();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', background: '#13151a' }}>
      <HeaderBar
        onMenuOpen={() => setShowDrawer((v) => !v)}
        onLogoClick={() => navigate('/')}
        leftContent={
          isIOS ? (
            <button
              onClick={() => navigate('/inbox')}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: '#aaa', fontSize: 13, display: 'flex', alignItems: 'center', gap: 4,
              }}
            >
              ← Inbox
            </button>
          ) : undefined
        }
      />
      <div style={{ flex: 1, display: 'flex', alignItems: 'flex-start', justifyContent: 'center' }}>
        <div style={{
          position: 'relative', width: '92vw', maxWidth: 440,
          height: 'calc(100dvh - 72px)',
          borderRadius: 20, background: 'var(--card-bg, #1e2128)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)', margin: '12px 0',
          display: 'flex', flexDirection: 'column',
        }}>
          <div ref={scrollRef} className={styles.scrollContent}>
            <div className={styles.meta}>
              <div className={styles.communityIcon}>{communityInitial}</div>
              <div>
                <div className={styles.communityName}>c/{community.name}</div>
                <div className={styles.instanceName}>
                  {communityInstance} • {creator.display_name ?? creator.name}
                </div>
              </div>
            </div>

            <div className={styles.title}>{post.name}</div>

            {showLinkBanner && (
              <div
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

            {imageSrc && <img className={styles.image} src={imageSrc} alt="" loading="lazy" />}

            {post.body && <div className={styles.excerpt}>{post.body}</div>}

            <div className={styles.footer}>
              <span>▲ {counts.score}</span>
              <span>💬 {counts.child_count} replies</span>
            </div>

            <div className={styles.commentsSection}>
              {commentsLoaded && comments.length === 0 && counts.child_count > 0 && (
                <a
                  className={styles.commentsFallback}
                  href={post.ap_id}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {counts.child_count} replies — view on {instanceFromActorId(post.ap_id)}
                </a>
              )}
              <CommentList
                comments={comments}
                localReplies={localReplies}
                auth={auth}
                onSetReplyTarget={setReplyTarget}
                highlightCommentId={highlightCommentId}
              />
            </div>
          </div>
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: keyboardOffset }}>
            <ReplySheet
              target={replyTarget}
              onSubmit={handleReplySubmit}
              onClose={() => setReplyTarget(null)}
            />
          </div>
        </div>
      </div>
      {showDrawer && (
        <>
          <div
            onClick={() => setShowDrawer(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 39 }}
          />
          <div style={{
            position: 'fixed', top: 48, left: 0, right: 0,
            background: '#1a1d24', borderBottom: '1px solid #2a2d35',
            zIndex: 40, padding: 16,
          }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              <button
                onClick={() => setShowDrawer(false)}
                style={{
                  background: '#2a2d35', border: 'none', borderRadius: 12,
                  cursor: 'pointer', padding: '14px 8px',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                  color: '#f5f5f5', fontSize: 12, fontWeight: 500,
                }}
              >
                <span style={{ fontSize: 22 }}>🔖</span>
                Saved
              </button>
              <button
                onClick={() => setShowDrawer(false)}
                style={{
                  background: '#2a2d35', border: 'none', borderRadius: 12,
                  cursor: 'pointer', padding: '14px 8px',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                  color: '#f5f5f5', fontSize: 12, fontWeight: 500,
                }}
              >
                <span style={{ fontSize: 22 }}>👤</span>
                Profile
              </button>
              <button
                onClick={() => { setShowDrawer(false); navigate('/inbox'); }}
                style={{
                  background: '#2a2d35', border: 'none', borderRadius: 12,
                  cursor: 'pointer', padding: '14px 8px',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                  color: '#f5f5f5', fontSize: 12, fontWeight: 500,
                }}
              >
                <span style={{ fontSize: 22 }}>📬</span>
                Inbox
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
