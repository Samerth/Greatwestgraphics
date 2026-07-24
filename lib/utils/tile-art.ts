// Ported 1:1 from .art-1 .. .art-12 in styles.css. These are placeholder
// visuals for tiles that don't have a real product photo yet — swap to
// next/image with a real src once the SanMar catalog is synced.
export const ART_GRADIENTS: string[] = [
  "radial-gradient(85% 65% at 30% 30%, #f0e9d6, #c8bfa4 45%, #4a4130 100%)",
  "radial-gradient(90% 65% at 65% 30%, var(--color-accent), #3a2416 65%, #160a05 100%)",
  "radial-gradient(80% 70% at 50% 40%, #6a6a68, #2f2f2d 60%, #050505 100%)",
  "radial-gradient(75% 65% at 40% 30%, #e4d6b0, #a88a55 55%, #3a2a14 100%)",
  "radial-gradient(75% 65% at 60% 40%, #f6c27a, var(--color-accent) 60%, #180a04 100%)",
  "radial-gradient(75% 65% at 40% 30%, #d7d1c2, #6d6857 55%, #1b1912 100%)",
  "radial-gradient(75% 65% at 60% 40%, #7b8a95, #33454f 55%, #04141a 100%)",
  "radial-gradient(75% 65% at 40% 30%, #e6c48f, #8b5a2b 55%, #1a0f06 100%)",
  "radial-gradient(75% 65% at 50% 50%, #c9c1a6, #4a4a3a 55%, #141410 100%)",
  "radial-gradient(75% 65% at 50% 40%, #97a4b5, #2c3a4e 55%, #070c18 100%)",
  "radial-gradient(75% 65% at 40% 40%, #ffcf9a, #b0651a 55%, #180a03 100%)",
  "radial-gradient(75% 65% at 60% 30%, #e9d3b6, #8f6a3d 55%, #1a0f07 100%)",
];

export function artGradient(index: number) {
  return ART_GRADIENTS[(index - 1) % ART_GRADIENTS.length];
}
