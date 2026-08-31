import { useTranslations } from "next-intl";

import type { ComparisonTableData } from "@/config/tools";

export function ComparisonTable({ data }: { data: ComparisonTableData }) {
  const t = useTranslations("sections");

  return (
    <section aria-labelledby="comparison-heading" className="mx-auto max-w-3xl px-4 py-12">
      <h2 id="comparison-heading" className="mb-6 text-2xl font-bold tracking-tight">
        {t("scorecard")}
      </h2>
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-start text-sm">
          <thead className="bg-muted/50">
            <tr>
              {data.columns.map((col) => (
                <th key={col} className="px-4 py-3 text-start font-semibold">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row) => (
              <tr key={row.label} className="border-t border-border transition-colors hover:bg-muted/40">
                <td className="px-4 py-3 font-medium">{row.label}</td>
                {row.values.map((value, i) => (
                  <td key={i} className="px-4 py-3 text-muted-foreground">
                    {value}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
