import Image from "next/image";
import Link from "next/link";

export function BackToSite({
  href = "/",
  showLogo = false,
  label = "Back to site",
}: {
  href?: string;
  showLogo?: boolean;
  label?: string;
}) {
  return (
    <div className="flex items-center gap-3 mb-sp-5">
      {showLogo ? (
        <Link href={href} className="shrink-0">
          <Image
            src="/images/logo-mark.png"
            alt="Great West Graphics"
            width={366}
            height={209}
            priority
            className="h-10 w-auto"
          />
        </Link>
      ) : null}
      <Link
        href={href}
        className="text-sm font-bold text-text-secondary hover:text-accent"
      >
        ← {label}
      </Link>
    </div>
  );
}
