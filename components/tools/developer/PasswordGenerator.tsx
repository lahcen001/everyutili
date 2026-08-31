"use client";

import * as React from "react";
import { ShieldCheck, RefreshCw, Save } from "lucide-react";

import { CopyButton } from "@/components/tool-shell/CopyButton";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useTrackTool } from "@/hooks/useTrackTool";
import { saveToolResult } from "@/lib/storage/toolHistoryDb";
import { ToolHistoryList, type ToolHistoryListHandle } from "@/components/tools/shared/ToolHistoryList";

const UPPERCASE_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const LOWERCASE_CHARS = "abcdefghijklmnopqrstuvwxyz";
const NUMBER_CHARS = "0123456789";
const SYMBOL_CHARS = "!@#$%^&*()_+-=[]{}|;:,.<>?";

interface CharsetOptions {
  uppercase: boolean;
  lowercase: boolean;
  numbers: boolean;
  symbols: boolean;
}

function buildCharset(options: CharsetOptions): string {
  let charset = "";
  if (options.uppercase) charset += UPPERCASE_CHARS;
  if (options.lowercase) charset += LOWERCASE_CHARS;
  if (options.numbers) charset += NUMBER_CHARS;
  if (options.symbols) charset += SYMBOL_CHARS;
  return charset;
}

function generatePassword(length: number, options: CharsetOptions): string {
  const charset = buildCharset(options);
  if (!charset) return "";
  const randomValues = new Uint32Array(length);
  crypto.getRandomValues(randomValues);
  let password = "";
  for (let i = 0; i < length; i++) {
    password += charset[randomValues[i] % charset.length];
  }
  return password;
}

type Strength = "Weak" | "Fair" | "Strong" | "Very Strong";

function computeStrength(password: string, options: CharsetOptions): Strength {
  if (!password) return "Weak";
  const varietyCount = [options.uppercase, options.lowercase, options.numbers, options.symbols].filter(
    Boolean
  ).length;
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (password.length >= 16) score++;
  if (varietyCount >= 2) score++;
  if (varietyCount >= 3) score++;
  if (varietyCount >= 4) score++;

  if (score <= 2) return "Weak";
  if (score <= 3) return "Fair";
  if (score <= 5) return "Strong";
  return "Very Strong";
}

const STRENGTH_BADGE_VARIANT: Record<Strength, "outline" | "secondary" | "success" | "default"> = {
  Weak: "outline",
  Fair: "secondary",
  Strong: "success",
  "Very Strong": "success",
};

const DEFAULT_OPTIONS: CharsetOptions = {
  uppercase: true,
  lowercase: true,
  numbers: true,
  symbols: false,
};

export default function PasswordGenerator() {
  useTrackTool("password-generator");
  const [length, setLength] = React.useState(16);
  const [options, setOptions] = React.useState<CharsetOptions>(DEFAULT_OPTIONS);
  const [password, setPassword] = React.useState(() => generatePassword(16, DEFAULT_OPTIONS));
  const historyRef = React.useRef<ToolHistoryListHandle>(null);

  const strength = React.useMemo(() => computeStrength(password, options), [password, options]);

  const regenerate = React.useCallback(
    async (nextLength: number, nextOptions: CharsetOptions) => {
      const next = generatePassword(nextLength, nextOptions);
      setPassword(next);
      if (!next) return;
      await saveToolResult("password-generator", {
        title: `${nextLength}-character password`,
        summary: `${computeStrength(next, nextOptions)} strength`,
        data: next,
      });
      historyRef.current?.refresh();
    },
    []
  );

  const toggleOption = (key: keyof CharsetOptions) => {
    setOptions((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      const anyEnabled = next.uppercase || next.lowercase || next.numbers || next.symbols;
      return anyEnabled ? next : prev;
    });
  };

  const handleLengthChange = (value: number) => {
    setLength(Math.min(Math.max(value, 4), 128));
  };

  return (
    <div className="space-y-6">
      <Card className="space-y-4 p-4">
        <label className="block space-y-1.5">
          <span className="flex items-center justify-between text-sm font-medium">
            <span>Length</span>
            <span className="text-muted-foreground">{length}</span>
          </span>
          <input
            type="range"
            min={4}
            max={128}
            value={length}
            onChange={(e) => handleLengthChange(Number(e.target.value))}
            className="w-full accent-primary"
          />
        </label>

        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={options.uppercase}
              onChange={() => toggleOption("uppercase")}
              className="h-4 w-4 accent-primary"
            />
            Uppercase (A-Z)
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={options.lowercase}
              onChange={() => toggleOption("lowercase")}
              className="h-4 w-4 accent-primary"
            />
            Lowercase (a-z)
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={options.numbers}
              onChange={() => toggleOption("numbers")}
              className="h-4 w-4 accent-primary"
            />
            Numbers (0-9)
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={options.symbols}
              onChange={() => toggleOption("symbols")}
              className="h-4 w-4 accent-primary"
            />
            Symbols (!@#...)
          </label>
        </div>

        <Button onClick={() => regenerate(length, options)}>
          <RefreshCw className="h-4 w-4" /> Generate
        </Button>
      </Card>

      <Card className="space-y-3 p-4">
        <div className="flex items-center justify-between">
          <p className="flex items-center gap-2 text-sm font-medium">
            <ShieldCheck className="h-4 w-4 text-muted-foreground" /> Generated password
          </p>
          <Badge variant={STRENGTH_BADGE_VARIANT[strength]}>{strength}</Badge>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            readOnly
            value={password}
            className="flex-1 rounded-lg border border-border bg-muted/20 px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <CopyButton value={password} variant="outline" />
        </div>
        <Button size="sm" variant="outline" onClick={() => regenerate(length, options)} disabled={!password}>
          <Save className="h-3.5 w-3.5" /> Save result
        </Button>
      </Card>

      <ToolHistoryList ref={historyRef} toolSlug="password-generator" />
    </div>
  );
}
