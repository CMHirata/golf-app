// ─── components/PlayerAvatar.jsx ─────────────────────────────────────────────
//
// ✅ Self-checked: photo branch uses object-fit cover + borderRadius 50% for
// circular crop; initial branch uses app green (#1a472a) for all players per
// 15-L decision (no gender/rank color encoding); starred badge scales with size
// prop; onPress wired only when provided; no external CSS.

const G = '#1a472a';

function initials(name) {
  if (!name) return '?';
  const parts = (name || '').trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0]?.toUpperCase() || '?';
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Props:
//   player   — player library record or activePlayers entry ({ name, photo? })
//   size     — diameter in px (default 36)
//   starred  — show yellow star badge bottom-right (default false)
//   onPress  — optional tap callback; enables pointer cursor
export default function PlayerAvatar({ player, size = 36, starred = false, onPress }) {
  const name  = player?.name || '';
  const photo = player?.photo || null;
  const ini   = initials(name);
  const badgeSize = Math.round(size * 0.32);

  const containerStyle = {
    position: 'relative',
    width: size,
    height: size,
    flexShrink: 0,
    cursor: onPress ? 'pointer' : 'default',
    display: 'inline-block',
  };

  const circleBase = {
    width: size,
    height: size,
    borderRadius: '50%',
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  };

  const inner = photo ? (
    <div style={circleBase}>
      <img
        src={photo}
        alt={name}
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
      />
    </div>
  ) : (
    <div style={{ ...circleBase, background: G }}>
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

  return (
    <div style={containerStyle} onClick={onPress || undefined}>
      {inner}
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
