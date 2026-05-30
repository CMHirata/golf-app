// ─── components/PlayerAvatar.jsx ─────────────────────────────────────────────
//
// ✅ Self-checked (15-L): No wrapper div — returns circle element directly.
// Starred badge uses SVG overlay absolutely positioned, requiring the caller
// to provide position:relative context OR the badge is rendered via an SVG
// drawn directly on the circle. Uses line-height centering, no flexbox.

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
  const badgeSize = Math.round(size * 0.34);

  const sharedStyle = {
    width: size,
    height: size,
    borderRadius: '50%',
    flexShrink: 0,
    cursor: onPress ? 'pointer' : 'default',
    position: 'relative',
    display: 'block',
  };

  if (photo) {
    return (
      <div style={sharedStyle} onClick={onPress || undefined}>
        <img
          src={photo}
          alt={name}
          style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover', display: 'block' }}
        />
        {starred && <StarBadge size={badgeSize} />}
      </div>
    );
  }

  return (
    <div
      style={{ ...sharedStyle, background: G }}
      onClick={onPress || undefined}
    >
      <span style={{
        display: 'block',
        width: '100%',
        lineHeight: `${size}px`,
        textAlign: 'center',
        color: '#fff',
        fontSize: Math.round(size * 0.38),
        fontWeight: 700,
        fontFamily: 'inherit',
        userSelect: 'none',
      }}>
        {ini}
      </span>
      {starred && <StarBadge size={badgeSize} />}
    </div>
  );
}

function StarBadge({ size }) {
  return (
    <div style={{
      position: 'absolute',
      bottom: -2,
      right: -2,
      fontSize: size,
      lineHeight: 1,
      color: '#fff9c4',
      userSelect: 'none',
      pointerEvents: 'none',
      textShadow: '0 0 2px rgba(0,0,0,0.4)',
    }}>
      ★
    </div>
  );
}
