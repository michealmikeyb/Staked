import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { searchCommunities, searchPosts, type CommunityView, type PostView } from '../lib/lemmy';
import { type AuthState } from '../lib/store';
import { instanceFromActorId, sourceFromApId, isImageUrl, placeholderColor } from '../lib/urlUtils';
import MenuDrawer from './MenuDrawer';
import CommunityAvatar from './CommunityAvatar';

type Tab = 'communities' | 'posts';

interface Props {
  auth: AuthState;
}

export default function SearchPage({ auth }: Props) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState<Tab>('communities');
  const [communities, setCommunities] = useState<CommunityView[]>([]);
  const [posts, setPosts] = useState<PostView[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searched, setSearched] = useState(false);
  const [communityPage, setCommunityPage] = useState(1);
  const [postPage, setPostPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [canLoadMoreCommunities, setCanLoadMoreCommunities] = useState(false);
  const [canLoadMorePosts, setCanLoadMorePosts] = useState(false);
  const [lastQuery, setLastQuery] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setError('');
    setCommunities([]);
    setPosts([]);
    setCommunityPage(1);
    setPostPage(1);
    const q = query.trim();
    setLastQuery(q);
    try {
      const [comms, ps] = await Promise.all([
        searchCommunities(auth.instance, auth.token, q, 1),
        searchPosts(auth.instance, auth.token, q, 1),
      ]);
      setCommunities(comms);
      setPosts(ps);
      setCanLoadMoreCommunities(comms.length === 20);
      setCanLoadMorePosts(ps.length === 20);
      setSearched(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setLoading(false);
    }
  }

  async function handleLoadMore() {
    setLoadingMore(true);
    try {
      if (activeTab === 'communities') {
        const nextPage = communityPage + 1;
        const more = await searchCommunities(auth.instance, auth.token, lastQuery, nextPage);
        setCommunities((prev) => [...prev, ...more]);
        setCommunityPage(nextPage);
        setCanLoadMoreCommunities(more.length === 20);
      } else {
        const nextPage = postPage + 1;
        const more = await searchPosts(auth.instance, auth.token, lastQuery, nextPage);
        setPosts((prev) => [...prev, ...more]);
        setPostPage(nextPage);
        setCanLoadMorePosts(more.length === 20);
      }
    } catch {
      // silently fail on load more
    } finally {
      setLoadingMore(false);
    }
  }

  const canLoadMore = activeTab === 'communities' ? canLoadMoreCommunities : canLoadMorePosts;

  const tabStyle = (tab: Tab): React.CSSProperties => ({
    flex: 1, padding: '10px 0', background: 'none', border: 'none',
    cursor: 'pointer', color: activeTab === tab ? '#ff6b35' : '#888',
    fontWeight: activeTab === tab ? 700 : 400, fontSize: 14,
    borderBottom: activeTab === tab ? '2px solid #ff6b35' : '2px solid transparent',
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', background: '#13151a' }}>
      <MenuDrawer onNavigate={navigate} onLogoClick={() => navigate('/')} />
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 8, padding: '12px 12px 0' }}>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search communities and posts…"
            style={{
              flex: 1, padding: '10px 12px', borderRadius: 10,
              border: '1px solid #2a2d35', background: '#1e2128',
              color: '#f5f5f5', fontSize: 14, outline: 'none',
            }}
          />
          <button
            type="submit"
            disabled={loading || !query.trim()}
            style={{
              padding: '10px 16px', borderRadius: 10, border: 'none',
              background: '#ff6b35', color: '#fff', fontWeight: 600, fontSize: 14,
              cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1,
            }}
          >
            Search
          </button>
        </form>

        {searched && (
          <div style={{ display: 'flex', borderBottom: '1px solid #2a2d35', margin: '12px 0 0' }}>
            <button style={tabStyle('communities')} onClick={() => setActiveTab('communities')}>
              Communities
            </button>
            <button style={tabStyle('posts')} onClick={() => setActiveTab('posts')}>
              Posts
            </button>
          </div>
        )}

        {loading && (
          <div style={{ textAlign: 'center', color: '#888', padding: 32 }}>Loading…</div>
        )}
        {!loading && error && (
          <div style={{ textAlign: 'center', color: '#ff4444', padding: 32 }}>{error}</div>
        )}
        {!loading && !error && !searched && (
          <div style={{ textAlign: 'center', color: '#555', padding: 32 }}>Search communities and posts</div>
        )}

        {!loading && !error && searched && activeTab === 'communities' && (
          communities.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#888', padding: 32 }}>No results for "{lastQuery}"</div>
          ) : (
            communities.map((cv) => {
              const { community, counts } = cv;
              const instance = instanceFromActorId(community.actor_id);
              return (
                <div
                  key={community.id}
                  onClick={() => navigate(`/community/${instance}/${community.name}`)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    margin: '6px 12px', padding: 12,
                    background: '#1e2128', borderRadius: 12, cursor: 'pointer',
                  }}
                >
                  <CommunityAvatar name={community.name} icon={community.icon} size={40} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#ff6b35' }}>c/{community.name}</div>
                    <div style={{ fontSize: 11, color: '#777', marginTop: 2 }}>
                      {counts.subscribers.toLocaleString()} subscribers
                    </div>
                    {community.description && (
                      <div style={{
                        fontSize: 12, color: '#aaa', marginTop: 4, lineHeight: 1.4,
                        display: '-webkit-box', WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical', overflow: 'hidden',
                      }}>
                        {community.description}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )
        )}

        {!loading && !error && searched && activeTab === 'posts' && (
          posts.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#888', padding: 32 }}>No results for "{lastQuery}"</div>
          ) : (
            posts.map((pv) => {
              const { post, community, counts } = pv;
              const source = sourceFromApId(post.ap_id);
              const isImage = !!post.url && isImageUrl(post.url);
              const bannerSrc = isImage ? post.url : post.thumbnail_url;
              return (
                <div
                  key={post.id}
                  onClick={() => {
                    if (source) navigate(`/view/${source.instance}/${source.postId}`);
                  }}
                  style={{
                    margin: '6px 12px', background: '#1e2128',
                    borderRadius: 12, overflow: 'hidden', cursor: 'pointer',
                  }}
                >
                  {bannerSrc ? (
                    <img
                      src={bannerSrc}
                      alt=""
                      style={{ width: '100%', height: 120, objectFit: 'cover', display: 'block' }}
                    />
                  ) : (
                    <div style={{
                      width: '100%', height: 120,
                      background: placeholderColor(post.name),
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 32, color: 'rgba(255,255,255,0.15)',
                    }}>
                      🔍
                    </div>
                  )}
                  <div style={{ padding: '10px 12px 12px' }}>
                    <div style={{ fontSize: 10, color: '#ff6b35', fontWeight: 600, marginBottom: 5 }}>
                      c/{community.name}
                    </div>
                    <div style={{
                      fontSize: 14, fontWeight: 600, color: '#f0f0f0', lineHeight: 1.35, marginBottom: 8,
                      display: '-webkit-box', WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical', overflow: 'hidden',
                    }}>
                      {post.name}
                    </div>
                    <div style={{ display: 'flex', gap: 12, fontSize: 10, color: '#777' }}>
                      <span>▲ {counts.score}</span>
                      <span>💬 {counts.comments}</span>
                    </div>
                  </div>
                </div>
              );
            })
          )
        )}

        {!loading && searched && canLoadMore && (
          <div style={{ padding: '8px 12px 16px', textAlign: 'center' }}>
            <button
              onClick={handleLoadMore}
              disabled={loadingMore}
              style={{
                padding: '10px 24px', borderRadius: 10, border: 'none',
                background: '#1e2128', color: '#aaa',
                cursor: loadingMore ? 'not-allowed' : 'pointer', fontSize: 13,
              }}
            >
              {loadingMore ? 'Loading…' : 'Load more'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
