import { Container } from "@/components/shared/Container";

export default function Loading() {
  return (
    <>
      <section className="pt-sp-8">
        <Container>
          <div className="h-4 w-48 rounded bg-fill-subtle-15 animate-pulse mb-sp-3" />
          <div className="h-10 w-3/4 max-w-[420px] rounded bg-fill-subtle-15 animate-pulse mb-sp-3" />
          <div className="h-4 w-2/3 max-w-[560px] rounded bg-fill-subtle-15 animate-pulse" />
        </Container>
      </section>
      <section className="py-sp-8">
        <Container>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-sp-5 items-start">
            <div className="bg-bg-raised border border-border rounded-lg p-sp-5 space-y-sp-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-9 rounded bg-fill-subtle-15 animate-pulse" />
              ))}
              <div className="flex flex-wrap gap-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-10 w-24 rounded-sm bg-fill-subtle-15 animate-pulse" />
                ))}
              </div>
            </div>
            <div className="h-[380px] rounded-lg bg-fill-subtle-15 animate-pulse" />
          </div>
        </Container>
      </section>
    </>
  );
}
