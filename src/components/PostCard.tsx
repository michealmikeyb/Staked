import { type PostView } from '../lib/lemmy';
import styles from './PostCard.module.css';

interface Props {
  post: PostView;
  zIndex: number;
  scale: number;
  onSwipeRight: () => void;
  onSwipeLeft: () => void;
  onOpenComments: () => void;
}

function communityInitial(name: string): string {
  return name.charAt(0).toUpperCase();
}

function instanceFromActorId(actorId: string): string {
  try {
    return new URL(actorId).hostname;
  } catch {
    return '';
  }
}

export default function PostCard({ post, zIndex, scale, onSwipeRight, onSwipeLeft, onOpenComments }: Props) {
  const { post: p, community, creator, counts } = post;
  const instance = instanceFromActorId(community.actor_id);

  return (
    <div
      className={styles.card}
      style={{ zIndex, transform: `scale(${scale})`, transition: 'transform 0.2s' }}
    >
      <div className={styles.meta}>
        <div className={styles.communityIcon}>{communityInitial(community.name)}</div>
        <div>
          <div className={styles.communityName}>c/{community.name}</div>
          <div className={styles.instanceName}>{instance} • {creator.name}</div>
        </div>
      </div>

      <div className={styles.title}>{p.name}</div>

      <div className={styles.thumbnail}>
        {p.thumbnail_url
          ? <img src={p.thumbnail_url} alt="" loading="lazy" />
          : <span>No image</span>}
      </div>

      {p.body && (
        <div className={styles.excerpt}>{p.body}</div>
      )}

      <div className={styles.footer}>
        <span>▲ {counts.score}</span>
        <span>💬 {counts.comments}</span>
      </div>

      <div className={styles.scrollHint} onClick={onOpenComments}>↓ comments</div>
    </div>
  );
}
