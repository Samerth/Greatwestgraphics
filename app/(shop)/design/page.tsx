import { Container } from "@/components/shared/Container";
import { DesignStudio } from "@/components/design/DesignStudio";
import { CrossSellGrid } from "@/components/shared/CrossSellGrid";

export default function DesignPage() {
  return (
    <>
      <section className="bg-text-primary text-white pt-sp-7 pb-sp-6 relative overflow-hidden">
        <Container className="relative">
          <div className="inline-flex items-center gap-2 font-bold text-xs tracking-[0.18em] uppercase text-accent mb-sp-3">
            <span className="w-1.5 h-1.5 rounded-full bg-accent" />
            The Design Studio
          </div>
          <h1 className="font-display font-bold text-display leading-display max-w-[14ch] text-white">
            Design it live. <span className="text-accent">Watch the mockup update</span> as
            you go.
          </h1>
          <p className="mt-sp-3 max-w-[52ch] text-white/75 text-[16px] leading-[1.6]">
            Upload a logo, generate art with AI, drop it on the garment. The live mockup
            updates the second you move a pixel — same file we send to press.
          </p>
        </Container>
      </section>

      <section className="py-sp-7">
        <Container>
          <div className="text-[13px] text-text-tertiary mb-sp-4">
            Home / <b className="text-text-primary">Design Studio</b>
          </div>
          <DesignStudio />
        </Container>
      </section>

      <section className="py-sp-8">
        <Container>
          <CrossSellGrid title="Pair it with these Products!" />
        </Container>
      </section>
    </>
  );
}
