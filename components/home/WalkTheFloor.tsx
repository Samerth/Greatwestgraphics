"use client";

import { motion } from "framer-motion";

const STATIONS = [
  {
    num: "01",
    title: "Ink Room",
    body: "Every colour is hand-mixed and Pantone-matched before it touches a screen.",
    gradient:
      "radial-gradient(60% 50% at 30% 45%, rgba(255,140,60,.55), transparent 65%), radial-gradient(80% 60% at 65% 60%, #d05a24, #6a2410 55%, #150703 100%)",
  },
  {
    num: "02",
    title: "Thread Floor",
    body: "Logos are digitized stitch-by-stitch, then hand-trimmed after every run.",
    gradient: "radial-gradient(60% 60% at 50% 40%, #2a3a5c, #0b1526 70%, #05080f 100%)",
  },
  {
    num: "03",
    title: "The Press",
    body: "Cured at exact temperature so prints survive a hundred washes, not ten.",
    gradient:
      "radial-gradient(50% 45% at 50% 55%, rgba(255,180,110,.35), transparent 65%), radial-gradient(80% 60% at 50% 60%, #2b241d, #100a06 70%, #050302 100%)",
  },
  {
    num: "04",
    title: "Pack & Ship",
    body: "Counted twice, folded once, packed locally — rush orders out in 48 hours.",
    gradient: "linear-gradient(180deg, #1a1a1e 0%, #0a0a0c 100%)",
  },
];

export function WalkTheFloor() {
  return (
    <section className="py-sp-8 bg-[#0D0D0D] text-white relative overflow-hidden">
      <div className="max-w-container mx-auto px-4 md:px-8 xl:px-24">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-sp-4 items-end mb-sp-6">
          <div>
            <div className="inline-flex items-center gap-2 font-bold text-xs tracking-[0.18em] uppercase text-accent mb-sp-2">
              <span className="w-1.5 h-1.5 rounded-full bg-accent" />
              Inside Our Print Shop
            </div>
            <h2 className="font-display font-bold text-header leading-header max-w-[14ch] text-white">
              Walk the floor <span className="text-accent">with us.</span>
            </h2>
          </div>
          <p className="max-w-[38ch] text-white/65 text-[14.5px]">
            No stock photos, no &quot;why choose us&quot; cards. This is where your order
            actually gets made — hover each station.
          </p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-sp-3">
          {STATIONS.map((s) => (
            <motion.article
              key={s.num}
              whileHover="hover"
              className="relative aspect-[3/4] rounded-lg overflow-hidden border border-white/10 cursor-pointer"
            >
              <motion.div
                className="absolute inset-0"
                style={{ background: s.gradient }}
                variants={{ hover: { scale: 1.06 } }}
                transition={{ duration: 0.9, ease: [0.16, 0.8, 0.3, 1] }}
              />
              <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_30%,rgba(0,0,0,.55)_70%,rgba(0,0,0,.95)_100%)]" />
              <motion.div
                className="absolute inset-0"
                variants={{ hover: { boxShadow: "inset 0 0 0 1px var(--color-accent)" } }}
              />
              <div className="absolute left-0 right-0 bottom-0 p-sp-4 z-[2]">
                <span className="block text-[11px] font-bold tracking-[0.18em] uppercase text-accent mb-1.5">
                  Station {s.num}
                </span>
                <h3 className="text-white text-[22px] font-display font-bold mb-1.5">
                  {s.title}
                </h3>
                <motion.p
                  className="text-white/82 text-[13.5px] leading-[1.55] overflow-hidden"
                  initial={{ height: 0, opacity: 0 }}
                  variants={{ hover: { height: "auto", opacity: 1 } }}
                  transition={{ duration: 0.4 }}
                >
                  {s.body}
                </motion.p>
              </div>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}
