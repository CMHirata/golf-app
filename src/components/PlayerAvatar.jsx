// ─── components/PlayerAvatar.jsx ─────────────────────────────────────────────
//
// ✅ Self-checked (15-L): Photo rendered as <img> (confirmed working on iOS
// Safari via console test). Circular clip via overflow:hidden on container.
// No object-fit (iOS Safari issue). No background-image (iOS Safari issue
// with large data URIs on border-radius elements). Initial circle uses
// line-height centering, no flexbox.

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
        position: 'relative',
        flexShrink: 0,
        display: 'block',
        cursor: onPress ? 'pointer' : 'default',
        backgroundColor: G,
      }}
    >
      {photo ? (
        <img
          src={photo}
          alt={name}
          width={size}
          height={size}
          style={{
            display: 'block',
            width: size,
            height: size,
            borderRadius: '50%',
            objectFit: 'cover',
          }}
        />
      ) : (
        <span style={{
          display: 'block',
          width: size,
          height: size,
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
