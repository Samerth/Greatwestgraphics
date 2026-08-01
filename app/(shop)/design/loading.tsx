import { Container } from "@/components/shared/Container";

export default function Loading() {
  return (
    <>
      <section className="bg-text-primary pt-sp-7 pb-sp-6">
        <Container>
          <div className="h-4 w-40 rounded bg-white/10 animate-pulse mb-sp-3" />
          <div className="h-10 w-3/4 max-w-[420px] rounded bg-white/10 animate-pulse mb-sp-3" />
          <div className="h-4 w-2/3 max-w-[520px] rounded bg-white/10 animate-pulse" />
        </Container>
      </section>
      <section className="py-sp-7">
        <Container>
          <div className="grid grid-cols-1 lg:grid-cols-[220px_1.4fr_1fr] gap-sp-3">
            <div className="h-[420px] rounded-lg bg-fill-subtle-15 animate-pulse" />
            <div className="h-[420px] rounded-lg bg-fill-subtle-15 animate-pulse" />
            <div className="h-[420px] rounded-lg bg-fill-subtle-15 animate-pulse" />
          </div>
        </Container>
      </section>
    </>
  );
}
