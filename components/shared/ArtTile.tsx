import Image from "next/image";
import { artGradient } from "@/lib/utils/tile-art";
import { cn } from "@/lib/utils/cn";

export function ArtTile({
  artIndex,
  imageSrc,
  alt,
  className,
}: {
  artIndex: number;
  imageSrc?: string;
  alt: string;
  className?: string;
}) {
  if (imageSrc) {
    return (
      <div className={cn("absolute inset-0 bg-bg-raised", className)}>
        <div className="absolute inset-3 sm:inset-5">
          <Image src={imageSrc} alt={alt} fill className="object-contain" />
        </div>
      </div>
    );
  }
  return (
    <div
      className={cn("absolute inset-0", className)}
      style={{ background: artGradient(artIndex) }}
    />
  );
}
