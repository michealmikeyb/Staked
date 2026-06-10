import { useLocation, useNavigate } from 'react-router-dom';
import type { Post } from '../lib/api/types';
import MenuDrawer from './MenuDrawer';
import PostDetailCard from './PostDetailCard';

const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

interface Props {
  auth?: unknown; // kept for App.tsx compat
}

export default function SavedPostDetailPage({ auth: _auth }: Props) {
  const { state } = useLocation();
  const navigate = useNavigate();
  const neutralPost = state?.post as Post | undefined;

  if (!neutralPost) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', background: '#13151a' }}>
        <MenuDrawer onNavigate={navigate} onLogoClick={() => navigate('/')} />
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888' }}>
          Navigate to Saved to view this post.
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
  const community = { name: neutralPost.source.name, actor_id: neutralPost.source.id };
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
              onClick={() => navigate('/saved')}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: '#aaa', fontSize: 13, display: 'flex', alignItems: 'center', gap: 4,
              }}
            >
              ← Saved
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
        />
      </div>
    </div>
  );
}
