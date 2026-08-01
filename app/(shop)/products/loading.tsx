import { Container } from "@/components/shared/Container";

export default function Loading() {
  return (
    <section className="py-sp-8">
      <Container>
        <div className="h-4 w-40 rounded bg-fill-subtle-15 animate-pulse mb-sp-3" />
        <div className="h-10 w-3/4 max-w-[420px] rounded bg-fill-subtle-15 animate-pulse mb-sp-3" />
        <div className="h-4 w-2/3 max-w-[560px] rounded bg-fill-subtle-15 animate-pulse mb-sp-6" />

        <div className="flex flex-wrap gap-2 mb-sp-5">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="h-9 w-24 rounded-full bg-fill-subtle-15 animate-pulse"
            />
          ))}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-sp-3">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="aspect-square rounded-lg bg-fill-subtle-15 animate-pulse" />
          ))}
        </div>
      </Container>
    </section>
  );
}
