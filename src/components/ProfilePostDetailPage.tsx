import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { fetchPost, type PostView } from '../lib/lemmy';
import { type AuthState } from '../lib/store';
import MenuDrawer from './MenuDrawer';
import PostDetailCard from './PostDetailCard';

const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

interface Props {
  auth: AuthState;
}

export default function ProfilePostDetailPage({ auth }: Props) {
  const { state } = useLocation();
  const navigate = useNavigate();
  const commentApId = state?.commentApId as string | undefined;
  const [postView, setPostView] = useState<PostView | undefined>(state?.post as PostView | undefined);

  useEffect(() => {
    if (postView || !state?.postId) return;
    fetchPost(auth.instance, state.postId).then(setPostView).catch(() => {});
  }, [auth.instance, state?.postId, postView]);

  if (!postView) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', background: '#13151a' }}>
        <MenuDrawer onNavigate={navigate} onLogoClick={() => navigate('/')} />
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888' }}>
          {state?.postId ? 'Loading…' : 'Navigate to Profile to view this post.'}
        </div>
      </div>
    );
  }

  const { post, community, creator, counts } = postView;

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
          auth={auth}
          notifCommentApId={commentApId}
        />
      </div>
    </div>
  );
}
