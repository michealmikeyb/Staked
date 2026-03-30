import { useState, useEffect, useRef, useMemo } from 'react';
import {
  resolveCommentId, createComment, type CommentView,
} from '../lib/lemmy';
import { type AuthState } from '../lib/store';
import { instanceFromActorId, isImageUrl } from '../lib/urlUtils';
import { useCommentLoader } from '../hooks/useCommentLoader';
import CommentList from './CommentList';
import ReplySheet from './ReplySheet';
import styles from './PostCard.module.css';

interface Post {
  id: number;
  name: string;
  ap_id: string;
  url?: string | null;
  body?: string | null;
  thumbnail_url?: string | null;
}

interface Community {
  name: string;
  actor_id: string;
}

interface Creator {
  name: string;
  display_name?: string | null;
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
  auth: AuthState;
  notifCommentApId?: string;
}

export default function PostDetailCard({
  post, community, creator, counts, auth, notifCommentApId,
}: Props) {
  const [replyTarget, setReplyTarget] = useState<CommentView | null>(null);
  const [localReplies, setLocalReplies] = useState<CommentView[]>([]);
  const [keyboardOffset, setKeyboardOffset] = useState(0);
  const [isLinkBannerPressed, setIsLinkBannerPressed] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { comments, commentsLoaded, resolvedInstanceRef, resolvedTokenRef } = useCommentLoader(
    { ap_id: post.ap_id, id: post.id },
    { actor_id: community.actor_id },
    auth,
  );

  const highlightCommentId = useMemo(() => {
    if (!commentsLoaded || !notifCommentApId) return undefined;
    return comments.find((c) => c.comment.ap_id === notifCommentApId)?.comment.id;
  }, [comments, commentsLoaded, notifCommentApId]);

  useEffect(() => {
    if (highlightCommentId == null) return;
    const timeout = setTimeout(() => {
      const el = scrollRef.current?.querySelector(`[data-comment-id="${highlightCommentId}"]`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
    return () => clearTimeout(timeout);
  }, [highlightCommentId]);

  useEffect(() => {
    if (!replyTarget || !window.visualViewport) return;
    const vv = window.visualViewport;
    const handler = () => setKeyboardOffset(window.innerHeight - vv.height - vv.offsetTop);
    vv.addEventListener('resize', handler);
    handler();
    return () => { vv.removeEventListener('resize', handler); setKeyboardOffset(0); };
  }, [replyTarget]);

  const handleReplySubmit = async (content: string) => {
    const parentApId = replyTarget!.comment.ap_id;
    const parentId =
      await resolveCommentId(auth.instance, auth.token, parentApId).catch(() => null)
      ?? replyTarget!.comment.id;
    const newComment = await createComment(
      auth.instance, auth.token, post.id, content, parentId,
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
          <span>💬 {counts.comments} replies</span>
        </div>

        <div className={styles.commentsSection}>
          {commentsLoaded && comments.length === 0 && counts.comments > 0 && (
            <a
              className={styles.commentsFallback}
              href={post.ap_id}
              target="_blank"
              rel="noopener noreferrer"
            >
              {counts.comments} replies — view on {instanceFromActorId(post.ap_id)}
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
  );
}
