import { Container } from "@/components/shared/Container";
import type { SizeSpecChart } from "@/lib/utils/size-specs";

export function ProductSizeSpecs({
  chart,
}: {
  chart: SizeSpecChart | null;
}) {
  if (!chart || chart.sizes.length === 0 || chart.specNames.length === 0) {
    return null;
  }

  return (
    <section
      id="size-chart"
      className="py-sp-8 border-t border-border scroll-mt-28"
    >
      <Container>
        <h2 className="font-display font-bold text-header m-0">
          Size chart / measurements
        </h2>
        <div className="mt-sp-4 overflow-x-auto border border-border rounded-md">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-border bg-bg-raised">
                <th className="text-left py-2 px-3 font-semibold text-text-primary">
                  Measurement
                </th>
                {chart.sizes.map((size) => (
                  <th
                    key={size}
                    className="text-left py-2 px-3 font-semibold text-text-primary"
                  >
                    {size}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {chart.specNames.map((name, index) => (
                <tr
                  key={name}
                  className={index % 2 === 0 ? "bg-bg" : "bg-bg-raised"}
                >
                  <td className="py-2 px-3 font-semibold text-text-primary">
                    {name}
                  </td>
                  {chart.sizes.map((size) => (
                    <td
                      key={size}
                      className="py-2 px-3 text-text-secondary whitespace-nowrap"
                    >
                      {chart.cells[name]?.[size] || "—"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Container>
    </section>
  );
}
