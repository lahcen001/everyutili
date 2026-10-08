"use client";

import { useTranslations } from "next-intl";
import * as React from "react";
import { Check, Copy } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";

interface CopyButtonProps extends Omit<ButtonProps, "onClick"> {
  value: string;
}

export function CopyButton({ value, children, ...props }: CopyButtonProps) {
  const t = useTranslations("ui");
  const [copied, setCopied] = React.useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Button onClick={handleCopy} {...props}>
      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      {children ?? (copied ? t("copied") : t("copy"))}
    </Button>
  );
}
