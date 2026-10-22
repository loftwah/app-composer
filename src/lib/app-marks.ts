// Exact inner geometry of each app-owned optical mark, copied from
// .artwork/marks/authored/*.svg. These colours belong to the independent app
// identities and must not be replaced with Composer orange.
export const appMarks: Record<string, string> = {
  guestbook: `<rect width="64" height="64" rx="14" fill="#f4f0e8"/>
  <g transform="rotate(-10 32 32)">
    <rect x="13" y="15" width="38" height="34" rx="3" fill="#f4f0e8" stroke="#252923" stroke-width="4.5"/>
    <rect x="38" y="21" width="9" height="9" rx="1.5" fill="#d95022"/>
    <path d="M20 44h24" stroke="#252923" stroke-width="4" stroke-linecap="round"/>
  </g>`,
  showcase: `<rect width="64" height="64" rx="14" fill="#f4f0e8"/>
  <g transform="rotate(-45 32 32)" fill="none" stroke="#252923" stroke-width="11">
    <rect x="10" y="25.5" width="22" height="13" rx="6.5"/>
    <rect x="32" y="25.5" width="22" height="13" rx="6.5"/>
  </g>
  <g transform="rotate(-45 32 32)" fill="none" stroke="#a5fd0e" stroke-width="5">
    <rect x="10" y="25.5" width="22" height="13" rx="6.5"/>
    <rect x="32" y="25.5" width="22" height="13" rx="6.5"/>
  </g>`,
  linkcheck: `<rect width="64" height="64" rx="14" fill="#f4f0e8"/>
  <rect x="12" y="14" width="30" height="36" rx="3" fill="none" stroke="#252923" stroke-width="4.5"/>
  <path d="M19 42h13M19 48h8" stroke="#252923" stroke-width="4" stroke-linecap="round"/>
  <circle cx="37" cy="27" r="13" fill="#f4f0e8" stroke="#2f9fbd" stroke-width="6"/>
  <rect x="30" y="22" width="14" height="10" rx="1.5" fill="#ff9b55"/>
  <path d="M45.5 35.5 55 45" stroke="#2f9fbd" stroke-width="7" stroke-linecap="round"/>`,
  hello: `<rect width="64" height="64" rx="14" fill="#f4f0e8"/>
  <rect x="10" y="50" width="44" height="4.5" rx="2.25" fill="#252923"/>
  <path d="M6 39h34" stroke="#252923" stroke-width="4.5" stroke-linecap="round"/>
  <path d="M19 50V31a13 13 0 0 1 26 0v19z" fill="#ff9b55"/>
  <path d="M27 50V33a5 5 0 0 1 10 0v17z" fill="#f4f0e8"/>
  <path d="M53 39 41 33.5v11z" fill="#252923"/>`,
  state: `<rect width="64" height="64" rx="14" fill="#f4f0e8"/>
  <path d="M7 53h50" stroke="#8b5cf6" stroke-width="5.5" stroke-linecap="round"/>
  <rect x="11" y="23" width="26" height="20" rx="3.5" fill="#252923"/>
  <rect x="25" y="14" width="27" height="21" rx="3.5" fill="#ff9b55"/>`,
};
