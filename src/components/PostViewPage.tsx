import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useBackend } from '../lib/api/context';
import type { Post } from '../lib/api/types';
import MenuDrawer from './MenuDrawer';
import PostDetailCard from './PostDetailCard';

const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

interface Props {
  auth?: unknown; // kept for App.tsx compat — backend provides session
}

export default function PostViewPage({ auth: _auth }: Props) {
  const { instance, postId } = useParams<{ instance: string; postId: string }>();
  const navigate = useNavigate();
  const backend = useBackend();
  const [neutralPost, setNeutralPost] = useState<Post | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!instance || !postId) { setError(true); return; }
    const permalink = `https://${instance}/post/${postId}`;
    backend.posts.getByPermalink(permalink)
      .then((p) => {
        if (!p) { setError(true); return; }
        setNeutralPost(p);
      })
      .catch(() => setError(true));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instance, postId]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', background: '#13151a' }}>
      <MenuDrawer
        onNavigate={navigate}
        onLogoClick={() => navigate('/')}
        leftContent={
          isIOS ? (
            <button
              onClick={() => navigate('/search')}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: '#aaa', fontSize: 13, display: 'flex', alignItems: 'center', gap: 4,
              }}
            >
              ← Search
            </button>
          ) : undefined
        }
      />
      <div style={{ flex: 1, display: 'flex', alignItems: 'flex-start', justifyContent: 'center' }}>
        {!neutralPost && !error && (
          <div style={{ marginTop: 80, color: '#888' }}>Loading…</div>
        )}
        {error && (
          <div style={{ marginTop: 80, textAlign: 'center', color: '#888' }}>
            <div style={{ fontSize: '1rem' }}>Post not found</div>
          </div>
        )}
        {neutralPost && (() => {
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
          const creator = { name: authorName, display_name: neutralPost.author.displayName ?? null, actor_id: neutralPost.author.profileUrl };
          const counts = { score: neutralPost.counts.score, comments: neutralPost.counts.comments };
          return (
            <PostDetailCard post={post} community={community} creator={creator} counts={counts} />
          );
        })()}
      </div>
    </div>
  );
}
