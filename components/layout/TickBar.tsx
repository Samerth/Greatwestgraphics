// Was `bg-accent` — the announcement bar is a surface, not a call to action,
// so it takes the navy band colour (the mockup's top bar) rather than the
// action blue that buttons and links use. Copy is unchanged from the UAT doc.
export function TickBar() {
  return (
    <div className="bg-band text-band-fg text-center text-[13px] font-bold py-2.5 px-sp-3 tracking-wide">
      Free Artwork Proofs · Fast Turnaround · Canada-Wide Shipping · Vancouver Pickup
    </div>
  );
}
