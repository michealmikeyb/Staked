import { placeholderColor } from '../lib/urlUtils';

interface Props {
  name: string;
  icon?: string | null;
  size: number;
  style?: React.CSSProperties;
}

export default function CommunityAvatar({ name, icon, size, style }: Props) {
  if (icon) {
    return (
      <img
        data-testid="community-avatar-img"
        src={icon}
        alt=""
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, ...style }}
      />
    );
  }
  return (
    <span
      style={{
        width: size, height: size, borderRadius: '50%',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        fontSize: `${Math.round(size * 0.5)}px`, fontWeight: 700,
        color: '#fff', background: placeholderColor(name), flexShrink: 0,
        ...style,
      }}
    >
      {name.charAt(0).toUpperCase()}
    </span>
  );
}
