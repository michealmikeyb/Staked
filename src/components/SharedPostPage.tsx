import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { fetchPost, type PostView } from '../lib/lemmy';
import Logo from './Logo';
import PostDetailCard from './PostDetailCard';

export default function SharedPostPage() {
  const { instance, postId } = useParams<{ instance: string; postId: string }>();
  const [postView, setPostView] = useState<PostView | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!instance || !postId) { setError(true); return; }
    const id = parseInt(postId, 10);
    if (isNaN(id)) { setError(true); return; }
    fetchPost(instance, id)
      .then(setPostView)
      .catch(() => setError(true));
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
        {!postView && !error && (
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

        {postView && (
          <>
            <PostDetailCard
              post={postView.post}
              community={postView.community}
              creator={postView.creator}
              counts={{ score: postView.counts.score, comments: postView.counts.comments }}
            />
            <div style={{ marginTop: 16, textAlign: 'center' }}>
              <a href="/#/" style={{ color: '#ff6b35', fontSize: '0.85rem', textDecoration: 'none' }}>
                Log in to interact →
              </a>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
