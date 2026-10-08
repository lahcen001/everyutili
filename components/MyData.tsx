"use client";

import * as React from "react";
import { DatabaseBackup, Download, ShieldCheck, Trash2, Upload } from "lucide-react";
import { useTranslations } from "next-intl";

import { AppSettings } from "@/components/pwa/AppSettings";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { downloadBlob } from "@/lib/downloadBlob";
import { APP_DATABASES, buildBackup, collect, formatSize, isAppKey, parseBackup, summarize, type DataEntry, type DataGroup } from "@/lib/myData";

const GROUPS: DataGroup[] = ["tasks", "habits", "flashcards", "exams", "focus", "games", "qr", "calc", "random", "tools", "other"];

/** Back up, restore or erase everything the tools remember in this browser. */
export function MyData() {
  const t = useTranslations("myData");
  const [entries, setEntries] = React.useState<DataEntry[] | null>(null);
  const [message, setMessage] = React.useState<{ text: string; ok: boolean } | null>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);

  const refresh = React.useCallback(() => {
    try {
      setEntries(collect(window.localStorage));
    } catch {
      setEntries([]);
    }
  }, []);
  React.useEffect(() => {
    // read after mount: localStorage doesn't exist on the server
    const id = window.setTimeout(refresh, 0);
    return () => window.clearTimeout(id);
  }, [refresh]);

  const summary = React.useMemo(() => summarize(entries ?? []), [entries]);
  const total = (entries ?? []).reduce((n, e) => n + e.bytes, 0);

  const exportBackup = () => {
    const backup = buildBackup(entries ?? []);
    downloadBlob(new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" }), `everyutili-backup-${backup.exportedAt.slice(0, 10)}.json`);
  };

  const importBackup = async (file: File | undefined) => {
    if (!file) return;
    const data = parseBackup(await file.text());
    if (!data) {
      setMessage({ text: t("importError"), ok: false });
      return;
    }
    let count = 0;
    for (const [k, v] of Object.entries(data)) {
      try {
        window.localStorage.setItem(k, v);
        count += 1;
      } catch {
        /* storage full */
      }
    }
    setMessage({ text: t("imported", { count }), ok: true });
    refresh();
  };

  const eraseAll = async () => {
    if (!window.confirm(t("confirmClear"))) return;
    for (const e of collect(window.localStorage)) window.localStorage.removeItem(e.key);
    for (let i = window.localStorage.length - 1; i >= 0; i--) {
      const k = window.localStorage.key(i);
      if (k && isAppKey(k)) window.localStorage.removeItem(k);
    }
    await Promise.all(APP_DATABASES.map((name) => new Promise<void>((resolve) => { const r = indexedDB.deleteDatabase(name); r.onsuccess = r.onerror = r.onblocked = () => resolve(); })));
    setMessage({ text: t("cleared"), ok: true });
    refresh();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary"><DatabaseBackup className="h-7 w-7" /></span>
        <h1 className="text-3xl font-extrabold tracking-tight">{t("title")}</h1>
        <p className="max-w-lg text-balance text-muted-foreground">{t("subtitle")}</p>
      </div>

      <AppSettings />

      <Card className="space-y-4 p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">{t("heading")}</h2>
          {entries && entries.length > 0 && <span className="text-sm text-muted-foreground">{t("total", { size: formatSize(total) })}</span>}
        </div>
        {entries === null ? null : entries.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{t("empty")}</p>
        ) : (
          <ul className="divide-y divide-border">
            {GROUPS.map((g) => summary.find((s) => s.group === g)).filter((s): s is NonNullable<typeof s> => !!s).map((s) => (
              <li key={s.group} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <span className="font-medium">{t(`group_${s.group}`)}</span>
                <span className="shrink-0 text-muted-foreground">{t("items", { count: s.items })} · {formatSize(s.bytes)}</span>
              </li>
            ))}
          </ul>
        )}
        {message && <p role="status" className={message.ok ? "text-sm text-primary" : "text-sm text-destructive"}>{message.text}</p>}
        <div className="flex flex-wrap gap-2">
          <Button onClick={exportBackup} disabled={!entries || entries.length === 0}><Download className="h-4 w-4" /> {t("export")}</Button>
          <Button variant="outline" onClick={() => fileRef.current?.click()}><Upload className="h-4 w-4" /> {t("import")}</Button>
          <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => { void importBackup(e.target.files?.[0]); e.target.value = ""; }} />
          <Button variant="ghost" className="ms-auto text-destructive hover:bg-destructive/10" onClick={() => void eraseAll()}><Trash2 className="h-4 w-4" /> {t("clearAll")}</Button>
        </div>
        <p className="text-xs text-muted-foreground">{t("historyNote")}</p>
      </Card>

      <p className="flex items-center justify-center gap-2 text-center text-xs text-muted-foreground"><ShieldCheck className="h-4 w-4 text-primary" /> {t("privacy")}</p>
    </div>
  );
}
