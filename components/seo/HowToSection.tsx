import { useTranslations } from "next-intl";

import type { HowToStep } from "@/config/tools";

export function HowToSection({ steps }: { steps: HowToStep[] }) {
  const t = useTranslations("sections");

  return (
    <section aria-labelledby="how-to-heading" className="mx-auto max-w-3xl px-4 py-12">
      <h2 id="how-to-heading" className="mb-8 text-2xl font-bold tracking-tight">
        {t("howToUse")}
      </h2>
      <ol className="space-y-6">
        {steps.map((step, index) => (
          <li key={step.name} className="flex gap-4">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
              {index + 1}
            </span>
            <div>
              <h3 className="font-semibold">{step.name}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{step.text}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
