"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { Container } from "@/components/shared/Container";
import { publicQuoteOrFallback } from "@/lib/features";

/**
 * Figma "Idea to Delivery" (2107:317) — large atmospheric statement on a
 * monochromatic hive/pattern field.
 */
export function IdeaToDelivery() {
  const reduceMotion = useReducedMotion();

  return (
    <section className="relative overflow-hidden bg-[#0D0D0D] text-white py-[clamp(3.5rem,9vw,7rem)]">
      <div
        className="absolute inset-0 opacity-[0.22] pointer-events-none"
        aria-hidden
        style={{
          backgroundImage: `
            radial-gradient(circle at 20% 30%, var(--color-accent) 0%, transparent 42%),
            radial-gradient(circle at 80% 70%, rgba(255,255,255,0.18) 0%, transparent 36%),
            repeating-linear-gradient(
              60deg,
              transparent 0,
              transparent 14px,
              rgba(255,255,255,0.045) 14px,
              rgba(255,255,255,0.045) 15px
            ),
            repeating-linear-gradient(
              -60deg,
              transparent 0,
              transparent 14px,
              rgba(255,255,255,0.03) 14px,
              rgba(255,255,255,0.03) 15px
            )
          `,
        }}
      />
      <Container className="relative z-[1] text-center px-4">
        <motion.h2
          initial={reduceMotion ? false : { opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.7, ease: [0.16, 0.8, 0.3, 1] }}
          className="font-display font-bold text-[clamp(2rem,7vw,4.5rem)] leading-[1.08] m-0 tracking-tight text-balance"
        >
          Idea to <span className="text-accent">Delivery</span>
        </motion.h2>
      </Container>
    </section>
  );
}

const QUICK_PATHS = [
  {
    num: "01",
    title: "I need uniforms",
    body: "Kit out a team, crew or school. Bulk apparel, embroidered or printed, sized and sorted.",
    href: "/products",
  },
  {
    num: "02",
    title: "I need promo products",
    body: "Swag, giveaways and event gear. Pens to tote bags, branded and delivered on deadline.",
    // Pointed at "?category=promo", which is not a catalogue category — the
    // listing came back empty. We do not stock a promo line in the synced
    // catalogue, so sourcing these starts with a conversation.
    href: publicQuoteOrFallback("/contact"),
  },
  {
    num: "03",
    title: "I have my own design",
    body: "Upload artwork and go. We proof it, match your colours, and print it right the first time.",
    href: "/design",
  },
];

export function QuickPaths() {
  const reduceMotion = useReducedMotion();

  return (
    <section className="section-pad">
      <Container>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-sp-3">
          {QUICK_PATHS.map((path, index) => (
            <motion.div
              key={path.num}
              initial={reduceMotion ? false : { opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{
                duration: 0.45,
                delay: reduceMotion ? 0 : index * 0.08,
                ease: [0.16, 0.8, 0.3, 1],
              }}
            >
              <Link
                href={path.href}
                className="group block h-full bg-bg-raised border border-border rounded-md p-sp-4 hover:border-accent transition-colors"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="inline-flex min-w-[2rem] justify-center text-xs font-bold text-accent bg-accent-tint px-2.5 py-1 rounded-sm">
                    {path.num}
                  </span>
                  <span
                    className="text-text-tertiary group-hover:text-accent transition-colors shrink-0"
                    aria-hidden
                  >
                    →
                  </span>
                </div>
                <h3 className="mt-sp-3 mb-1.5 text-lg font-display font-bold m-0 text-text-primary">
                  {path.title}
                </h3>
                <p className="text-sm sm:text-base text-text-secondary m-0 leading-relaxed">
                  {path.body}
                </p>
              </Link>
            </motion.div>
          ))}
        </div>
      </Container>
    </section>
  );
}
