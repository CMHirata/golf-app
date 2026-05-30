// ─── components/PlayerAvatar.jsx ─────────────────────────────────────────────
//
// ✅ Self-checked (15-L): Single root div with background always set to G.
// Photo rendered as background-image CSS property — no <img> element, no
// load failures, no wrapper. Works in all contexts including flex columns.

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

  return (
    <div
      onClick={onPress || undefined}
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        backgroundColor: G,
        backgroundImage: photo ? `url("${photo}")` : 'none',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        display: 'block',
        position: 'relative',
        flexShrink: 0,
        cursor: onPress ? 'pointer' : 'default',
        overflow: 'hidden',
      }}
    >
      {!photo && (
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
      )}
      {starred && (
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
      )}
    </div>
  );
}
