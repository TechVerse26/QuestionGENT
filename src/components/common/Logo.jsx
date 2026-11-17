export default function Logo({ className = '', light = false }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <svg viewBox="0 0 64 64" className="h-7 w-7" aria-hidden="true">
        <rect width="64" height="64" rx="10" fill="#0B6E4F" />
        <rect x="16" y="10" width="32" height="44" fill="#fff" />
        <rect x="21" y="17" width="22" height="3" fill="#0B6E4F" />
        <rect x="21" y="25" width="22" height="2" fill="#9AA9A1" />
        <rect x="21" y="31" width="22" height="2" fill="#9AA9A1" />
        <rect x="21" y="37" width="14" height="2" fill="#9AA9A1" />
        <path d="M36 44l4 4 8-9" stroke="#C02B26" strokeWidth="3.5" fill="none" />
      </svg>
      <span className={`text-[15px] font-bold tracking-wide ${light ? 'text-side-ink' : 'text-ink'}`}>EXAM MASTER</span>
    </span>
  );
}
