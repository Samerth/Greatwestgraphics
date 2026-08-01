import { Container } from "@/components/shared/Container";

export default function Loading() {
  return (
    <section className="py-sp-8">
      <Container>
        <div className="h-4 w-40 rounded bg-fill-subtle-15 animate-pulse mb-sp-3" />
        <div className="h-10 w-3/4 max-w-[420px] rounded bg-fill-subtle-15 animate-pulse mb-sp-3" />
        <div className="h-4 w-2/3 max-w-[560px] rounded bg-fill-subtle-15 animate-pulse mb-sp-6" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-sp-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-40 rounded-lg bg-fill-subtle-15 animate-pulse" />
          ))}
        </div>
      </Container>
    </section>
  );
}
