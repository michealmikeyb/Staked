import { useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { type AuthState } from '../lib/store';
import { resolveCommunityId, createPost, uploadImage } from '../lib/lemmy';

interface Props {
  auth: AuthState;
}

const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box',
  background: '#2a2d35', border: '1px solid #3a3d45',
  borderRadius: 8, padding: '10px 12px',
  color: '#f5f5f5', fontSize: 14, fontFamily: 'inherit',
};
const labelStyle: React.CSSProperties = {
  fontSize: 11, color: '#888', textTransform: 'uppercase',
  letterSpacing: '0.08em', marginBottom: 6, display: 'block',
};

export default function CreatePostPage({ auth }: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const prefill = (location.state as { community?: string } | null)?.community ?? '';

  const [community, setCommunity] = useState(prefill);
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [body, setBody] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canSubmit = title.trim() !== '' && community.trim() !== '' && !uploading && !submitting;

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError('');
    setUploading(true);
    try {
      const imageUrl = await uploadImage(auth.instance, auth.token, file);
      setUrl(imageUrl);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleSubmit() {
    setSubmitError('');
    setSubmitting(true);
    try {
      const communityId = await resolveCommunityId(auth.instance, auth.token, community.trim());
      await createPost(auth.instance, auth.token, {
        name: title.trim(),
        community_id: communityId,
        url: url.trim() || undefined,
        body: body.trim() || undefined,
      });
      navigate(-1);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to create post');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ background: '#1a1d24', minHeight: '100dvh', color: '#f5f5f5' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '0 16px', height: 48, flexShrink: 0,
        background: '#1a1d24', borderBottom: '1px solid #2a2d35',
      }}>
        <button
          aria-label="Back"
          onClick={() => navigate(-1)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#f5f5f5', fontSize: 20, padding: 0 }}
        >
          ←
        </button>
        <span style={{ flex: 1, fontWeight: 600, fontSize: 16 }}>New Post</span>
        <button
          aria-label="Post"
          onClick={handleSubmit}
          disabled={!canSubmit}
          style={{
            background: canSubmit ? '#ff6b35' : '#3a3d45',
            color: canSubmit ? '#fff' : '#888',
            border: 'none', borderRadius: 8,
            padding: '7px 16px', fontSize: 14, fontWeight: 600,
            cursor: canSubmit ? 'pointer' : 'default',
          }}
        >
          {submitting ? 'Posting…' : 'Post'}
        </button>
      </div>

      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <label style={labelStyle}>Community</label>
          <input
            style={inputStyle}
            placeholder="communityname@instance.tld"
            value={community}
            onChange={(e) => setCommunity(e.target.value)}
          />
        </div>

        <div>
          <label style={labelStyle}>
            Title <span style={{ color: '#ff6b35' }}>*</span>
          </label>
          <input
            style={inputStyle}
            placeholder="Post title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        <div>
          <label style={labelStyle}>URL</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              style={{ ...inputStyle, width: 'auto', flex: 1 }}
              placeholder="https://..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
            <button
              aria-label="Upload image"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              style={{
                background: '#2a2d35', border: '1px solid #3a3d45',
                borderRadius: 8, padding: '0 12px',
                color: uploading ? '#888' : '#f5f5f5',
                fontSize: 18, cursor: uploading ? 'default' : 'pointer',
                flexShrink: 0,
              }}
            >
              📷
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleUpload}
          />
          {uploading && (
            <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>Uploading…</div>
          )}
          {uploadError && (
            <div style={{ fontSize: 12, color: '#ff4444', marginTop: 4 }}>{uploadError}</div>
          )}
        </div>

        <div>
          <label style={labelStyle}>Body</label>
          <textarea
            style={{ ...inputStyle, minHeight: 100, resize: 'vertical' }}
            placeholder="Optional text body…"
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
        </div>

        {submitError && (
          <div style={{ fontSize: 13, color: '#ff4444' }}>{submitError}</div>
        )}
      </div>
    </div>
  );
}
