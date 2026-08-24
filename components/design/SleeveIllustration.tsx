import { cn } from "@/lib/utils/cn";
import {
  DESIGN_SIDE_THUMB_LABELS,
  sleeveIllustrationModel,
  type StudioSleeveSide,
} from "@/lib/commerce/studio-sleeve";

export function SleeveIllustration({
  side,
  fillHex,
  animated = false,
  className,
  title,
}: {
  side: StudioSleeveSide;
  fillHex: string;
  animated?: boolean;
  className?: string;
  title?: string;
}) {
  const model = sleeveIllustrationModel({ side, fillHex });
  const label = title ?? DESIGN_SIDE_THUMB_LABELS[side];

  return (
    <svg
      viewBox="0 0 200 240"
      preserveAspectRatio="xMidYMid meet"
      className={cn(
        "h-full w-full max-h-full max-w-none overflow-visible",
        className,
      )}
      data-sleeve-side={model.side}
      data-sleeve-fill={model.fillHex}
      role="img"
      aria-label={label}
    >
      <title>{label}</title>
      <path
        data-sleeve-part="fill"
        d={model.garmentPath}
        fill={model.fillHex}
      />
      <path
        data-sleeve-part="shade"
        d={model.garmentPath}
        fill={model.shadeHex}
        opacity={0.22}
      />
      <path
        data-sleeve-part="sheen"
        className={animated ? "gwg-sleeve-sheen" : undefined}
        d={model.sheenPath}
        fill="#ffffff"
        opacity={0.14}
      />
      <path
        data-sleeve-part="collar"
        d={model.collarPath}
        fill={model.collarHex}
        stroke={model.outlineHex}
        strokeWidth={1.6}
        strokeLinejoin="round"
      />
      <path
        data-sleeve-part="outline"
        d={model.garmentPath}
        fill="none"
        stroke={model.outlineHex}
        strokeWidth={2.4}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <path
        d={model.seamPath}
        fill="none"
        stroke={model.outlineHex}
        strokeWidth={1.2}
        strokeLinecap="round"
        opacity={0.7}
      />
      <path
        d={model.cuffPath}
        fill="none"
        stroke={model.outlineHex}
        strokeWidth={1.4}
        strokeLinecap="round"
        opacity={0.8}
      />
      <path
        d={model.hemPath}
        fill="none"
        stroke={model.outlineHex}
        strokeWidth={1.3}
        strokeLinecap="round"
        opacity={0.75}
      />
      <path
        data-sleeve-part="notch"
        d={model.cuffNotchPath}
        fill={model.outlineHex}
        opacity={0.85}
      />
    </svg>
  );
}
