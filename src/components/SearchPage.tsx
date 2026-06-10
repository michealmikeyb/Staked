import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBackend } from '../lib/api/context';
import type { Source, Post } from '../lib/api/types';
import { sourceFromApId, isImageUrl, placeholderColor, parsePostUrl } from '../lib/urlUtils';
import MenuDrawer from './MenuDrawer';
import CommunityAvatar from './CommunityAvatar';

type Tab = 'communities' | 'posts';

interface Props {
  auth?: unknown; // kept for App.tsx compat — backend provides session
}

export default function SearchPage({ auth: _auth }: Props) {
  const navigate = useNavigate();
  const backend = useBackend();
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState<Tab>('communities');
  const [sources, setSources] = useState<Source[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searched, setSearched] = useState(false);
  const [sourcesCursor, setSourcesCursor] = useState<string | null>(null);
  const [postsCursor, setPostsCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [canLoadMoreSources, setCanLoadMoreSources] = useState(false);
  const [canLoadMorePosts, setCanLoadMorePosts] = useState(false);
  const [lastQuery, setLastQuery] = useState('');

  const directPost = parsePostUrl(query);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setError('');
    setSearched(false);
    setSources([]);
    setPosts([]);
    const q = query.trim();
    setLastQuery(q);
    try {
      const [srcsPage, psPage] = await Promise.all([
        backend.search.sources(q, { cursor: null }),
        backend.search.posts(q, { cursor: null }),
      ]);
      setSources(srcsPage.items);
      setPosts(psPage.items);
      setSourcesCursor(srcsPage.nextCursor);
      setPostsCursor(psPage.nextCursor);
      setCanLoadMoreSources(srcsPage.nextCursor !== null);
      setCanLoadMorePosts(psPage.nextCursor !== null);
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
        const morePage = await backend.search.sources(lastQuery, { cursor: sourcesCursor });
        setSources((prev) => [...prev, ...morePage.items]);
        setSourcesCursor(morePage.nextCursor);
        setCanLoadMoreSources(morePage.nextCursor !== null);
      } else {
        const morePage = await backend.search.posts(lastQuery, { cursor: postsCursor });
        setPosts((prev) => [...prev, ...morePage.items]);
        setPostsCursor(morePage.nextCursor);
        setCanLoadMorePosts(morePage.nextCursor !== null);
      }
    } catch {
      // silently fail on load more
    } finally {
      setLoadingMore(false);
    }
  }

  const canLoadMore = activeTab === 'communities' ? canLoadMoreSources : canLoadMorePosts;

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
            disabled={loading || !query.trim() || !!directPost}
            style={{
              padding: '10px 16px', borderRadius: 10, border: 'none',
              background: '#ff6b35', color: '#fff', fontWeight: 600, fontSize: 14,
              cursor: (loading || directPost) ? 'not-allowed' : 'pointer', opacity: (loading || directPost) ? 0.6 : 1,
            }}
          >
            Search
          </button>
        </form>

        {directPost && (
          <button
            onClick={() => navigate(`/view/${directPost.instance}/${directPost.postId}`)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              width: 'calc(100% - 24px)', margin: '8px 12px 0', padding: '12px 14px', borderRadius: 12,
              border: '1px solid #2a2d35', background: '#1e2128',
              color: '#ff6b35', fontWeight: 600, fontSize: 14,
              cursor: 'pointer', textAlign: 'left',
            }}
          >
            <span>🔗</span>
            <span>Go to post →</span>
          </button>
        )}

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
          sources.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#888', padding: 32 }}>No results for "{lastQuery}"</div>
          ) : (
            sources.map((source) => {
              const atIdx = source.handle.indexOf('@');
              const srcName = atIdx >= 0 ? source.handle.slice(0, atIdx) : source.handle;
              const srcInstance = atIdx >= 0 ? source.handle.slice(atIdx + 1) : '';
              return (
                <div
                  key={source.id}
                  onClick={() => navigate(`/community/${srcInstance}/${srcName}`)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    margin: '6px 12px', padding: 12,
                    background: '#1e2128', borderRadius: 12, cursor: 'pointer',
                  }}
                >
                  <CommunityAvatar name={source.name} icon={source.icon} size={40} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#ff6b35' }}>c/{source.name}</div>
                    <div style={{ fontSize: 11, color: '#777', marginTop: 2 }}>
                      {source.counts.members.toLocaleString()} subscribers
                    </div>
                    {source.description && (
                      <div style={{
                        fontSize: 12, color: '#aaa', marginTop: 4, lineHeight: 1.4,
                        display: '-webkit-box', WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical', overflow: 'hidden',
                      }}>
                        {source.description}
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
            posts.map((post) => {
              const source = sourceFromApId(post.permalink);
              const isImage = !!post.externalUrl && isImageUrl(post.externalUrl);
              const bannerSrc = isImage ? post.externalUrl : post.mediaUrl;
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
                      background: placeholderColor(post.title ?? ''),
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 32, color: 'rgba(255,255,255,0.15)',
                    }}>
                      🔍
                    </div>
                  )}
                  <div style={{ padding: '10px 12px 12px' }}>
                    <div style={{ fontSize: 10, color: '#ff6b35', fontWeight: 600, marginBottom: 5 }}>
                      c/{post.source.name}
                    </div>
                    <div style={{
                      fontSize: 14, fontWeight: 600, color: '#f0f0f0', lineHeight: 1.35, marginBottom: 8,
                      display: '-webkit-box', WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical', overflow: 'hidden',
                    }}>
                      {post.title}
                    </div>
                    <div style={{ display: 'flex', gap: 12, fontSize: 10, color: '#777' }}>
                      <span>▲ {post.counts.score}</span>
                      <span>💬 {post.counts.comments}</span>
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
