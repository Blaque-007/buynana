const paths = {
 dashboard: <><rect x="3" y="3" width="8" height="8" rx="1.5"/><rect x="13" y="3" width="8" height="5" rx="1.5"/><rect x="13" y="10" width="8" height="11" rx="1.5"/><rect x="3" y="13" width="8" height="8" rx="1.5"/></>,
 budgets: <><rect x="3" y="5" width="18" height="15" rx="2"/><path d="M3 10h18M7 15h4"/></>,
 forecast: <><path d="M3 20V4M3 20h18M7 16l4-5 3 2 6-8"/></>,
 history: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
 settings: <><circle cx="12" cy="12" r="3"/><path d="M12 2v3m0 14v3M2 12h3m14 0h3M4.9 4.9 7 7m10 10 2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1"/></>
};
export default function NavIcon({name}) {return <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{paths[name]||paths.dashboard}</svg>}
