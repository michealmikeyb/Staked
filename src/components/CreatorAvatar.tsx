import { placeholderColor } from '../lib/urlUtils';

interface Props {
  name: string;
  avatar?: string;
  size: number;
}

export default function CreatorAvatar({ name, avatar, size }: Props) {
  if (avatar) {
    return (
      <img
        src={avatar}
        alt=""
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
      />
    );
  }
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: `${Math.round(size * 0.5)}px`,
        fontWeight: 700,
        color: '#fff',
        background: placeholderColor(name),
        flexShrink: 0,
      }}
    >
      {name.charAt(0).toUpperCase()}
    </span>
  );
}
