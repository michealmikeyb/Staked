# Unified Post Card Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract a `PostCardShell` component that owns all card content rendering, fix the broken visual output in `PostDetailCard`, and unify the feed stack card experience with the share/saved detail views.

**Architecture:** A new `PostCardShell` handles meta row (with `metaStats` at top-right), title, banner, image/NSFW, body, footer (Save/Share/Comment gated by `auth`), comments, `ReplySheet`, and toasts. `PostCard` keeps only its `motion.div` wrapper and gesture logic. `PostDetailCard` becomes a thin outer wrapper. `FeedStack` no longer passes `onSave` since the shell calls `savePost` directly.

**Tech Stack:** React 18, TypeScript, Vitest + @testing-library/react, framer-motion, @use-gesture/react, react-router-dom

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `src/components/PostCardShell.tsx` | Create | All card content: meta, title, banner, image, body, footer, comments, ReplySheet, toasts |
| `src/components/PostCardShell.test.tsx` | Create | Tests for PostCardShell in isolation |
| `src/components/PostCard.tsx` | Modify | Keep motion wrapper + gesture only; delegate content to PostCardShell; remove `onSave` prop |
| `src/components/PostCard.test.tsx` | Modify | Remove `onSave` from all renders; update save test to check `savePost` call |
| `src/components/PostDetailCard.tsx` | Modify | Keep outer `div` + `useCommentLoader`; delegate content to PostCardShell |
| `src/components/PostDetailCard.test.tsx` | Modify | Add `savePost`/`editComment` to mock; add auth-gated button tests |
| `src/components/FeedStack.tsx` | Modify | Remove `onSave` prop and its `savePost` call (shell handles it) |

---

## Task 1: Create PostCardShell with tests

**Files:**
- Create: `src/components/PostCardShell.tsx`
- Create: `src/components/PostCardShell.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `src/components/PostCardShell.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('../lib/lemmy', () => ({
  savePost: vi.fn().mockResolvedValue(undefined),
  createComment: vi.fn().mockResolvedValue({
    comment: { id: 99, content: 'reply', path: '0.1.99', ap_id: 'https://lemmy.world/comment/99' },
    creator: { name: 'me', display_name: null },
    counts: { score: 1 },
  }),
  editComment: vi.fn().mockResolvedValue({
    comment: { id: 1, content: 'Edited', path: '0.1', ap_id: 'https://lemmy.world/comment/1' },
    creator: { name: 'alice', display_name: null },
    counts: { score: 1 },
  }),
  resolveCommentId: vi.fn().mockResolvedValue(null),
}));

vi.mock('../lib/urlUtils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/urlUtils')>();
  return { ...actual, getShareUrl: vi.fn().mockReturnValue('https://stakswipe.com/#/post/lemmy.world/1') };
});

const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

import PostCardShell from './PostCardShell';
import { savePost } from '../lib/lemmy';

const POST = {
  id: 1, name: 'Test Post', ap_id: 'https://lemmy.world/post/1',
  url: null, body: null, thumbnail_url: null,
};
const COMMUNITY = { name: 'linux', actor_id: 'https://lemmy.world/c/linux' };
const CREATOR = { name: 'alice', display_name: null };
const COUNTS = { score: 42, comments: 7 };
const AUTH = { token: 'tok', instance: 'lemmy.world', username: 'alice' };

function renderShell(overrides: Record<string, unknown> = {}) {
  return render(
    <PostCardShell
      post={POST}
      community={COMMUNITY}
      creator={CREATOR}
      counts={COUNTS}
      comments={[]}
      commentsLoaded={true}
      auth={AUTH}
      {...overrides}
    />,
  );
}

beforeEach(() => { vi.clearAllMocks(); mockNavigate.mockClear(); });

describe('PostCardShell', () => {
  it('renders post title and community name', () => {
    renderShell();
    expect(screen.getByText('Test Post')).toBeInTheDocument();
    expect(screen.getByText('c/linux')).toBeInTheDocument();
  });

  it('renders score and comment count in metaStats (top of card)', () => {
    renderShell();
    expect(screen.getByTestId('meta-score')).toHaveTextContent('▲ 42');
    expect(screen.getByTestId('meta-comments')).toHaveTextContent('💬 7');
  });

  it('renders Share button without auth', () => {
    renderShell({ auth: undefined });
    expect(screen.getByTestId('share-button')).toBeInTheDocument();
  });

  it('hides Save and Comment buttons without auth', () => {
    renderShell({ auth: undefined });
    expect(screen.queryByTestId('save-button')).not.toBeInTheDocument();
    expect(screen.queryByTestId('comment-button')).not.toBeInTheDocument();
  });

  it('shows Save and Comment buttons with auth', () => {
    renderShell();
    expect(screen.getByTestId('save-button')).toBeInTheDocument();
    expect(screen.getByTestId('comment-button')).toBeInTheDocument();
  });

  it('clicking Save calls savePost with correct args', async () => {
    renderShell();
    fireEvent.click(screen.getByTestId('save-button'));
    await waitFor(() => expect(savePost).toHaveBeenCalledWith('lemmy.world', 'tok', 1));
  });

  it('shows Saved toast after save button is clicked', async () => {
    renderShell();
    fireEvent.click(screen.getByTestId('save-button'));
    await waitFor(() => expect(screen.getByText('Saved')).toBeInTheDocument());
  });

  it('renders image when post.url is an image', () => {
    renderShell({ post: { ...POST, url: 'https://example.com/photo.jpg' } });
    expect(screen.getByRole('img')).toBeInTheDocument();
  });

  it('renders link banner when post.url is not an image', () => {
    renderShell({ post: { ...POST, url: 'https://example.com/article' } });
    expect(screen.getByTestId('link-banner')).toBeInTheDocument();
    expect(screen.getByText('Tap to open link')).toBeInTheDocument();
  });

  it('shows NSFW blur overlay for nsfw post with blurNsfw=true', () => {
    renderShell({
      post: { ...POST, url: 'https://example.com/photo.jpg', nsfw: true },
      blurNsfw: true,
    });
    expect(screen.getByTestId('nsfw-blur-overlay')).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('reveals image when NSFW overlay is tapped', () => {
    renderShell({
      post: { ...POST, url: 'https://example.com/photo.jpg', nsfw: true },
      blurNsfw: true,
    });
    fireEvent.click(screen.getByTestId('nsfw-blur-overlay'));
    expect(screen.queryByTestId('nsfw-blur-overlay')).not.toBeInTheDocument();
    expect(screen.getByRole('img')).toBeInTheDocument();
  });

  it('shows image directly when blurNsfw=false for nsfw post', () => {
    renderShell({
      post: { ...POST, url: 'https://example.com/photo.jpg', nsfw: true },
      blurNsfw: false,
    });
    expect(screen.queryByTestId('nsfw-blur-overlay')).not.toBeInTheDocument();
    expect(screen.getByRole('img')).toBeInTheDocument();
  });

  it('navigates to community page when community name is clicked', () => {
    renderShell();
    fireEvent.click(screen.getByText('c/linux'));
    expect(mockNavigate).toHaveBeenCalledWith('/community/lemmy.world/linux');
  });

  it('navigates to user profile when creator with actor_id is clicked', () => {
    renderShell({
      creator: { name: 'alice', display_name: null, actor_id: 'https://lemmy.world/u/alice' },
    });
    fireEvent.click(screen.getByText('alice'));
    expect(mockNavigate).toHaveBeenCalledWith('/user/lemmy.world/alice');
  });

  it('renders creator as plain text when no actor_id', () => {
    renderShell({ creator: { name: 'alice', display_name: null } });
    const el = screen.getByText('alice');
    expect(el.tagName).not.toBe('BUTTON');
  });

  it('renders reply-wrapper when auth is present', () => {
    renderShell();
    expect(screen.getByTestId('reply-wrapper')).toBeInTheDocument();
  });

  it('does not render reply-wrapper when auth is absent', () => {
    renderShell({ auth: undefined });
    expect(screen.queryByTestId('reply-wrapper')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to confirm they all fail**

```bash
npx vitest run src/components/PostCardShell.test.tsx
```

Expected: all tests fail with "Cannot find module './PostCardShell'"

- [ ] **Step 3: Create PostCardShell.tsx**

Create `src/components/PostCardShell.tsx`:

```tsx
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
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx vitest run src/components/PostCardShell.test.tsx
```

Expected: all 17 tests pass

- [ ] **Step 5: Commit**

```bash
git add src/components/PostCardShell.tsx src/components/PostCardShell.test.tsx
git commit -m "feat: add PostCardShell with unified card content rendering"
```

---

## Task 2: Refactor PostCard to use PostCardShell

**Files:**
- Modify: `src/components/PostCard.tsx`
- Modify: `src/components/PostCard.test.tsx`
- Modify: `src/components/FeedStack.tsx`

- [ ] **Step 1: Update PostCard.tsx**

Replace the entire file with:

```tsx
import { useRef, useState } from 'react';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import { useDrag } from '@use-gesture/react';
import { type PostView } from '../lib/lemmy';
import { type AuthState } from '../lib/store';
import { useCommentLoader } from '../hooks/useCommentLoader';
import { useSettings } from '../lib/SettingsContext';
import PostCardShell from './PostCardShell';
import styles from './PostCard.module.css';

const SWIPE_THRESHOLD = 120;
const VELOCITY_THRESHOLD = 0.5;
const EMPTY_MOTION_PROPS = {};

interface Props {
  post: PostView;
  auth: AuthState;
  zIndex: number;
  scale: number;
  onSwipeRight: () => void;
  onSwipeLeft: () => void;
  onUndo: () => void;
  isReturning?: boolean;
  onReturnAnimationComplete?: () => void;
}

export default function PostCard({
  post, auth, zIndex, scale,
  onSwipeRight, onSwipeLeft, onUndo,
  isReturning = false,
  onReturnAnimationComplete,
}: Props) {
  const { post: p, community, creator, counts } = post;
  const { comments, commentsLoaded } = useCommentLoader(p, community, auth);
  const { settings } = useSettings();
  const scrollRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef(0);
  const [pullDelta, setPullDelta] = useState(0);

  const x = useMotionValue(0);
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

  const returningMotionProps = isReturning
    ? {
        initial: { y: '-110vh' },
        animate: { y: 0, transition: { type: 'spring' as const, stiffness: 280, damping: 26 } },
        onAnimationComplete: onReturnAnimationComplete,
      }
    : EMPTY_MOTION_PROPS;

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    const delta = e.touches[0].clientY - touchStartY.current;
    if (scrollRef.current && scrollRef.current.scrollTop <= 0 && delta > 0) {
      setPullDelta(delta);
    } else {
      setPullDelta(0);
    }
  };

  const handleTouchEnd = () => {
    if (pullDelta >= 80) onUndo();
    setPullDelta(0);
  };

  return (
    <motion.div
      className={styles.card}
      style={{ zIndex, x, rotate, scale }}
      {...returningMotionProps}
      {...(bind() as object)}
    >
      <motion.div className={styles.overlay} style={{ backgroundColor: overlayColor }} />
      <motion.div
        className={styles.undoOverlay}
        style={{ opacity: Math.min(pullDelta / 80, 1) }}
      >
        <span style={{ fontSize: '3rem' }}>↩</span>
      </motion.div>
      <PostCardShell
        post={p}
        community={community}
        creator={creator}
        counts={counts}
        auth={auth}
        comments={comments}
        commentsLoaded={commentsLoaded}
        scrollRef={scrollRef}
        blurNsfw={settings.blurNsfw}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      />
    </motion.div>
  );
}
```

- [ ] **Step 2: Remove onSave from FeedStack.tsx**

In `src/components/FeedStack.tsx`, find the block:
```tsx
onSave={isTop ? () => {
  savePost(auth.instance, auth.token, post.post.id).catch(() => {});
} : () => {}}
```
Delete those three lines. Also remove the `savePost` import from `../lib/lemmy` in FeedStack if it's no longer used elsewhere in the file.

Run to verify it compiles:
```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Update PostCard.test.tsx — remove onSave everywhere**

In `src/components/PostCard.test.tsx`, remove every `onSave={vi.fn()}` line. There are ~20 occurrences — use find-and-replace to remove them all.

Then find the `describe('PostCard save button', ...)` block and replace the `'calls onSave when the save button is tapped'` test with a `savePost` API check:

Replace:
```tsx
it('calls onSave when the save button is tapped', () => {
  const onSave = vi.fn();
  render(
    <SettingsProvider>
      <PostCard
        post={MOCK_POST}
        auth={AUTH}
        zIndex={1}
        scale={1}
        onSwipeRight={vi.fn()}
        onSwipeLeft={vi.fn()}
        onUndo={vi.fn()}
        onSave={onSave}
      />
    </SettingsProvider>,
  );
  fireEvent.click(screen.getByTestId('save-button'));
  expect(onSave).toHaveBeenCalledTimes(1);
});
```

With:
```tsx
it('clicking save button calls savePost API', async () => {
  render(
    <SettingsProvider>
      <PostCard
        post={MOCK_POST}
        auth={AUTH}
        zIndex={1}
        scale={1}
        onSwipeRight={vi.fn()}
        onSwipeLeft={vi.fn()}
        onUndo={vi.fn()}
      />
    </SettingsProvider>,
  );
  fireEvent.click(screen.getByTestId('save-button'));
  await waitFor(() => expect(savePost).toHaveBeenCalledWith('lemmy.world', 'tok', 1));
});
```

Also add `waitFor` and `savePost` to the imports at the top of the file:
```tsx
import { render, screen, act, waitFor } from '@testing-library/react';
import { savePost } from '../lib/lemmy';
```

- [ ] **Step 4: Run the full PostCard test suite**

```bash
npx vitest run src/components/PostCard.test.tsx
```

Expected: all tests pass

- [ ] **Step 5: Commit**

```bash
git add src/components/PostCard.tsx src/components/PostCard.test.tsx src/components/FeedStack.tsx
git commit -m "refactor: PostCard delegates content to PostCardShell, remove onSave prop"
```

---

## Task 3: Refactor PostDetailCard to use PostCardShell

**Files:**
- Modify: `src/components/PostDetailCard.tsx`
- Modify: `src/components/PostDetailCard.test.tsx`

- [ ] **Step 1: Update PostDetailCard.test.tsx — add missing mocks and new tests**

Replace the `vi.mock('../lib/lemmy', ...)` block at the top of `src/components/PostDetailCard.test.tsx` with:

```tsx
vi.mock('../lib/lemmy', () => ({
  fetchComments: vi.fn().mockResolvedValue([]),
  resolvePostId: vi.fn().mockResolvedValue(null),
  resolveCommentId: vi.fn().mockResolvedValue(null),
  createComment: vi.fn().mockResolvedValue({
    comment: { id: 99, content: 'reply', path: '0.1.99', ap_id: 'https://lemmy.world/comment/99' },
    creator: { name: 'me', display_name: null },
    counts: { score: 1 },
  }),
  editComment: vi.fn().mockResolvedValue({
    comment: { id: 1, content: 'Edited', path: '0.1', ap_id: 'https://lemmy.world/comment/1' },
    creator: { name: 'alice', display_name: null },
    counts: { score: 1 },
  }),
  savePost: vi.fn().mockResolvedValue(undefined),
}));
```

Add a `react-router-dom` mock after the existing mocks (PostCardShell calls `useNavigate`):

```tsx
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mockNavigate };
});
```

Add the following tests inside the existing `describe('PostDetailCard', ...)` block, after the last existing test:

```tsx
it('does not show Save or Comment buttons without auth', () => {
  render(<MemoryRouter><PostDetailCard post={POST} community={COMMUNITY} creator={CREATOR} counts={COUNTS} /></MemoryRouter>);
  expect(screen.queryByTestId('save-button')).not.toBeInTheDocument();
  expect(screen.queryByTestId('comment-button')).not.toBeInTheDocument();
});

it('shows Save and Comment buttons with auth', () => {
  render(<MemoryRouter><PostDetailCard post={POST} community={COMMUNITY} creator={CREATOR} counts={COUNTS} auth={AUTH} /></MemoryRouter>);
  expect(screen.getByTestId('save-button')).toBeInTheDocument();
  expect(screen.getByTestId('comment-button')).toBeInTheDocument();
});

it('score and comment count are in metaStats (top), not a footer span', () => {
  renderCard();
  expect(screen.getByTestId('meta-score')).toHaveTextContent('▲ 42');
  expect(screen.getByTestId('meta-comments')).toHaveTextContent('💬 7');
});
```

Also add `waitFor` to the `@testing-library/react` import at the top.

- [ ] **Step 2: Run tests to confirm the new tests fail (and existing ones pass)**

```bash
npx vitest run src/components/PostDetailCard.test.tsx
```

Expected: the 3 new tests fail, all existing tests pass (PostDetailCard unchanged so far)

- [ ] **Step 3: Update PostDetailCard.tsx**

Replace the entire file with:

```tsx
import { useMemo } from 'react';
import { instanceFromActorId } from '../lib/urlUtils';
import { useCommentLoader } from '../hooks/useCommentLoader';
import { type AuthState } from '../lib/store';
import PostCardShell from './PostCardShell';

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
  auth?: AuthState;
  notifCommentApId?: string;
}

export default function PostDetailCard({
  post, community, creator, counts, auth, notifCommentApId,
}: Props) {
  const anonAuth: AuthState = useMemo(() => ({
    instance: instanceFromActorId(community.actor_id),
    token: '',
    username: '',
  }), [community.actor_id]);

  const { comments, commentsLoaded } = useCommentLoader(
    { ap_id: post.ap_id, id: post.id },
    { actor_id: community.actor_id },
    auth ?? anonAuth,
  );

  const highlightCommentId = useMemo(() => {
    if (!commentsLoaded || !notifCommentApId) return undefined;
    return comments.find((c) => c.comment.ap_id === notifCommentApId)?.comment.id;
  }, [comments, commentsLoaded, notifCommentApId]);

  return (
    <div style={{
      position: 'relative', width: '92vw', maxWidth: 440,
      height: 'calc(100dvh - 72px)',
      borderRadius: 20, background: 'var(--card-bg, #1e2128)',
      boxShadow: '0 8px 32px rgba(0,0,0,0.5)', margin: '12px 0',
      display: 'flex', flexDirection: 'column',
    }}>
      <PostCardShell
        post={post}
        community={community}
        creator={creator}
        counts={counts}
        auth={auth}
        comments={comments}
        commentsLoaded={commentsLoaded}
        highlightCommentId={highlightCommentId}
      />
    </div>
  );
}
```

- [ ] **Step 4: Run PostDetailCard tests**

```bash
npx vitest run src/components/PostDetailCard.test.tsx
```

Expected: all tests pass including the 3 new ones

- [ ] **Step 5: Run the full test suite**

```bash
npx vitest run
```

Expected: all tests pass

- [ ] **Step 6: Commit**

```bash
git add src/components/PostDetailCard.tsx src/components/PostDetailCard.test.tsx
git commit -m "refactor: PostDetailCard delegates to PostCardShell, add save/comment support"
```

---

## Task 4: Visual verification

- [ ] **Step 1: Start the dev server**

```bash
npm run dev
```

- [ ] **Step 2: Open the share page in a browser and verify**

Navigate to `http://localhost:5173/#/post/lemmy.dbzer0.com/66689892`

Confirm:
- Score (▲) and comment count (💬) appear in the **top-right** of the meta row
- Footer shows **Share ↗** button styled consistently (orange text, no white box)
- No Save or Comment buttons (not logged in)
- Image or NSFW blur renders correctly

- [ ] **Step 3: Log in and verify authenticated state**

Log in via the app, then revisit a post detail page (saved or shared).

Confirm:
- **🔖 Save**, **Share ↗**, and **💬 Comment** buttons all appear in the footer
- Save button triggers the "Saved" toast
- Comment button opens the ReplySheet

- [ ] **Step 4: Verify feed stack card is unchanged**

Open the main feed and swipe through a few cards.

Confirm:
- Cards look identical to before
- Swipe gestures still work
- Save and Comment still functional

- [ ] **Step 5: Commit any fixes, then done**

If visual issues are found, fix them and commit. Otherwise:

```bash
git add -p
git commit -m "fix: visual corrections after PostCardShell integration"
```
