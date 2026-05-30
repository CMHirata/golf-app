// ─── components/PlayerAvatar.jsx ─────────────────────────────────────────────
//
// ✅ Self-checked (15-L): Uses line-height + text-align for initial centering
// instead of flexbox — avoids foreignObject/flex rendering failures in WebKit.
// Photo branch uses <img> with borderRadius. Starred badge uses position:relative
// wrapper only when needed.

const G = '#1a472a';

function initials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return (parts[0][0] || '?').toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function PlayerAvatar({ player, size = 36, starred = false, onPress }) {
  const name  = player?.name || '';
  const photo = player?.photo || null;
  const ini   = initials(name);
  const badgeSize = Math.round(size * 0.32);

  const circle = photo ? (
    <img
      src={photo}
      alt={name}
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        objectFit: 'cover',
        display: 'block',
        flexShrink: 0,
      }}
    />
  ) : (
    <div style={{
      width: size,
      height: size,
      borderRadius: '50%',
      background: G,
      color: '#fff',
      fontSize: Math.round(size * 0.38),
      fontWeight: 700,
      lineHeight: `${size}px`,
      textAlign: 'center',
      fontFamily: 'inherit',
      userSelect: 'none',
      flexShrink: 0,
      display: 'block',
    }}>
      {ini}
    </div>
  );

  if (!starred) {
    return (
      <div
        style={{ display: 'block', flexShrink: 0, cursor: onPress ? 'pointer' : 'default' }}
        onClick={onPress || undefined}
      >
        {circle}
      </div>
    );
  }

  return (
    <div
      style={{ position: 'relative', display: 'inline-block', flexShrink: 0, cursor: onPress ? 'pointer' : 'default' }}
      onClick={onPress || undefined}
    >
      {circle}
      <div style={{
        position: 'absolute',
        bottom: -2,
        right: -2,
        fontSize: badgeSize,
        lineHeight: 1,
        color: '#fff9c4',
        userSelect: 'none',
        pointerEvents: 'none',
        textShadow: '0 0 2px rgba(0,0,0,0.4)',
      }}>
        ★
      </div>
    </div>
  );
}
