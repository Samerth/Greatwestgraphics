import { Hero } from "@/components/home/Hero";
import { Container } from "@/components/shared/Container";
import { Reveal } from "@/components/shared/Reveal";
import { QuoteBuilder } from "@/components/quote-builder/QuoteBuilder";
import { WalkTheFloor } from "@/components/home/WalkTheFloor";
import { FabricWall } from "@/components/home/FabricWall";
import { BestsellerRoller } from "@/components/home/BestsellerRoller";
import {
  TrustStrip,
  Testimonials,
  Gallery,
  StatsBand,
  CtaBand,
} from "@/components/home/StaticSections";
import { ProductsGrid } from "@/components/products/ProductsGrid";
import Link from "next/link";

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
    href: "/products",
  },
  {
    num: "03",
    title: "I have my own design",
    body: "Upload artwork and go. We proof it, match your colours, and print it right the first time.",
    href: "/product/heavyweight-tee",
  },
];

export default function HomePage() {
  return (
    <>
      <Hero />

      <Container>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-sp-3 -mt-14 relative z-[5]">
          {QUICK_PATHS.map((p) => (
            <Link
              key={p.num}
              href={p.href}
              className="bg-bg-raised border border-border rounded-lg p-sp-4 shadow-card hover:shadow-card-hover hover:border-accent hover:-translate-y-0.5 transition-all"
            >
              <span className="inline-flex text-xs font-bold text-accent bg-accent-tint px-2.5 py-1 rounded-sm">
                {p.num}
              </span>
              <h3 className="mt-sp-3 mb-1.5 text-lg font-display font-bold">{p.title}</h3>
              <p className="text-sm text-text-secondary">{p.body}</p>
            </Link>
          ))}
        </div>
      </Container>

      <Reveal>
        <WalkTheFloor />
      </Reveal>

      <Reveal>
        <FabricWall />
      </Reveal>

      <TrustStrip />

      <Reveal>
        <BestsellerRoller />
      </Reveal>

      <Reveal>
        <section
          className="py-sp-8 relative"
          style={{
            background:
              "linear-gradient(180deg, #FFFFFF 0%, #FFF7F1 45%, #F5B48A 80%, #AA3300 100%)",
          }}
        >
          <Container>
            <div className="mb-sp-5">
              <div className="inline-flex items-center gap-2 font-bold text-xs tracking-[0.18em] uppercase text-accent mb-sp-2">
                <span className="w-1.5 h-1.5 rounded-full bg-accent" />
                The Product Universe
              </div>
              <h2 className="font-display font-bold text-header leading-header max-w-[24ch]">
                Crafting every <span className="text-accent">Print</span>, Stitch &amp;
                Press with precision.
              </h2>
              <p className="text-text-secondary max-w-[60ch] mt-sp-2">
                Real products, real methods, real starting prices. Filter by what you need.
              </p>
            </div>
            <ProductsGrid />
          </Container>
        </section>
      </Reveal>

      <Reveal>
        <Testimonials />
      </Reveal>

      <Reveal>
        <section className="py-sp-8">
          <Container>
            <QuoteBuilder />
          </Container>
        </section>
      </Reveal>

      <Reveal>
        <Gallery />
      </Reveal>

      <StatsBand />
      <CtaBand />
    </>
  );
}
