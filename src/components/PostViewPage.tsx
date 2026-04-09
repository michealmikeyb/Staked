import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { fetchPost, type PostView } from '../lib/lemmy';
import { type AuthState } from '../lib/store';
import MenuDrawer from './MenuDrawer';
import PostDetailCard from './PostDetailCard';

const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

interface Props {
  auth: AuthState;
}

export default function PostViewPage({ auth }: Props) {
  const { instance, postId } = useParams<{ instance: string; postId: string }>();
  const navigate = useNavigate();
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
        {!postView && !error && (
          <div style={{ marginTop: 80, color: '#888' }}>Loading…</div>
        )}
        {error && (
          <div style={{ marginTop: 80, textAlign: 'center', color: '#888' }}>
            <div style={{ fontSize: '1rem' }}>Post not found</div>
          </div>
        )}
        {postView && (
          <PostDetailCard
            post={postView.post}
            community={postView.community}
            creator={postView.creator}
            counts={{ score: postView.counts.score, comments: postView.counts.comments }}
            auth={auth}
          />
        )}
      </div>
    </div>
  );
}
