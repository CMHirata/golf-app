// ─── pages/HomePage.jsx ───────────────────────────────────────────────────────
import { useMemo } from 'react';
import { ls, SK } from '../services/storage.js';
import { roundLib } from '../services/roundLib.js';
import { Btn, Card, G, GA, RED, fmtDate, fmtDollar } from '../components/ui.jsx';

// ── SVG icons ─────────────────────────────────────────────────────────────────
const IconPlus = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.8" strokeLinecap="round">
    <line x1="12" y1="5" x2="12" y2="19"/>
    <line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
);

const IconStar = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
    stroke="#FFE066" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
  </svg>
);

export default function HomePage({ onNewRound, onResume, onHistory, inProgress, onRoundTap }) {
  const rounds  = useMemo(() => roundLib.list().slice(0, 20), []);
  const players = useMemo(() => ls.get(SK.players) || [], []);
  const courses = useMemo(() => ls.get(SK.courses) || [], []);
  const recent  = rounds.filter(r => r.bank).slice(0, 4);

  // YTD top winner
  const now = new Date();
  const ytd = rounds.filter(r => r.date && new Date(r.date).getFullYear() === now.getFullYear());
  const ytdBank = {};
  ytd.forEach(r => Object.entries(r.bank || {}).forEach(([n, v]) => {
    ytdBank[n] = (ytdBank[n] || 0) + v;
  }));
  const topWinner = Object.entries(ytdBank).sort((a, b) => b[1] - a[1])[0];

  return (
    <div style={{ minHeight: '100vh', background: '#eef4ee' }}>

      {/* ── Header: logo icon left, "The Card" right ── */}
      <div style={{
        background: G,
        padding: '8px 16px 7px',
        position: 'sticky', top: 0, zIndex: 10,
        boxShadow: '0 2px 12px rgba(0,0,0,.2)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        {/* Icon-only logo — JPEG background matches header green */}
        <img
          src="/logo_icon.png"
          alt="The Card"
          style={{ height: 58, width: 'auto', display: 'block' }}
        />
        <div style={{
          color: '#fff',
          fontWeight: 800,
          fontSize: 16,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          fontFamily: 'inherit',
        }}>
          The Card
        </div>
      </div>

      <div style={{ padding: '14px 14px', maxWidth: 520, margin: '0 auto' }}>

        {/* ── Resume in-progress round ── */}
        {inProgress && (
          <div style={{
            background: '#fff8e1', border: '1.5px solid #f0c040',
            borderRadius: 14, padding: '12px 14px', marginBottom: 12,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 13, color: '#b7770d' }}>Round in Progress</div>
              <div style={{ fontSize: 11, color: '#b7770d', opacity: 0.8 }}>Tap to continue scoring</div>
            </div>
            <Btn onClick={onResume} style={{ background: '#e67e22', color: '#fff', border: 'none', borderRadius: 10, padding: '8px 16px', fontSize: 13, fontWeight: 700 }}>
              Resume →
            </Btn>
          </div>
        )}

        {/* ── New Round CTA ── */}
        <button
          onClick={onNewRound}
          style={{
            width: '100%', background: G, color: '#fff', border: 'none',
            borderRadius: 14, padding: '16px 20px', fontSize: 15, fontWeight: 800,
            cursor: 'pointer', display: 'flex', alignItems: 'center',
            justifyContent: 'center', gap: 8, marginBottom: 12,
            boxShadow: '0 4px 16px rgba(26,71,42,.3)',
            fontFamily: 'inherit',
          }}
        >
          <IconPlus />
          New Round
        </button>

        {/* ── Quick stats ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
          {[
            { label: 'Rounds',  value: rounds.length  },
            { label: 'Players', value: players.length },
            { label: 'Courses', value: courses.length },
          ].map(s => (
            <div key={s.label} style={{
              background: '#fff', borderRadius: 12, padding: '12px 8px',
              textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,.06)',
            }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: G, lineHeight: 1.1 }}>{s.value}</div>
              <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* ── YTD leader ── */}
        {topWinner && (
          <div style={{
            background: '#fff', borderRadius: 12, padding: '11px 14px',
            marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10,
            boxShadow: '0 1px 4px rgba(0,0,0,.06)',
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: '50%',
              background: '#fffbe0',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <IconStar />
            </div>
            <div>
              <div style={{ fontSize: 10, color: '#999', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>YTD Leader</div>
              <div style={{ fontWeight: 800, fontSize: 14, color: '#222' }}>{topWinner[0]}</div>
              <div style={{ fontSize: 12, color: '#27ae60', fontWeight: 700 }}>
                {fmtDollar(topWinner[1])} in {ytd.length} round{ytd.length !== 1 ? 's' : ''}
              </div>
            </div>
          </div>
        )}

        {/* ── Recent rounds ── */}
        {recent.length > 0 && (
          <Card>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: G }}>Recent Rounds</div>
              <button
                onClick={onHistory}
                style={{ fontSize: 12, color: G, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', fontFamily: 'inherit' }}>
                View all
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {recent.map((r, i) => (
                <div
                  key={r.id}
                  onClick={() => onRoundTap && onRoundTap(r)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '8px 0',
                    borderBottom: i < recent.length - 1 ? '1px solid #f0f0f0' : 'none',
                    cursor: onRoundTap ? 'pointer' : 'default',
                  }}
                >
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: '#222', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {r.course_name || 'Unknown'}
                    </div>
                    <div style={{ fontSize: 11, color: '#999' }}>
                      {fmtDate(r.date)} · {(r.players || []).map(p => typeof p === 'string' ? p : p.name).slice(0, 3).join(', ')}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 4, flexShrink: 0, marginLeft: 8 }}>
                    {Object.entries(r.bank || {}).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([name, v]) => (
                      <span key={name} style={{
                        fontSize: 11, fontWeight: 700,
                        padding: '2px 7px', borderRadius: 20,
                        background: v > 0 ? '#e8f5e8' : v < 0 ? '#fce8e8' : '#f5f5f5',
                        color: v > 0 ? '#27ae60' : v < 0 ? RED : '#888',
                      }}>
                        {name.split(' ')[0]} {fmtDollar(v)}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* ── Empty state ── */}
        {rounds.length === 0 && players.length === 0 && (
          <div style={{ textAlign: 'center', padding: '48px 20px', color: '#aaa' }}>
            <img
              src="/logo_icon.png"
              alt=""
              style={{ height: 64, width: 'auto', marginBottom: 16, opacity: 0.5 }}
            />
            <div style={{ fontSize: 15, fontWeight: 700, color: '#888', marginBottom: 6 }}>Welcome to The Card</div>
            <div style={{ fontSize: 13 }}>Add players and courses, then start your first round.</div>
          </div>
        )}

      </div>
    </div>
  );
}
