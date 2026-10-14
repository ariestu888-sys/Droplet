type DropletLogoProps = {
  size?: number;
  showWordmark?: boolean;
  className?: string;
};

export function DropletLogo({
  size = 28,
  showWordmark = true,
  className = "",
}: DropletLogoProps) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <span className="dr-logo-mark">
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden={showWordmark}
          role={showWordmark ? undefined : "img"}
          aria-label={showWordmark ? undefined : "Droplet"}
        >
          <path
            d="M12 2.5C12 2.5 4.5 12.2 4.5 17A7.5 7.5 0 0012 24.5 7.5 7.5 0 0019.5 17C19.5 12.2 12 2.5 12 2.5Z"
            fill="var(--color-droplet)"
          />
          <circle cx="10.1" cy="16.4" r="0.95" fill="#fff" />
          <circle cx="13.9" cy="16.4" r="0.95" fill="#fff" />
          <path
            d="M9.9 18.6c.7.8 1.5 1.1 2.1 1.1s1.4-.3 2.1-1.1"
            stroke="#fff"
            strokeWidth="1.15"
            strokeLinecap="round"
          />
        </svg>
      </span>
      {showWordmark && (
        <span className="font-display text-[19px] font-bold">Droplet</span>
      )}
    </span>
  );
}
