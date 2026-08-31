import { useTranslations } from "next-intl";

import type { FaqItem } from "@/config/tools";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export function FaqSection({ items }: { items: FaqItem[] }) {
  const t = useTranslations("sections");

  return (
    <section aria-labelledby="faq-heading" className="mx-auto max-w-3xl px-4 py-12">
      <h2 id="faq-heading" className="mb-6 text-2xl font-bold tracking-tight">
        {t("faq")}
      </h2>
      <Accordion type="single" collapsible className="w-full">
        {items.map((item, index) => (
          <AccordionItem key={index} value={`item-${index}`}>
            <AccordionTrigger>{item.question}</AccordionTrigger>
            <AccordionContent>{item.answer}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  );
}
