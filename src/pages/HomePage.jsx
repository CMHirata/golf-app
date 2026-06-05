// ─── pages/HomePage.jsx ───────────────────────────────────────────────────────
//
// ✅ Self-checked: H-13 — starred/inMoneyLists enriched from playerLib by name.
//    H-46 — no overflow:hidden on any ancestor of PlayerAvatar; slide removed,
//    matrix is full-width toggle. H-29 — filterByRange before all stats/streaks.
//    H-30 — ML_KEY only. No emoji. Individual stat tile cards. ++ bug fixed.
//    Game names stripped of emoji/special chars, sorted alphabetically.
//    Range pill centered. Left arrow on Standings back link.

import { useMemo, useState, useCallback } from 'react';
import { ls, SK } from '../services/storage.js';
import { roundLib } from '../services/roundLib.js';
import { Card, G, fmtDollar, Btn } from '../components/ui.jsx';
import {
  loadRangePref, saveRangePref, filterByRange, rangeLabel,
  RangePickerRow, ML_KEY,
} from '../components/RangePicker.jsx';
import PlayerAvatar from '../components/PlayerAvatar.jsx';

// ── Constants ─────────────────────────────────────────────────────────────────
const HOME_VIEW_KEY = 'homeViewMode';
const ICON_BG = '#e8f5ec'; // light green circle bg for stat/insight icons

// ── Stat tile icons — match nav icon style ────────────────────────────────────
const IconRounds = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
    stroke={G} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 22V2.8a.8.8 0 0 1 1.17-.71l11.38 5.69a.8.8 0 0 1 0 1.44L6 15.5"/>
  </svg>
);

const IconPeople = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
    stroke={G} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <path d="M22 21v-2a4 4 0 0 0-3-3.87"/>
    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
);

const IconPin = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
    stroke={G} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0z"/>
    <circle cx="12" cy="10" r="3"/>
  </svg>
);

const IconWagered = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
    stroke={G} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/>
    <path d="M12 18V6"/>
  </svg>
);

// ── Other icons ───────────────────────────────────────────────────────────────
const IconChevronDown = ({ size = 10, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9"/>
  </svg>
);

const IconChevronRight = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
    stroke={G} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6"/>
  </svg>
);

const IconArrowUp = ({ color = G }) => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
    stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="19" x2="12" y2="5"/>
    <polyline points="5 12 12 5 19 12"/>
  </svg>
);

const IconArrowDown = ({ color = '#A32D2D' }) => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
    stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19"/>
    <polyline points="5 12 12 19 19 12"/>
  </svg>
);

const IconPlus = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.8" strokeLinecap="round">
    <line x1="12" y1="5" x2="12" y2="19"/>
    <line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
);

// ── Insight icons in light green circles ─────────────────────────────────────
const IconFireSvg = () => (
  <svg width="22" height="22" viewBox="0 0 128 128">
    <radialGradient id="fireA" cx="68.884" cy="124.296" r="70.587" gradientTransform="matrix(-1 -.00434 -.00713 1.6408 131.986 -79.345)" gradientUnits="userSpaceOnUse">
      <stop offset=".314" stopColor="#FF9800"/>
      <stop offset=".662" stopColor="#FF6D00"/>
      <stop offset=".972" stopColor="#F44336"/>
    </radialGradient>
    <path fill="url(#fireA)" d="M35.56 40.73c-.57 6.08-.97 16.84 2.62 21.42c0 0-1.69-11.82 13.46-26.65c6.1-5.97 7.51-14.09 5.38-20.18c-1.21-3.45-3.42-6.3-5.34-8.29c-1.12-1.17-.26-3.1 1.37-3.03c9.86.44 25.84 3.18 32.63 20.22c2.98 7.48 3.2 15.21 1.78 23.07c-.9 5.02-4.1 16.18 3.2 17.55c5.21.98 7.73-3.16 8.86-6.14c.47-1.24 2.1-1.55 2.98-.56c8.8 10.01 9.55 21.8 7.73 31.95c-3.52 19.62-23.39 33.9-43.13 33.9c-24.66 0-44.29-14.11-49.38-39.65c-2.05-10.31-1.01-30.71 14.89-45.11c1.18-1.08 3.11-.12 2.95 1.5"/>
    <radialGradient id="fireB" cx="64.921" cy="54.062" r="73.86" gradientTransform="matrix(-.0101 .9999 .7525 .0076 26.154 -11.267)" gradientUnits="userSpaceOnUse">
      <stop offset=".214" stopColor="#FFF176"/>
      <stop offset=".793" stopColor="#FFF9C4"/>
      <stop offset=".941" stopColor="#FFF176" stopOpacity="0"/>
    </radialGradient>
    <path fill="url(#fireB)" d="M76.11 77.42c-9.09-11.7-5.02-25.05-2.79-30.37c.3-.7-.5-1.36-1.13-.93c-3.91 2.66-11.92 8.92-15.65 17.73c-5.05 11.91-4.69 17.74-1.7 24.86c1.8 4.29-.29 5.2-1.34 5.36c-1.02.16-1.96-.52-2.71-1.23a16.1 16.1 0 0 1-4.44-7.6c-.16-.62-.97-.79-1.34-.28c-2.8 3.87-4.25 10.08-4.32 14.47C40.47 113 51.68 124 65.24 124c17.09 0 29.54-18.9 19.72-34.7c-2.85-4.6-5.53-7.61-8.85-11.88"/>
  </svg>
);

const IconSnowSvg = () => (
  <svg width="22" height="22" viewBox="0 0 80 80">
    <g fill="none">
      <path fill="#56ccf2" d="M33.609 15.016a2 2 0 0 0-2.728 2.926zm6.395 8.695l-1.364 1.463a2 2 0 0 0 2.727 0zM26.04 31.77l.585 1.913a2 2 0 0 0 1.364-2.362zm-.434-10.784a2 2 0 1 0-3.898.9zm23.517-3.043a2 2 0 0 0-2.728-2.926zm9.173 3.945a2 2 0 0 0-3.897-.899zm-4.331 9.883l-1.95-.45a2 2 0 0 0 1.364 2.362zm9.698 5.06a2 2 0 1 0 1.17-3.826zm1.17 9.828a2 2 0 0 0-1.17-3.825zm-10.868 1.234l-.586-1.913a2 2 0 0 0-1.363 2.362zm.502 11.079a2 2 0 1 0 3.898-.899zm-7.848 5.883a2 2 0 0 0 2.727-2.926zm-6.616-8.901l1.363-1.463a2 2 0 0 0-2.727 0zm-9.346 5.977a2 2 0 0 0 2.727 2.926zm-9.018-3.855a2 2 0 1 0 3.898.899zm4.401-10.183l1.95.45a2 2 0 0 0-1.364-2.363zm-9.704-5.061a2 2 0 1 0-1.17 3.825zm-1.17-9.825a2 2 0 1 0 1.17 3.825zM30.88 17.942l7.759 7.232l2.727-2.926l-7.758-7.232zm-2.89 13.38l-2.384-10.335l-3.898.9l2.383 10.334zm13.376-6.148l7.757-7.23l-2.728-2.926l-7.756 7.23zM54.4 20.99l-2.383 10.332l3.897.9l2.383-10.333zm-1.02 12.694l10.284 3.147l1.17-3.825l-10.283-3.147zm10.284 9.15L53.38 45.982l1.17 3.825l10.285-3.146zm-11.647 5.51l2.451 10.629l3.898-.899l-2.452-10.63zm-2.67 13.586l-7.98-7.438l-2.727 2.926l7.98 7.438zM38.64 54.492l-7.982 7.44l2.727 2.926l7.982-7.44zm-13.102 4.484l2.452-10.633l-3.898-.899l-2.451 10.633zm1.088-12.995l-10.289-3.148l-1.17 3.825l10.29 3.148zm-10.289-9.148l10.29-3.149l-1.17-3.825l-10.29 3.149z"/>
      <path fill="#2f80ed" d="m40 12l2-.002a2 2 0 0 0-4 0zm24.249 14l1.001 1.731a2 2 0 0 0-2-3.464zm0 28l-.999 1.733a2 2 0 0 0 2-3.464zm-24.25 14l-2 .002a2 2 0 0 0 4 0zM15.752 54l-1.001-1.731a2 2 0 0 0 2 3.464zm0-28l.999-1.733a2 2 0 0 0-2 3.464zm18.231 10.501l-.998 1.733zm0 6.998l-.998-1.733zm12.035 0l-.998 1.733zm-5.996 3.462l-2-.002zm6.018-10.423l-1.002-1.731zm0 6.924l-1.002 1.731zM40.02 33.04l-2 .002zm5.996 3.462l.999 1.733zM38 12.002l.021 21.04l4-.005L42 11.998zm9.016 26.232l18.23-10.5l-1.996-3.467l-18.23 10.501zm16.23-13.965l-18.21 10.538l2.004 3.462l18.21-10.538zm-18.21 20.924l18.21 10.538l2.004-3.462l-18.21-10.538zm20.21 7.074l-18.23-10.501l-1.997 3.466L63.25 55.733zm-27.225-5.308L38 67.998l4 .004l.021-21.04zM42 67.998l-.021-21.04l-4 .005l.02 21.039zm-9.016-26.232l-18.231 10.5l1.997 3.467l18.23-10.501zM16.753 55.73l18.21-10.538l-2.004-3.462l-18.21 10.538zm18.21-20.924l-18.21-10.538l-2.004 3.462l18.21 10.538zm-20.21-7.074l18.231 10.501l1.997-3.466l-18.231-10.5zm27.226 5.308l.02-21.039l-4-.004l-.02 21.04zm-8.995 5.194c3.998 2.302 8.99-.58 8.995-5.194l-4-.004c-.002 1.538-1.666 2.499-2.998 1.731zm1.979 6.958c3.993-2.31 3.993-8.075 0-10.386l-2.004 3.462c1.331.77 1.331 2.692 0 3.462zm7.016 1.766c-.005-4.614-4.997-7.496-8.995-5.193l1.997 3.466c1.332-.768 2.996.193 2.998 1.73zm5.037-5.193c-3.998-2.303-8.99.58-8.995 5.193l4 .004c.002-1.538 1.666-2.499 2.998-1.731zm-1.98-6.96c-3.992 2.312-3.992 8.076 0 10.387l2.004-3.462c-1.33-.77-1.33-2.692 0-3.462zm-7.015-1.765c.005 4.614 4.997 7.496 8.995 5.194l-1.997-3.467c-1.332.768-2.996-.193-2.998-1.73z"/>
    </g>
  </svg>
);

const IconTeamSvg = () => (
  <svg viewBox="0 0 72 72" width="26" height="26" xmlns="http://www.w3.org/2000/svg">
    <circle cx="36" cy="36.8833" r="25" fill="#FFFFFF"/>
    <path fill="#3F3F3F" d="M10.8833,36.8833c0,13.6133,10.8253,24.6897,24.3381,25.0915c-6.5806-0.4018-11.7797-5.8647-11.7797-12.5332c0-6.9322,5.6137-12.5583,12.5583-12.5583c6.9322,0,12.5583-5.6261,12.5583-12.5583c0-6.6685-5.2117-12.1313-11.7923-12.5332c-0.2511-0.0126-0.5022-0.0251-0.766-0.0251s-0.5275,0-0.7786,0.0251C21.7086,12.1937,10.8833,23.2701,10.8833,36.8833z"/>
    <circle cx="37.3437" cy="48.9394" r="4.0187" fill="#3F3F3F"/>
    <circle cx="37.3437" cy="23.8227" r="4.0187" fill="#FFFFFF"/>
    <path fill="none" stroke="#000000" strokeLinecap="round" strokeLinejoin="round" strokeMiterlimit="10" strokeWidth="2" d="M23.4417,49.4417c0,6.6685,5.1992,12.1314,11.7797,12.5332C35.4851,61.9874,35.7362,62,36,62s0.5149-0.0126,0.766-0.0251c13.5128-0.3893,24.3506-11.4657,24.3506-25.0915c0-13.6258-10.8379-24.7022-24.3506-25.0915c6.5806,0.4019,11.7923,5.8647,11.7923,12.5332c0,6.9322-5.6261,12.5583-12.5583,12.5583C29.0554,36.8833,23.4417,42.5094,23.4417,49.4417z"/>
    <path fill="none" stroke="#000000" strokeLinecap="round" strokeLinejoin="round" strokeMiterlimit="10" strokeWidth="2" d="M10.8833,36.8833c0,13.6133,10.8253,24.6897,24.3381,25.0915c-6.5806-0.4018-11.7797-5.8647-11.7797-12.5332c0-6.9322,5.6137-12.5583,12.5583-12.5583c6.9322,0,12.5583-5.6261,12.5583-12.5583c0-6.6685-5.2117-12.1313-11.7923-12.5332c-0.2511-0.0126-0.5022-0.0251-0.766-0.0251s-0.5275,0-0.7786,0.0251C21.7086,12.1937,10.8833,23.2701,10.8833,36.8833z"/>
    <circle cx="37.3437" cy="48.9394" r="4.0187" fill="none" stroke="#000000" strokeMiterlimit="10" strokeWidth="2"/>
    <circle cx="37.3437" cy="23.8227" r="4.0187" fill="none" stroke="#000000" strokeMiterlimit="10" strokeWidth="2"/>
  </svg>
);

const IconLockSvg = () => (
  <svg viewBox="0 0 72 72" width="26" height="26" xmlns="http://www.w3.org/2000/svg">
    <path fill="#D0CFCE" stroke="#D0CFCE" strokeLinecap="round" strokeLinejoin="round" strokeMiterlimit="10" strokeWidth="2" d="M21.3751,31.1747c-0.3501-8.7708,6.4491-18.5395,14.387-18.7794c8.0047-0.2419,16.5412,10.9698,14.333,19.052h-4.0394c0,0,1.5619-7.922-2.2164-11.2535c-1.8494-1.6307-5.2556-4.771-8.6396-4.2922c-2.2829,0.323-6.8677,3.4518-7.9271,5.4209c-2.0643,3.8367-1.7248,9.8169-1.7248,9.8169L21.3751,31.1747z"/>
    <polygon fill="#FCEA2B" stroke="none" points="53,32.2969 54.875,32.2969 54.875,59.1719 16.875,59.1719 16.875,32.2969 18.75,32.2969"/>
    <polygon fill="#F1B31C" stroke="none" points="54.4302,32.493 35.66,58.9944 54.9675,58.9944"/>
    <polygon fill="none" stroke="#000000" strokeLinecap="round" strokeLinejoin="round" strokeMiterlimit="10" strokeWidth="2" points="53,32.25 54.875,32.25 54.875,59.125 16.875,59.125 16.875,32.25 18.75,32.25"/>
    <path fill="none" stroke="#000000" strokeLinecap="round" strokeLinejoin="round" strokeMiterlimit="10" strokeWidth="2" d="M21.3751,28.9146c0-8.3786,6.4151-16.2744,14.3184-16.523c7.9697-0.2507,15.4098,7.2847,14.7416,16.523"/>
    <path fill="none" stroke="#000000" strokeLinecap="round" strokeLinejoin="round" strokeMiterlimit="10" strokeWidth="2" d="M25.5478,28.9146c0-6.3352,4.5755-12.3054,10.2123-12.4934c5.6843-0.1896,10.9908,5.5081,10.5142,12.4934"/>
  </svg>
);

// Inline fire/snow for streak labels (small)
const FireSmall = () => (
  <svg width="11" height="11" viewBox="0 0 128 128">
    <path fill="#FF9800" d="M35.56 40.73c-.57 6.08-.97 16.84 2.62 21.42c0 0-1.69-11.82 13.46-26.65c6.1-5.97 7.51-14.09 5.38-20.18c-1.21-3.45-3.42-6.3-5.34-8.29c-1.12-1.17-.26-3.1 1.37-3.03c9.86.44 25.84 3.18 32.63 20.22c2.98 7.48 3.2 15.21 1.78 23.07c-.9 5.02-4.1 16.18 3.2 17.55c5.21.98 7.73-3.16 8.86-6.14c.47-1.24 2.1-1.55 2.98-.56c8.8 10.01 9.55 21.8 7.73 31.95c-3.52 19.62-23.39 33.9-43.13 33.9c-24.66 0-44.29-14.11-49.38-39.65c-2.05-10.31-1.01-30.71 14.89-45.11c1.18-1.08 3.11-.12 2.95 1.5"/>
    <path fill="#FFF176" fillOpacity=".7" d="M76.11 77.42c-9.09-11.7-5.02-25.05-2.79-30.37c.3-.7-.5-1.36-1.13-.93c-3.91 2.66-11.92 8.92-15.65 17.73c-5.05 11.91-4.69 17.74-1.7 24.86c1.8 4.29-.29 5.2-1.34 5.36c-1.02.16-1.96-.52-2.71-1.23a16.1 16.1 0 0 1-4.44-7.6c-.16-.62-.97-.79-1.34-.28c-2.8 3.87-4.25 10.08-4.32 14.47C40.47 113 51.68 124 65.24 124c17.09 0 29.54-18.9 19.72-34.7c-2.85-4.6-5.53-7.61-8.85-11.88"/>
  </svg>
);

const SnowSmall = () => (
  <svg width="11" height="11" viewBox="0 0 80 80">
    <path fill="#56ccf2" d="M30.88 17.942l7.759 7.232l2.727-2.926l-7.758-7.232zm-2.89 13.38l-2.384-10.335l-3.898.9l2.383 10.334zm13.376-6.148l7.757-7.23l-2.728-2.926l-7.756 7.23zM54.4 20.99l-2.383 10.332l3.897.9l2.383-10.333zm-1.02 12.694l10.284 3.147l1.17-3.825l-10.283-3.147zm10.284 9.15L53.38 45.982l1.17 3.825l10.285-3.146zm-11.647 5.51l2.451 10.629l3.898-.899l-2.452-10.63zm-2.67 13.586l-7.98-7.438l-2.727 2.926l7.98 7.438zM38.64 54.492l-7.982 7.44l2.727 2.926l7.982-7.44zm-13.102 4.484l2.452-10.633l-3.898-.899l-2.451 10.633zm1.088-12.995l-10.289-3.148l-1.17 3.825l10.29 3.148zm-10.289-9.148l10.29-3.149l-1.17-3.825l-10.29 3.149z"/>
    <path fill="#2f80ed" d="M38 12.002l.021 21.04l4-.005L42 11.998zm9.016 26.232l18.23-10.5l-1.996-3.467l-18.23 10.501zm16.23-13.965l-18.21 10.538l2.004 3.462l18.21-10.538zm-18.21 20.924l18.21 10.538l2.004-3.462l-18.21-10.538zm20.21 7.074l-18.23-10.501l-1.997 3.466L63.25 55.733zm-27.225-5.308L38 67.998l4 .004l.021-21.04zM42 67.998l-.021-21.04l-4 .005l.02 21.039zm-9.016-26.232l-18.231 10.5l1.997 3.467l18.23-10.501zM16.753 55.73l18.21-10.538l-2.004-3.462l-18.21 10.538zm18.21-20.924l-18.21-10.538l-2.004 3.462l18.21 10.538zm-20.21-7.074l18.231 10.501l1.997-3.466l-18.231-10.5zm27.226 5.308l.02-21.039l-4-.004l-.02 21.04z"/>
  </svg>
);

// ── Pennant ribbon SVG ────────────────────────────────────────────────────────
function PennantRibbon({ rank }) {
  const color = rank === 1 ? G : rank === 2 ? '#8a8a8a' : '#b67a43';
  // Downward-pointing banner shape: rect top + triangle notch at bottom center
  return (
    <svg width="32" height="36" viewBox="0 0 32 36" style={{ display: 'block' }}>
      <path d="M2 0 H30 V26 L16 36 L2 26 Z" fill={color}/>
      <text x="16" y="18" textAnchor="middle" dominantBaseline="middle"
        fill="#fff" fontSize="13" fontWeight="800" fontFamily="inherit">
        {rank}
      </text>
    </svg>
  );
}

// ── Data helpers ──────────────────────────────────────────────────────────────
function cleanGameName(raw) {
  // Strip all non-ASCII (emoji, special chars) then clean suffix details
  let s = raw.replace(/[^\x00-\x7F]/g, '').trim();
  // Remove detail suffixes after — - / (
  s = s.replace(/\s*[—–\/].*$/, '').replace(/\s*\(.*$/, '').trim();
  // Normalize known variants
  if (/^match/i.test(s)) return 'Match';
  if (/^nines/i.test(s)) return 'Nines';
  if (/^sixes/i.test(s)) return 'Sixes';
  if (/^dots/i.test(s) || /^specials/i.test(s)) return 'Dots';
  if (/^stableford/i.test(s)) return 'Stableford';
  if (/^stroke/i.test(s)) return 'Stroke Play';
  if (/^nassau/i.test(s)) return 'Nassau';
  return s || 'Other';
}

function computeStreaks(filteredRounds, names) {
  const streaks = {};
  for (const name of names) {
    let count = 0, type = null;
    for (const r of filteredRounds) {
      const net = r.bank?.[name];
      if (net == null) break;
      if (net > 0) { if (type === 'cold') break; type = 'hot'; count++; }
      else if (net < 0) { if (type === 'hot') break; type = 'cold'; count++; }
      else break;
    }
    if (count >= 2 && type) streaks[name] = { count, type };
  }
  return streaks;
}

function computeGameTotals(filteredRounds, rosterNames) {
  const totals = {};
  const seen = new Set();
  const gameOrder = [];
  for (const r of filteredRounds) {
    for (const entry of (r.breakdown || [])) {
      const game = cleanGameName(entry.game);
      if (!seen.has(game)) { seen.add(game); gameOrder.push(game); }
      if (!totals[game]) totals[game] = {};
      for (const row of (entry.rows || [])) {
        if (!rosterNames.has(row.name)) continue;
        totals[game][row.name] = (totals[game][row.name] || 0) + (row.net || 0);
      }
    }
  }
  return { gameTotals: totals, gameOrder: gameOrder.sort((a, b) => a.localeCompare(b)) };
}

function computeInsights(filteredRounds, streaks, playerNetInPeriod, moneyList) {
  let heater = null, heaterCount = 0;
  let coldest = null, coldCount = 0;
  for (const [name, s] of Object.entries(streaks)) {
    if (s.type === 'hot' && s.count > heaterCount) { heaterCount = s.count; heater = name; }
    if (s.type === 'cold' && s.count > coldCount) { coldCount = s.count; coldest = name; }
  }

  // Strongest Team: same-side pairs across ALL team-format rounds (Match teams, Sixes teams, etc.)
  // Uses r.matches for explicit team sides; also scan r.breakdown for Sixes/Dots team data
  const teamRec = {};

  for (const r of filteredRounds) {
    const pl = r.players || [];

    // Explicit match team sides
    for (const m of (r.matches || [])) {
      if (m.format !== 'team') continue;
      const sides = [m.teamA || [], m.teamB || []];
      for (const side of sides) {
        const names = side.map(i => pl[i]?.name).filter(Boolean);
        const sideNet = names.reduce((s, n) => s + (r.bank?.[n] || 0), 0);
        const won = sideNet > 0;
        for (let i = 0; i < names.length; i++) {
          for (let j = i + 1; j < names.length; j++) {
            const key = [names[i], names[j]].sort().join('|');
            if (!teamRec[key]) teamRec[key] = { names: [names[i], names[j]], wins: 0, losses: 0 };
            if (won) teamRec[key].wins++;
            else teamRec[key].losses++;
          }
        }
      }
    }

    // Sixes/Dots/other team games via breakdown rows — infer teams from same-sign net
    // Only use when no explicit match structure exists for this round
    if (!(r.matches || []).length) {
      for (const entry of (r.breakdown || [])) {
        const game = cleanGameName(entry.game);
        if (!['Sixes', 'Dots', 'Stableford', 'Nines'].includes(game)) continue;
        const rows = (entry.rows || []).filter(row => row.net !== 0);
        const winners = rows.filter(row => row.net > 0).map(row => row.name);
        const losers  = rows.filter(row => row.net < 0).map(row => row.name);
        for (const side of [winners, losers]) {
          const won = side === winners;
          for (let i = 0; i < side.length; i++) {
            for (let j = i + 1; j < side.length; j++) {
              const key = [side[i], side[j]].sort().join('|');
              if (!teamRec[key]) teamRec[key] = { names: [side[i], side[j]], wins: 0, losses: 0 };
              if (won) teamRec[key].wins++;
              else teamRec[key].losses++;
            }
          }
        }
      }
    }
  }

  let strongestTeam = null, strongestWins = 0;
  for (const rec of Object.values(teamRec)) {
    if (rec.wins > strongestWins) { strongestWins = rec.wins; strongestTeam = rec; }
  }

  // The Lock: player with highest win rate (net > 0) across filteredRounds, min 3 rounds
  let lockPlayer = null, lockWins = 0, lockRounds = 0;
  const playerRoundCount = {};
  const playerWinCount = {};
  for (const r of filteredRounds) {
    for (const [name, net] of Object.entries(r.bank || {})) {
      playerRoundCount[name] = (playerRoundCount[name] || 0) + 1;
      if (net > 0) playerWinCount[name] = (playerWinCount[name] || 0) + 1;
    }
  }
  let bestRate = 0;
  for (const [name, rounds] of Object.entries(playerRoundCount)) {
    if (rounds < 3) continue;
    const wins = playerWinCount[name] || 0;
    const rate = wins / rounds;
    if (rate > bestRate || (rate === bestRate && wins > lockWins)) {
      bestRate = rate;
      lockPlayer = name;
      lockWins = wins;
      lockRounds = rounds;
    }
  }

  return { heater, heaterCount, coldest, coldCount, strongestTeam, strongestWins, lockPlayer, lockWins, lockRounds };
}

// ── Icon circle wrapper for insights ─────────────────────────────────────────
function IconCircle({ children }) {
  return (
    <div style={{
      width: 44, height: 44, borderRadius: '50%',
      background: ICON_BG,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
    }}>
      {children}
    </div>
  );
}

// ── PodiumCard ────────────────────────────────────────────────────────────────
// H-46: no overflow:hidden anywhere in this tree
function PodiumCard({ name, total, rank, streak, playerRecord }) {
  const nameParts = (name || '').trim().split(/\s+/);
  const first = nameParts[0] || '';
  const last  = nameParts.slice(1).join(' ');
  const amtColor = total >= 0 ? G : '#A32D2D';
  const isFirst  = rank === 1;

  return (
    <div style={{
      flex: 1,
      minWidth: 0,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      background: '#fff',
      border: '1px solid #e5eee5',
      borderRadius: 14,
      padding: '0 8px 14px',
      boxShadow: '0 2px 8px rgba(0,0,0,.06)',
      position: 'relative',
      marginTop: isFirst ? 0 : 12, // 2nd/3rd sit lower
    }}>
      {/* Pennant hanging from top center */}
      <div style={{
        marginTop: -1,
        marginBottom: 8,
      }}>
        <PennantRibbon rank={rank} />
      </div>

      {/* Avatar — H-46 safe: no overflow:hidden ancestor */}
      <div style={{ marginBottom: 8 }}>
        <PlayerAvatar player={playerRecord} size={isFirst ? 52 : 44} starred={!!playerRecord?.starred} />
      </div>

      {/* Name stacked — truncate to keep equal widths */}
      <div style={{ fontWeight: 700, fontSize: isFirst ? 14 : 13, color: '#111', textAlign: 'center', lineHeight: 1.2, width: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{first}</div>
      {last && <div style={{ fontWeight: 600, fontSize: 11, color: '#555', textAlign: 'center', marginBottom: 6, lineHeight: 1.2, width: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{last}</div>}
      {!last && <div style={{ marginBottom: 6 }} />}

      {/* Amount */}
      <div style={{ fontWeight: 800, fontSize: isFirst ? 20 : 17, color: amtColor, textAlign: 'center' }}>
        {fmtDollar(total)}
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function HomePage({ onNewRound, onResume, inProgress }) {
  const rounds  = useMemo(() => roundLib.list(), []);
  const players = useMemo(() => ls.get(SK.players) || [], []);

  const [rangePref, setRangePrefRaw] = useState(() => loadRangePref(ML_KEY));
  const [pickerOpen, setPickerOpen]  = useState(false);
  const [showMatrix, setShowMatrix]  = useState(false);
  const [listExpanded, setListExpanded] = useState(false);
  const [viewMode, setViewMode]      = useState(() => ls.get(HOME_VIEW_KEY) || 'basic');

  const setRangePref = useCallback((pref) => {
    saveRangePref(pref, ML_KEY);
    setRangePrefRaw(pref);
    if (pref.range !== 'custom') setPickerOpen(false);
  }, []);

  const setView = useCallback((mode) => {
    ls.set(HOME_VIEW_KEY, mode);
    setViewMode(mode);
    setShowMatrix(false);
  }, []);

  // H-13: enrich from playerLib by name
  const playerByName = useMemo(() => {
    const map = {};
    players.forEach(p => { map[p.name] = p; });
    return map;
  }, [players]);

  const rosterNames = useMemo(() => {
    const s = new Set(); players.forEach(p => s.add(p.name)); return s;
  }, [players]);

  const excludedNames = useMemo(() => {
    const s = new Set();
    players.forEach(p => { if (p.inMoneyLists === false) s.add(p.name); });
    return s;
  }, [players]);

  // H-29: filter first
  const filteredRounds = useMemo(() =>
    filterByRange(rounds, rangePref), [rounds, rangePref]);

  const moneyList = useMemo(() => {
    const totals = {};
    filteredRounds.forEach(r => {
      Object.entries(r.bank || {}).forEach(([name, v]) => {
        if (!rosterNames.has(name) || excludedNames.has(name)) return;
        totals[name] = (totals[name] || 0) + v;
      });
    });
    return Object.entries(totals).sort((a, b) => b[1] - a[1]);
  }, [filteredRounds, rosterNames, excludedNames]);

  const activePlayerNames = useMemo(() =>
    Array.from(rosterNames).filter(n => !excludedNames.has(n)),
    [rosterNames, excludedNames]);

  const streaks = useMemo(() =>
    computeStreaks(filteredRounds, activePlayerNames),
    [filteredRounds, activePlayerNames]);

  const { gameTotals, gameOrder } = useMemo(() =>
    computeGameTotals(filteredRounds, rosterNames),
    [filteredRounds, rosterNames]);

  const playerNetInPeriod = useMemo(() => {
    const map = {};
    filteredRounds.forEach(r => {
      Object.entries(r.bank || {}).forEach(([name, v]) => { map[name] = (map[name] || 0) + v; });
    });
    return map;
  }, [filteredRounds]);

  const insights = useMemo(() =>
    computeInsights(filteredRounds, streaks, playerNetInPeriod, moneyList),
    [filteredRounds, streaks, playerNetInPeriod, moneyList]);

  // Stat tiles
  const statTiles = useMemo(() => {
    const thisYear = new Date().getFullYear();
    const ytdRounds = rounds.filter(r => new Date(r.date).getFullYear() === thisYear);
    const totalPlayers = players.length; // all players, not filtered
    const coursesPlayed = new Set(ytdRounds.map(r => r.course_name).filter(Boolean)).size;
    let wagered = 0;
    ytdRounds.forEach(r => { Object.values(r.bank || {}).forEach(v => { wagered += Math.abs(v); }); });
    wagered = Math.round(wagered / 2);
    const wageredStr = wagered >= 1000
      ? `$${(wagered / 1000).toFixed(1).replace(/\.0$/, '')}k`
      : `$${wagered}`;
    return [
      { icon: <IconRounds />,  value: String(ytdRounds.length), label: 'ROUNDS',  sub: 'This year' },
      { icon: <IconPeople />,  value: String(totalPlayers),     label: 'PLAYERS', sub: 'Total'     },
      { icon: <IconPin />,     value: String(coursesPlayed),    label: 'COURSES', sub: 'This year' },
      { icon: <IconWagered />, value: wageredStr,               label: 'WAGERED', sub: 'This year' },
    ];
  }, [rounds, players]);

  const top3  = moneyList.slice(0, 3);
  const rest  = moneyList.slice(3);
  const hasData = rounds.length > 0;

  // Podium display order: 2nd left, 1st center, 3rd right
  const podiumSlots = [
    top3[1] ? { name: top3[1][0], total: top3[1][1], rank: 2 } : null,
    top3[0] ? { name: top3[0][0], total: top3[0][1], rank: 1 } : null,
    top3[2] ? { name: top3[2][0], total: top3[2][1], rank: 3 } : null,
  ];

  // Insight tiles
  const insightTiles = useMemo(() => {
    const tiles = [];
    const { heater, heaterCount, coldest, coldCount, strongestTeam, strongestWins, lockPlayer, lockWins, lockRounds } = insights;
    if (heater && heaterCount >= 2) {
      tiles.push({ icon: <IconFireSvg />, title: 'HEATER', name: heater,
        stat: `${heaterCount} wins in a row` });
    }
    if (coldest && coldCount >= 2) {
      tiles.push({ icon: <IconSnowSvg />, title: 'COLD STREAK', name: coldest,
        stat: `${coldCount} losses in a row`, statColor: '#A32D2D' });
    }
    if (strongestTeam && strongestWins >= 2) {
      tiles.push({ icon: <IconTeamSvg />, title: 'DYNAMIC DUO',
        name: strongestTeam.names.join(' & '),
        stat: `${strongestWins} wins together` });
    }
    if (lockPlayer && lockRounds >= 3) {
      tiles.push({ icon: <IconLockSvg />, title: 'THE LOCK', name: lockPlayer,
        stat: `Won ${lockWins} of ${lockRounds}` });
    }
    return tiles;
  }, [insights, playerNetInPeriod]);

  return (
    <div style={{ minHeight: '100vh', background: '#eef4ee' }}>

      {/* ── Header ── */}
      <div style={{
        background: G, padding: '10px 16px',
        position: 'sticky', top: 0, zIndex: 10,
        boxShadow: '0 2px 12px rgba(0,0,0,.2)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <img src="/logo_icon.png" alt="The Card" style={{ height: 54, width: 'auto', display: 'block' }} />
        <div style={{ color: '#fff', fontWeight: 800, fontSize: 16, letterSpacing: '.14em', textTransform: 'uppercase', fontFamily: 'inherit' }}>
          The Card
        </div>
      </div>

      <div style={{ maxWidth: 520, margin: '0 auto', padding: '14px 14px' }}>

        {/* ── Resume banner ── */}
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

        {/* ── New Round ── */}
        <button onClick={onNewRound} style={{
          width: '100%', background: G, color: '#fff', border: 'none',
          borderRadius: 16, padding: '18px 20px', fontSize: 17, fontWeight: 800,
          cursor: 'pointer', display: 'flex', alignItems: 'center',
          justifyContent: 'center', gap: 8, marginBottom: 14,
          boxShadow: '0 6px 18px rgba(26,71,42,.28)', fontFamily: 'inherit',
        }}>
          <IconPlus /> New Round
        </button>

        {/* ── Stat tiles — 4 individual cards ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8, marginBottom: 14 }}>
          {statTiles.map(({ icon, value, label, sub }) => (
            <div key={label} style={{
              background: '#fff', borderRadius: 14,
              boxShadow: '0 1px 6px rgba(0,0,0,.07)',
              padding: '12px 6px',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
            }}>
              <div style={{
                width: 34, height: 34, borderRadius: '50%',
                background: ICON_BG,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {icon}
              </div>
              <div style={{ fontSize: 20, fontWeight: 800, color: G, lineHeight: 1, textAlign: 'center' }}>{value}</div>
              <div style={{ fontSize: 9, fontWeight: 700, color: '#888', textAlign: 'center', letterSpacing: '.04em' }}>{label}</div>
              <div style={{ fontSize: 9, color: '#bbb', textAlign: 'center', marginTop: -3 }}>{sub}</div>
            </div>
          ))}
        </div>

        {/* ── BASIC VIEW ── */}
        {viewMode === 'basic' && hasData && (
          <Card style={{ padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: pickerOpen ? 10 : 14 }}>
              <div style={{ fontWeight: 800, fontSize: 16, color: '#1f3f24', flex: 1 }}>Money List</div>
              <button onClick={() => setPickerOpen(o => !o)} style={{
                display: 'flex', alignItems: 'center', gap: 4,
                background: '#fff', border: '1.5px solid #ddd', color: '#444',
                borderRadius: 20, padding: '5px 10px',
                fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
              }}>
                {rangeLabel(rangePref)} <IconChevronDown />
              </button>
            </div>
            {pickerOpen && (
              <div style={{ marginBottom: 12, paddingBottom: 12, borderBottom: '1px solid #eee' }}>
                <RangePickerRow rangePref={rangePref} onRangePrefChange={setRangePref} />
              </div>
            )}
            {moneyList.length > 0 ? (
              <div style={{ background: '#fafdfa', border: '1px solid #e8efe8', borderRadius: 12 }}>
                {moneyList.map(([name, total], i) => {
                  const pr = playerByName[name] || { name };
                  return (
                    <div key={name} style={{
                      display: 'flex', alignItems: 'center', padding: '10px 14px',
                      borderBottom: i < moneyList.length - 1 ? '1px solid #edf3ed' : 'none',
                    }}>
                      <div style={{ width: 20, fontSize: 12, fontWeight: 700, color: '#aaa', flexShrink: 0 }}>{i + 1}</div>
                      <div style={{ marginRight: 8, flexShrink: 0 }}>
                        <PlayerAvatar player={pr} size={28} starred={false} />
                      </div>
                      <div style={{ flex: 1, fontSize: 14, fontWeight: 600, color: '#222' }}>{name}</div>
                      <div style={{ fontWeight: 800, color: total >= 0 ? G : '#A32D2D' }}>{fmtDollar(total)}</div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ fontSize: 12, color: '#aaa', textAlign: 'center', padding: '14px 0' }}>No rounds in this period</div>
            )}
          </Card>
        )}

        {/* ── ENHANCED VIEW ── */}
        {viewMode === 'enhanced' && hasData && (
          <>
            <Card style={{ padding: 16, marginBottom: 14, overflow: 'visible' }}>

              {/* Standings header row */}
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: pickerOpen ? 10 : 16 }}>
                <div style={{ fontWeight: 800, fontSize: 13, color: '#1f3f24', letterSpacing: '.06em', textTransform: 'uppercase' }}>Standings</div>
                <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
                  <button onClick={() => setPickerOpen(o => !o)} style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    background: 'transparent', border: '1px solid #ccc', color: '#555',
                    borderRadius: 20, padding: '4px 10px',
                    fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                  }}>
                    {rangeLabel(rangePref)} <IconChevronDown color="#555" />
                  </button>
                </div>
                <button onClick={() => { setShowMatrix(v => !v); setListExpanded(false); }} style={{
                  display: 'flex', alignItems: 'center', gap: 3,
                  background: 'transparent', border: 'none', color: G,
                  fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', padding: 0,
                }}>
                  {showMatrix ? (
                    <>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                        stroke={G} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="15 18 9 12 15 6"/>
                      </svg>
                      Standings
                    </>
                  ) : (
                    <>By Game <IconChevronRight /></>
                  )}
                </button>
              </div>

              {pickerOpen && (
                <div style={{ marginBottom: 14, paddingBottom: 12, borderBottom: '1px solid #eee' }}>
                  <RangePickerRow rangePref={rangePref} onRangePrefChange={setRangePref} />
                </div>
              )}

              {moneyList.length === 0 && (
                <div style={{ fontSize: 12, color: '#aaa', textAlign: 'center', padding: '14px 0' }}>No rounds in this period</div>
              )}

              {moneyList.length > 0 && !showMatrix && (
                <>
                  {/* Podium */}
                  <div style={{ display: 'flex', gap: 8, marginBottom: 14, alignItems: 'flex-start' }}>
                    {podiumSlots.map((slot, i) => slot ? (
                      <PodiumCard
                        key={slot.name}
                        name={slot.name}
                        total={slot.total}
                        rank={slot.rank}
                        streak={streaks[slot.name]}
                        playerRecord={playerByName[slot.name] || { name: slot.name }}
                      />
                    ) : (
                      <div key={i} style={{ flex: 1 }} />
                    ))}
                  </div>

                  {/* Ranked list 4+ */}
                  {rest.length > 0 && (
                    <>
                      <div style={{ background: '#fafdfa', border: '1px solid #e8efe8', borderRadius: 12 }}>
                        {(listExpanded ? rest : rest.slice(0, 3)).map(([name, total], i) => {
                          const pr = playerByName[name] || { name };
                          return (
                            <div key={name} style={{
                              display: 'flex', alignItems: 'center', padding: '10px 12px',
                              borderBottom: '1px solid #edf3ed',
                            }}>
                              <div style={{ width: 20, fontSize: 12, fontWeight: 700, color: '#aaa', flexShrink: 0 }}>{i + 4}</div>
                              <div style={{ marginRight: 8, flexShrink: 0 }}>
                                <PlayerAvatar player={pr} size={28} starred={false} />
                              </div>
                              <div style={{ flex: 1, fontSize: 13, fontWeight: 600, color: '#222' }}>{name}</div>
                              <div style={{ fontWeight: 800, fontSize: 13, color: total >= 0 ? G : '#A32D2D' }}>
                                {fmtDollar(total)}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      {rest.length > 3 && (
                        <button onClick={() => setListExpanded(e => !e)} style={{
                          width: '100%', background: 'none', border: 'none',
                          padding: '8px 0 0', cursor: 'pointer',
                          display: 'flex', justifyContent: 'center',
                        }}>
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                            stroke="#bbb" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                            style={{ transform: listExpanded ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}>
                            <polyline points="6 9 12 15 18 9"/>
                          </svg>
                        </button>
                      )}
                    </>
                  )}
                </>
              )}

              {/* ── Game breakdown matrix — full width, scrollable ── */}
              {moneyList.length > 0 && showMatrix && (
                <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', marginTop: 4 }}>
                  {gameOrder.length === 0 ? (
                    <div style={{ fontSize: 12, color: '#aaa', textAlign: 'center', padding: '20px 0' }}>No breakdown data</div>
                  ) : (
                    <table style={{ width: '100%', minWidth: gameOrder.length * 72 + 100, borderCollapse: 'collapse', fontSize: 12 }}>
                      <thead>
                        <tr style={{ borderBottom: '2px solid #eee' }}>
                          <th style={{ padding: '9px 10px 9px 4px', textAlign: 'left', fontWeight: 700, color: '#666', fontSize: 11, whiteSpace: 'nowrap', position: 'sticky', left: 0, background: '#fff', zIndex: 1 }}>Player</th>
                          {gameOrder.map(g => (
                            <th key={g} style={{ padding: '9px 8px', textAlign: 'center', fontWeight: 700, color: '#666', fontSize: 11, whiteSpace: 'nowrap', minWidth: 68 }}>{g}</th>
                          ))}
                          <th style={{ padding: '9px 8px', textAlign: 'center', fontWeight: 700, color: '#444', fontSize: 11, whiteSpace: 'nowrap' }}>Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {moneyList.map(([name, total], ri) => {
                          const pr = playerByName[name] || { name };
                          return (
                            <tr key={name} style={{ borderBottom: ri < moneyList.length - 1 ? '1px solid #f0f0f0' : 'none' }}>
                              <td style={{ padding: '9px 10px 9px 4px', whiteSpace: 'nowrap', position: 'sticky', left: 0, background: '#fff', zIndex: 1 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                  <PlayerAvatar player={pr} size={22} starred={false} />
                                  <span style={{ fontWeight: 700, fontSize: 11, color: '#222' }}>
                                    {(name || '').split(' ')[0]}
                                  </span>
                                </div>
                              </td>
                              {gameOrder.map(g => {
                                const val = gameTotals[g]?.[name] || 0;
                                return (
                                  <td key={g} style={{
                                    padding: '9px 8px', textAlign: 'center', minWidth: 68,
                                    color: val > 0 ? G : val < 0 ? '#A32D2D' : '#bbb',
                                    fontWeight: 700,
                                  }}>
                                    {val === 0 ? '—' : fmtDollar(val)}
                                  </td>
                                );
                              })}
                              <td style={{
                                padding: '9px 8px', textAlign: 'center', fontWeight: 800,
                                color: total >= 0 ? G : '#A32D2D',
                              }}>
                                {fmtDollar(total)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </Card>

            {/* ── Insights ── */}
            {insightTiles.length > 0 && (
              <Card style={{ padding: 16 }}>
                <div style={{ fontWeight: 800, fontSize: 13, color: '#1f3f24', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 14 }}>
                  Insights
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {insightTiles.map(({ icon, title, name, stat, statColor }) => (
                    <div key={title} style={{
                      background: '#fff', border: '1px solid #e8efe8', borderRadius: 14,
                      padding: 14, display: 'flex', gap: 10, alignItems: 'flex-start',
                    }}>
                      <IconCircle>{icon}</IconCircle>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 9, letterSpacing: '.08em', textTransform: 'uppercase', color: '#9aaa9a', fontWeight: 700, marginBottom: 2 }}>{title}</div>
                        <div style={{ fontWeight: 800, fontSize: 14, color: '#111', marginBottom: 2 }}>{name}</div>
                        <div style={{ fontSize: 11, color: statColor || '#666' }}>{stat}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </>
        )}

        {/* ── Empty state ── */}
        {rounds.length === 0 && players.length === 0 && (
          <div style={{ textAlign: 'center', padding: '48px 20px', color: '#aaa' }}>
            <img src="/logo_icon.png" alt="" style={{ height: 64, width: 'auto', marginBottom: 16, opacity: 0.5 }} />
            <div style={{ fontSize: 15, fontWeight: 700, color: '#888', marginBottom: 6 }}>Welcome to The Card</div>
            <div style={{ fontSize: 13 }}>Add players and courses, then start your first round.</div>
          </div>
        )}

        {/* ── View mode toggle — bottom of page, scroll to see ── */}
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 16, paddingBottom: 24 }}>
          <button
            onClick={() => setView(viewMode === 'basic' ? 'enhanced' : 'basic')}
            style={{
              border: 'none', background: 'none', cursor: 'pointer', padding: '4px 10px',
              color: '#bbb', fontSize: 11, fontWeight: 600, fontFamily: 'inherit',
            }}>
            {viewMode === 'basic' ? 'Enhanced' : 'Basic'}
          </button>
        </div>

      </div>
    </div>
  );
}
