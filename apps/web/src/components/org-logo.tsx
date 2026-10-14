// An organization's logo, or its first letter when it has none.
export function OrgLogo({
  name,
  logoUrl,
  size = 48,
  className = "",
}: {
  name: string;
  logoUrl: string | null;
  size?: number;
  className?: string;
}) {
  const style = { width: size, height: size, fontSize: Math.round(size * 0.42) };

  if (logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- logos come from Supabase Storage
      <img src={logoUrl} alt="" style={style} className={`shrink-0 rounded-field object-cover ${className}`} />
    );
  }

  return (
    <div
      aria-hidden
      style={style}
      className={`flex shrink-0 items-center justify-center rounded-field bg-droplet-tint font-display font-bold text-droplet ${className}`}
    >
      {name[0]?.toUpperCase()}
    </div>
  );
}
