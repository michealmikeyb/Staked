import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBackend } from '../lib/api/context';
import type { Post, Comment } from '../lib/api/types';
import { useSettings } from '../lib/SettingsContext';
import { instanceFromActorId, isImageUrl, buildShareUrl } from '../lib/urlUtils';
import { useShare } from '../hooks/useShare';
import CommentList from './CommentList';
import ReplySheet from './ReplySheet';
import ReportSheet, { type ReportTarget } from './ReportSheet';
import Toast from './Toast';
import MarkdownRenderer from './MarkdownRenderer';
import CreatorAvatar from './CreatorAvatar';
import CommunityAvatar from './CommunityAvatar';
import styles from './PostCard.module.css';

function timeAgo(published: string): string {
  const seconds = Math.floor((Date.now() - new Date(published).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return `${Math.floor(days / 7)}w`;
}

interface Props {
  post: Post;
  comments: Comment[];
  commentsLoaded: boolean;
  highlightCommentId?: string;
  scrollRef?: React.RefObject<HTMLDivElement>;
  onTouchStart?: React.TouchEventHandler<HTMLDivElement>;
  onTouchMove?: React.TouchEventHandler<HTMLDivElement>;
  onTouchEnd?: React.TouchEventHandler<HTMLDivElement>;
  blurNsfw?: boolean;
  activeSort?: string;
  onSortChange?: (sort: string) => void;
  onLoadMore?: () => void;
  loadingMore?: boolean;
}

const noop = () => {};

type SheetState =
  | { mode: 'reply'; target: Comment }
  | { mode: 'edit'; target: Comment }
  | { mode: 'new' }
  | null;


export default function PostCardShell({
  post,
  comments, commentsLoaded, highlightCommentId,
  scrollRef: scrollRefProp, onTouchStart, onTouchMove, onTouchEnd,
  blurNsfw = true,
  activeSort = 'Top',
  onSortChange = noop,
  onLoadMore,
  loadingMore,
}: Props) {
  const navigate = useNavigate();
  const backend = useBackend();
  const hasSources = backend.capabilities.hasSources;
  const { settings } = useSettings();
  const internalRef = useRef<HTMLDivElement>(null);
  const scrollRef = scrollRefProp ?? internalRef;
  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!onLoadMore || !sentinelRef.current) return;
    const obs = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) onLoadMore(); },
      { threshold: 0, root: scrollRef.current },
    );
    obs.observe(sentinelRef.current);
    return () => obs.disconnect();
  }, [onLoadMore, scrollRef]);

  const isLoggedIn = !!backend.session?.viewer;

  const srcParts = post.source.handle.split('@');
  const srcName = srcParts[0] ?? post.source.handle;
  const srcInstance = srcParts[1] ?? '';

  const authorParts = post.author.handle.split('@');
  const authorName = authorParts[0] ?? post.author.handle;
  const authorInstance = authorParts[1] ?? '';

  const isImage = !!post.externalUrl && isImageUrl(post.externalUrl);
  const imageSrc = isImage ? post.externalUrl : (post.mediaUrl ?? null);
  const showLinkBanner = !!post.externalUrl && !isImage;

  const [nsfwRevealed, setNsfwRevealed] = useState(false);
  const [sheetState, setSheetState] = useState<SheetState>(null);
  const [localReplies, setLocalReplies] = useState<Comment[]>([]);
  const [localEdits, setLocalEdits] = useState<Record<string, string>>({});
  const [keyboardOffset, setKeyboardOffset] = useState(0);
  const [localSaved, setLocalSaved] = useState(post.viewer?.saved ?? false);
  const [reportTarget, setReportTarget] = useState<ReportTarget>(null);
  const [saveToastVisible, setSaveToastVisible] = useState(false);
  const { share, toastVisible, setToastVisible } = useShare();

  const showNsfwBlur = post.nsfw && blurNsfw && !nsfwRevealed;

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
    const el = scrollRef.current?.querySelector(`[data-comment-id="${sheetState.target.id}"]`);
    el?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
  }, [sheetState, scrollRef]);

  const handleShare = () => {
    if (!backend.capabilities.hasSources) {
      share(post.title ?? '', post.permalink);
      return;
    }
    const pipeIdx = post.id.indexOf('|');
    const localId = pipeIdx >= 0 ? parseInt(post.id.slice(0, pipeIdx), 10) : 0;
    const communityActorId = srcInstance ? `https://${srcInstance}/c/${srcName}` : '';
    const viewerHandle = backend.session?.viewer?.handle ?? '';
    const viewerInstance = viewerHandle.includes('@') ? viewerHandle.split('@')[1] : '';
    const shareAuth = viewerInstance ? { instance: viewerInstance } : null;
    const url = buildShareUrl(settings.shareLinkFormat, { id: localId, ap_id: post.permalink }, shareAuth, communityActorId);
    share(post.title ?? '', url);
  };

  const handleReport = (comment: Comment) => {
    setReportTarget({ type: 'comment', commentId: comment.id });
  };

  const handleSave = async () => {
    if (!isLoggedIn) return;
    const newSaved = !localSaved;
    setLocalSaved(newSaved);
    try {
      await backend.posts.save(post.id, newSaved);
      if (newSaved) setSaveToastVisible(true);
    } catch {
      setLocalSaved(!newSaved);
    }
  };

  const handleCommentCreate = async (content: string, parentComment?: Comment) => {
    const newComment = await backend.comments.create({
      postId: post.id,
      parentId: parentComment?.id,
      body: content,
    });
    // Server encodes parentId from path with empty apId ("X|") but local comments use
    // full encoded IDs ("X|https://..."). Align parentId so tree traversal in CommentList works.
    const corrected = parentComment ? { ...newComment, parentId: parentComment.id } : newComment;
    setLocalReplies(prev => [...prev, corrected]);
  };

  const handleEditSubmit = async (content: string, target: Comment) => {
    await backend.comments.edit(target.id, content);
    setLocalEdits(prev => ({ ...prev, [target.id]: content }));
  };

  const handleSubmit = async (content: string) => {
    if (!sheetState) return;
    if (sheetState.mode === 'reply') await handleCommentCreate(content, sheetState.target);
    else if (sheetState.mode === 'edit') await handleEditSubmit(content, sheetState.target);
    else await handleCommentCreate(content);
    setSheetState(null);
  };

  const initialEditContent = sheetState?.mode === 'edit'
    ? (localEdits[sheetState.target.id] ?? sheetState.target.body)
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
          {hasSources ? (
            <>
              <CommunityAvatar name={srcName} icon={post.source.icon} size={32} />
              <div>
                <div
                  className={styles.communityName}
                  style={{ cursor: 'pointer' }}
                  onClick={() => navigate(`/community/${srcInstance}/${srcName}`)}
                >
                  c/{srcName}
                </div>
                <div className={styles.instanceName}>{srcInstance}</div>
                {authorInstance ? (
                  <button
                    className={styles.creatorLink}
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/user/${authorInstance}/${authorName}`);
                    }}
                  >
                    <CreatorAvatar name={authorName} avatar={post.author.avatar} size={16} />
                    {post.author.displayName ?? authorName}
                  </button>
                ) : (
                  <div className={styles.instanceName}>{post.author.displayName ?? post.author.handle}</div>
                )}
              </div>
            </>
          ) : (
            <>
              <CreatorAvatar name={authorName} avatar={post.author.avatar} size={32} />
              <div>
                <div className={styles.communityName}>{post.author.displayName ?? authorName}</div>
                <div className={styles.instanceName}>@{post.author.handle}</div>
              </div>
            </>
          )}
          <div className={styles.metaStats}>
            <span data-testid="meta-score">▲ {post.counts.score}</span>
            <span data-testid="meta-comments">💬 {post.counts.comments}</span>
            <span data-testid="meta-age">{timeAgo(post.publishedAt)}</span>
          </div>
        </div>

        <div className={styles.title}>{post.title}</div>

        {showLinkBanner && (
          <div
            data-testid="link-banner"
            className={styles.linkBanner}
            onClick={() => window.open(post.externalUrl!, '_blank', 'noopener,noreferrer')}
          >
            <span className={styles.linkBannerIcon}>🔗</span>
            <div className={styles.linkBannerContent}>
              <div className={styles.linkBannerDomain}>{instanceFromActorId(post.externalUrl!)}</div>
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
          {isLoggedIn && backend.capabilities.hasSavedPosts && (
            <button
              data-testid="save-button"
              className={styles.footerAction}
              style={localSaved ? { color: '#ff6b35' } : undefined}
              onClick={(e) => { e.stopPropagation(); handleSave(); }}
            >
              {localSaved ? '🔖 Saved' : '🔖 Save'}
            </button>
          )}
          <button
            data-testid="share-button"
            className={styles.footerAction}
            onClick={handleShare}
          >
            Share ↗
          </button>
          {isLoggedIn && (
            <button
              data-testid="report-button"
              className={styles.footerAction}
              onClick={(e) => { e.stopPropagation(); setReportTarget({ type: 'post', postId: post.id }); }}
            >
              ⚑ Report
            </button>
          )}
          {isLoggedIn && (
            <button
              data-testid="comment-button"
              className={styles.footerAction}
              onClick={() => setSheetState({ mode: 'new' })}
            >
              💬 Comment
            </button>
          )}
        </div>

        {settings.showCommentSortBar && backend.capabilities.commentSortOptions.length > 0 && (
          <div style={{ display: 'flex', gap: 6, padding: '8px 16px', borderBottom: '1px solid #2a2d35', flexWrap: 'wrap' }}>
            {backend.capabilities.commentSortOptions.map(({ id, label }) => (
              <button
                key={id}
                onClick={() => onSortChange(id)}
                style={{
                  border: 'none', borderRadius: 8, padding: '4px 10px',
                  cursor: 'pointer', fontSize: 12, fontWeight: 600,
                  background: activeSort === id ? '#ff6b35' : '#2a2d35',
                  color: activeSort === id ? '#fff' : '#888',
                }}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        <div className={styles.commentsSection}>
          {commentsLoaded && comments.length === 0 && post.counts.comments > 0 && (
            <a
              className={styles.commentsFallback}
              href={post.permalink}
              target="_blank"
              rel="noopener noreferrer"
            >
              {post.counts.comments} comments — view on {instanceFromActorId(post.permalink)}
            </a>
          )}
          <CommentList
            comments={comments}
            localReplies={localReplies}
            opActorId={post.author.profileUrl}
            onSetReplyTarget={(c) => setSheetState({ mode: 'reply', target: c })}
            onEdit={(c) => setSheetState({ mode: 'edit', target: c })}
            localEdits={localEdits}
            onReport={isLoggedIn ? handleReport : undefined}
            highlightCommentId={highlightCommentId}
          />
          {onLoadMore && (
            <div ref={sentinelRef} style={{ height: '1px', margin: '4px 0' }}>
              {loadingMore && (
                <div style={{ textAlign: 'center', padding: '8px 0', color: '#666', fontSize: 13 }}>
                  Loading more…
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {isLoggedIn && (
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
      {isLoggedIn && reportTarget && (
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 10 }}>
          <ReportSheet
            target={reportTarget}
            onClose={() => setReportTarget(null)}
          />
        </div>
      )}

      <Toast message="Saved" visible={saveToastVisible} onHide={() => setSaveToastVisible(false)} />
      <Toast message="Link copied" visible={toastVisible} onHide={() => setToastVisible(false)} />
    </div>
  );
}
