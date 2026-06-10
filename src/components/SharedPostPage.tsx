import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useBackend } from '../lib/api/context';
import type { Post } from '../lib/api/types';
import Logo from './Logo';
import PostDetailCard from './PostDetailCard';

export default function SharedPostPage() {
  const { instance, postId } = useParams<{ instance: string; postId: string }>();
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
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh', background: '#13151a' }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '12px 16px', borderBottom: '1px solid #1e2128',
      }}>
        <a href="/#/" style={{ textDecoration: 'none' }}>
          <Logo variant="full" size={28} />
        </a>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', padding: '0 0 32px' }}>
        {!neutralPost && !error && (
          <div data-testid="shared-post-loading" style={{ marginTop: 80, color: '#888', fontSize: '0.9rem' }}>
            Loading…
          </div>
        )}

        {error && (
          <div data-testid="shared-post-error" style={{ marginTop: 80, textAlign: 'center', color: '#888' }}>
            <div style={{ fontSize: '1rem', marginBottom: 12 }}>Post not found</div>
            <a href="/#/" style={{ color: '#ff6b35', fontSize: '0.85rem' }}>Open Stakswipe</a>
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
            <>
              <PostDetailCard post={post} community={community} creator={creator} counts={counts} />
              <div style={{ marginTop: 16, textAlign: 'center' }}>
                <a href="/#/" style={{ color: '#ff6b35', fontSize: '0.85rem', textDecoration: 'none' }}>
                  Log in to interact →
                </a>
              </div>
            </>
          );
        })()}
      </div>
    </div>
  );
}
