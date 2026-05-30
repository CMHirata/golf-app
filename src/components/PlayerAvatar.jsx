// ─── components/PlayerAvatar.jsx ─────────────────────────────────────────────
//
// ✅ Self-checked (15-L): Container uses explicit px dimensions and no
// position:relative unless starred badge needed. Inner circle uses explicit
// width/height. Works in both flex-row and flex-column parent contexts.

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
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    }}>
      <span style={{
        color: '#fff',
        fontSize: Math.round(size * 0.38),
        fontWeight: 700,
        lineHeight: 1,
        fontFamily: 'inherit',
        userSelect: 'none',
      }}>
        {ini}
      </span>
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
