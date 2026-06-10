import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useBackend } from '../lib/api/context';
import type { Post } from '../lib/api/types';
import MenuDrawer from './MenuDrawer';
import PostDetailCard from './PostDetailCard';

const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

interface Props {
  auth?: unknown; // kept for App.tsx compat
}

export default function ProfilePostDetailPage({ auth: _auth }: Props) {
  const { state } = useLocation();
  const navigate = useNavigate();
  const backend = useBackend();
  const commentApId = state?.commentApId as string | undefined;
  const [neutralPost, setNeutralPost] = useState<Post | undefined>(
    state?.post ? (state.post as Post) : undefined,
  );

  useEffect(() => {
    if (neutralPost || !state?.postId) return;
    backend.posts.get(state.postId as string)
      .then(setNeutralPost)
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!neutralPost) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', background: '#13151a' }}>
        <MenuDrawer onNavigate={navigate} onLogoClick={() => navigate('/')} />
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888' }}>
          {state?.postId ? 'Loading…' : 'Navigate to Profile to view this post.'}
        </div>
      </div>
    );
  }

  // Convert neutral Post to legacy PostDetailCard props (PostDetailCard migrates in a later task)
  const authorHandle = neutralPost.author.handle;
  const authorName = authorHandle.includes('@') ? authorHandle.split('@')[0] : authorHandle;
  const post = {
    id: 0,
    name: neutralPost.title ?? '',
    ap_id: neutralPost.permalink,
    url: neutralPost.externalUrl ?? null,
    body: neutralPost.body ?? null,
    thumbnail_url: neutralPost.mediaUrl ?? null,
    nsfw: neutralPost.nsfw,
    published: neutralPost.publishedAt,
  };
  // source.id is a numeric string; reconstruct the actor URL from the handle for instanceFromActorId
  const [sourceName, sourceInst] = neutralPost.source.handle.split('@');
  const communityActorId = sourceInst ? `https://${sourceInst}/c/${sourceName}` : neutralPost.source.id;
  const community = { name: neutralPost.source.name, actor_id: communityActorId };
  const creator = {
    name: authorName,
    display_name: neutralPost.author.displayName ?? null,
    actor_id: neutralPost.author.profileUrl,
  };
  const counts = { score: neutralPost.counts.score, comments: neutralPost.counts.comments };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', background: '#13151a' }}>
      <MenuDrawer
        onNavigate={navigate}
        onLogoClick={() => navigate('/')}
        leftContent={
          isIOS ? (
            <button
              onClick={() => navigate('/profile')}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: '#aaa', fontSize: 13, display: 'flex', alignItems: 'center', gap: 4,
              }}
            >
              ← Profile
            </button>
          ) : undefined
        }
      />
      <div style={{ flex: 1, display: 'flex', alignItems: 'flex-start', justifyContent: 'center' }}>
        <PostDetailCard
          post={post}
          community={community}
          creator={creator}
          counts={counts}
          notifCommentApId={commentApId}
        />
      </div>
    </div>
  );
}
