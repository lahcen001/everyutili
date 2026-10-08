"use client";

import * as React from "react";
import { ArrowLeft, Check, Download, Layers, Pencil, Plus, RotateCcw, Shuffle, Trash2, Trophy, Upload, X } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTrackTool } from "@/hooks/useTrackTool";
import { downloadBlob } from "@/lib/downloadBlob";
import { usePersisted } from "@/components/tools/focus-study/usePersisted";
import { FullscreenStage } from "@/components/tools/focus-study/FullscreenStage";
import { MAX_BOX, boxCounts, cardsToText, dueQueue, isDue, newCard, parseCards, review, type Card as FlashCard } from "@/lib/focus/leitner";

interface Deck {
  id: string;
  name: string;
  cards: FlashCard[];
}
interface Store {
  decks: Deck[];
}

const uid = () => (typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);
const SAMPLE = "Capital of France\tParis\nH₂O is the formula for\tWater\nLargest planet\tJupiter\n7 × 8\t56";

type View = { mode: "library" } | { mode: "edit"; deckId: string } | { mode: "study"; deckId: string; queue: string[]; all: boolean };

export default function Flashcards() {
  useTrackTool("flashcards");
  const [store, setStore] = usePersisted<Store>("everyutili_flashcards", { decks: [] });
  const [view, setView] = React.useState<View>({ mode: "library" });
  const [newName, setNewName] = React.useState("");
  const [importText, setImportText] = React.useState("");
  const [showImport, setShowImport] = React.useState(false);

  const deck = view.mode !== "library" ? store.decks.find((d) => d.id === view.deckId) : undefined;
  const updateDeck = (id: string, fn: (d: Deck) => Deck) => setStore((s) => ({ decks: s.decks.map((d) => (d.id === id ? fn(d) : d)) }));

  const addDeck = (name: string, cards: { front: string; back: string }[] = []) => {
    const id = uid();
    setStore((s) => ({ decks: [...s.decks, { id, name: name.trim() || "Untitled deck", cards: cards.map((c) => newCard(uid(), c.front, c.back)) }] }));
    return id;
  };

  const startStudy = (d: Deck, all: boolean, shuffle = false) => {
    let ids = (all ? d.cards.slice().sort((a, b) => a.box - b.box) : dueQueue(d.cards)).map((c) => c.id);
    if (shuffle) ids = ids.sort(() => Math.random() - 0.5);
    setView({ mode: "study", deckId: d.id, queue: ids, all });
  };

  // ---------------- study ----------------
  if (view.mode === "study" && deck) {
    return <Study deck={deck} queue={view.queue} onExit={() => setView({ mode: "library" })} onGrade={(id, ok) => updateDeck(deck.id, (d) => ({ ...d, cards: d.cards.map((c) => (c.id === id ? review(c, ok) : c)) }))} onRestart={() => startStudy(deck, view.all)} />;
  }

  // ---------------- edit ----------------
  if (view.mode === "edit" && deck) {
    return (
      <Editor
        deck={deck}
        onBack={() => setView({ mode: "library" })}
        onRename={(name) => updateDeck(deck.id, (d) => ({ ...d, name }))}
        onAdd={(front, back) => updateDeck(deck.id, (d) => ({ ...d, cards: [...d.cards, newCard(uid(), front, back)] }))}
        onEdit={(id, front, back) => updateDeck(deck.id, (d) => ({ ...d, cards: d.cards.map((c) => (c.id === id ? { ...c, front, back } : c)) }))}
        onDelete={(id) => updateDeck(deck.id, (d) => ({ ...d, cards: d.cards.filter((c) => c.id !== id) }))}
        onImport={(text) => {
          const parsed = parseCards(text);
          updateDeck(deck.id, (d) => ({ ...d, cards: [...d.cards, ...parsed.map((c) => newCard(uid(), c.front, c.back))] }));
          return parsed.length;
        }}
      />
    );
  }

  // ---------------- library ----------------
  return (
    <div className="space-y-5">
      <Card className="space-y-3 p-4">
        <div className="flex flex-wrap gap-2">
          <input value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && newName.trim()) { setView({ mode: "edit", deckId: addDeck(newName) }); setNewName(""); } }} placeholder="New deck name, e.g. Spanish verbs" className="h-10 min-w-48 flex-1 rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
          <Button onClick={() => { setView({ mode: "edit", deckId: addDeck(newName) }); setNewName(""); }}>
            <Plus className="h-4 w-4" /> Create deck
          </Button>
          <Button variant="outline" onClick={() => setShowImport((v) => !v)}>
            <Upload className="h-4 w-4" /> Import cards
          </Button>
        </div>
        {showImport && (
          <div className="space-y-2">
            <textarea value={importText} onChange={(e) => setImportText(e.target.value)} rows={6} placeholder={"One card per line: question, answer\n(separate with a tab, comma, semicolon or ' - ')"} className="w-full resize-y rounded-lg border border-border bg-background p-3 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
            <div className="flex flex-wrap items-center gap-2">
              <Button disabled={parseCards(importText).length === 0} onClick={() => { const cards = parseCards(importText); setView({ mode: "edit", deckId: addDeck(newName || "Imported deck", cards) }); setImportText(""); setShowImport(false); setNewName(""); }}>
                Make a deck from {parseCards(importText).length} cards
              </Button>
              <button className="text-xs text-muted-foreground underline" onClick={() => setImportText(SAMPLE)}>
                Try an example
              </button>
            </div>
          </div>
        )}
      </Card>

      {store.decks.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-muted/20 px-6 py-16 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Layers className="h-8 w-8" />
          </span>
          <p className="text-lg font-semibold">No decks yet</p>
          <p className="max-w-md text-sm text-muted-foreground">Create a deck above or paste a list of questions and answers. Cards you miss come back sooner; cards you know come back later.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {store.decks.map((d) => {
            const due = d.cards.filter((c) => isDue(c)).length;
            const counts = boxCounts(d.cards);
            const mastered = counts[MAX_BOX];
            return (
              <Card key={d.id} className="flex flex-col gap-3 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="truncate text-lg font-bold">{d.name}</h3>
                    <p className="text-xs text-muted-foreground">
                      {d.cards.length} card{d.cards.length === 1 ? "" : "s"} · {mastered} mastered
                    </p>
                  </div>
                  <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-xs font-bold", due > 0 ? "bg-rose-500/10 text-rose-600" : "bg-emerald-500/10 text-emerald-600")}>{due > 0 ? `${due} due` : "All done"}</span>
                </div>
                <div className="flex h-2 overflow-hidden rounded-full bg-muted" aria-label="Progress by box">
                  {counts.slice(1).map((n, i) => (
                    <span key={i} className="h-full" style={{ width: `${d.cards.length ? (n / d.cards.length) * 100 : 0}%`, backgroundColor: ["#f43f5e", "#f59e0b", "#eab308", "#84cc16", "#10b981"][i] }} />
                  ))}
                </div>
                <div className="mt-auto flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => startStudy(d, false)} disabled={due === 0}>
                    Study {due > 0 ? `(${due})` : ""}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => startStudy(d, true, true)} disabled={d.cards.length === 0}>
                    <Shuffle className="h-3.5 w-3.5" /> All
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setView({ mode: "edit", deckId: d.id })}>
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </Button>
                  <Button size="sm" variant="ghost" aria-label={`Delete ${d.name}`} onClick={() => { if (window.confirm(`Delete “${d.name}” and its ${d.cards.length} cards?`)) setStore((s) => ({ decks: s.decks.filter((x) => x.id !== d.id) })); }}>
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
      <p className="text-xs text-muted-foreground">Decks are saved only in this browser. Use Edit → Export to back them up or move them to another device.</p>
    </div>
  );
}

function Study({ deck, queue, onExit, onGrade, onRestart }: { deck: Deck; queue: string[]; onExit: () => void; onGrade: (id: string, ok: boolean) => void; onRestart: () => void }) {
  const [index, setIndex] = React.useState(0);
  const [flipped, setFlipped] = React.useState(false);
  const [right, setRight] = React.useState(0);
  const byId = React.useMemo(() => new Map(deck.cards.map((c) => [c.id, c])), [deck.cards]);
  const [snapshot] = React.useState(() => new Map(deck.cards.map((c) => [c.id, c])));
  const card = snapshot.get(queue[index]) ?? byId.get(queue[index]);
  const done = index >= queue.length;

  const grade = React.useCallback(
    (ok: boolean) => {
      if (!card) return;
      onGrade(card.id, ok);
      if (ok) setRight((r) => r + 1);
      setFlipped(false);
      setIndex((i) => i + 1);
    },
    [card, onGrade]
  );

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (done) return;
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        setFlipped((f) => !f);
      } else if (flipped && (e.key === "1" || e.key === "ArrowLeft")) grade(false);
      else if (flipped && (e.key === "2" || e.key === "ArrowRight")) grade(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [done, flipped, grade]);

  return (
    <FullscreenStage className="rounded-2xl border border-border bg-gradient-to-br from-primary/5 via-background to-fuchsia-500/5 p-4 sm:p-8">
      {(isFs) => (
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 py-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={onExit}>
              <ArrowLeft className="h-4 w-4" /> {deck.name}
            </Button>
            <div className="ml-auto text-sm tabular-nums text-muted-foreground">{done ? queue.length : index + 1} / {queue.length}</div>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${queue.length ? (Math.min(index, queue.length) / queue.length) * 100 : 0}%` }} />
          </div>

          {done || !card ? (
            <div className="flex flex-col items-center gap-4 rounded-3xl border border-border bg-card px-6 py-14 text-center shadow-lg">
              <Trophy className="h-14 w-14 text-amber-500" />
              <p className="text-2xl font-extrabold">{queue.length === 0 ? "Nothing due right now" : "Session complete!"}</p>
              {queue.length > 0 && <p className="text-muted-foreground">You knew {right} of {queue.length} cards{right === queue.length ? " — perfect!" : "."}</p>}
              <div className="flex gap-2">
                <Button onClick={onExit}>Back to decks</Button>
                {queue.length > 0 && (
                  <Button variant="outline" onClick={onRestart}>
                    <RotateCcw className="h-4 w-4" /> Go again
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <>
              <button onClick={() => setFlipped((f) => !f)} aria-label="Flip card" className="group [perspective:1200px] focus-visible:outline-none">
                <div className={cn("relative w-full transition-transform duration-500 [transform-style:preserve-3d]", isFs ? "h-[50vh]" : "h-72", flipped && "[transform:rotateY(180deg)]")}>
                  <div className="absolute inset-0 flex flex-col items-center justify-center rounded-3xl border border-border bg-card p-8 text-center shadow-xl [backface-visibility:hidden]">
                    <span className="mb-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">Question</span>
                    <p className="max-h-full overflow-auto text-2xl font-bold sm:text-3xl">{card.front}</p>
                    <span className="mt-4 text-xs text-muted-foreground">Click or press Space to flip</span>
                  </div>
                  <div className="absolute inset-0 flex flex-col items-center justify-center rounded-3xl border border-primary/30 bg-gradient-to-br from-primary to-fuchsia-600 p-8 text-center text-primary-foreground shadow-xl [backface-visibility:hidden] [transform:rotateY(180deg)]">
                    <span className="mb-3 text-xs font-bold uppercase tracking-widest opacity-80">Answer</span>
                    <p className="max-h-full overflow-auto text-2xl font-bold sm:text-3xl">{card.back}</p>
                  </div>
                </div>
              </button>
              <div className={cn("grid grid-cols-2 gap-3 transition-opacity", flipped ? "opacity-100" : "pointer-events-none opacity-30")}>
                <Button size="lg" variant="outline" onClick={() => grade(false)} className="h-14 border-rose-500/40 text-rose-600 hover:bg-rose-500/10">
                  <X className="h-5 w-5" /> Missed it <kbd className="ml-1 rounded bg-muted px-1.5 text-[10px]">1</kbd>
                </Button>
                <Button size="lg" onClick={() => grade(true)} className="h-14 bg-emerald-600 hover:bg-emerald-600/90">
                  <Check className="h-5 w-5" /> Got it <kbd className="ml-1 rounded bg-white/20 px-1.5 text-[10px]">2</kbd>
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </FullscreenStage>
  );
}

function Editor({ deck, onBack, onRename, onAdd, onEdit, onDelete, onImport }: { deck: Deck; onBack: () => void; onRename: (n: string) => void; onAdd: (f: string, b: string) => void; onEdit: (id: string, f: string, b: string) => void; onDelete: (id: string) => void; onImport: (text: string) => number }) {
  const [front, setFront] = React.useState("");
  const [back, setBack] = React.useState("");
  const [bulk, setBulk] = React.useState("");
  const [note, setNote] = React.useState("");
  const frontRef = React.useRef<HTMLInputElement>(null);

  const add = () => {
    if (!front.trim() || !back.trim()) return;
    onAdd(front.trim(), back.trim());
    setFront("");
    setBack("");
    frontRef.current?.focus();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" /> Decks
        </Button>
        <input value={deck.name} onChange={(e) => onRename(e.target.value)} aria-label="Deck name" className="h-10 min-w-48 flex-1 rounded-lg border border-border bg-background px-3 text-lg font-bold focus:outline-none focus:ring-2 focus:ring-primary" />
        <Button variant="outline" size="sm" disabled={deck.cards.length === 0} onClick={() => downloadBlob(new Blob([cardsToText(deck.cards)], { type: "text/tab-separated-values" }), `${deck.name.replace(/[^\w-]+/g, "-")}.tsv`)}>
          <Download className="h-4 w-4" /> Export
        </Button>
      </div>

      <Card className="space-y-3 p-4">
        <h3 className="text-sm font-semibold">Add a card</h3>
        <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
          <input ref={frontRef} value={front} onChange={(e) => setFront(e.target.value)} placeholder="Question / front" onKeyDown={(e) => e.key === "Enter" && add()} className="h-10 rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
          <input value={back} onChange={(e) => setBack(e.target.value)} placeholder="Answer / back" onKeyDown={(e) => e.key === "Enter" && add()} className="h-10 rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
          <Button onClick={add} disabled={!front.trim() || !back.trim()}>
            <Plus className="h-4 w-4" /> Add
          </Button>
        </div>
        <details className="text-sm">
          <summary className="cursor-pointer text-muted-foreground">Paste many cards at once</summary>
          <textarea value={bulk} onChange={(e) => setBulk(e.target.value)} rows={5} placeholder="question, answer (one per line)" className="mt-2 w-full resize-y rounded-lg border border-border bg-background p-3 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
          <div className="mt-2 flex items-center gap-3">
            <Button size="sm" disabled={parseCards(bulk).length === 0} onClick={() => { const n = onImport(bulk); setBulk(""); setNote(`Added ${n} cards.`); }}>
              Add {parseCards(bulk).length || ""} cards
            </Button>
            {note && <span className="text-xs text-emerald-600">{note}</span>}
          </div>
        </details>
      </Card>

      <Card className="divide-y divide-border">
        {deck.cards.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">No cards yet — add your first one above.</p>}
        {deck.cards.map((c, i) => (
          <div key={c.id} className="grid items-center gap-2 p-3 sm:grid-cols-[2rem_1fr_1fr_auto]">
            <span className="text-xs tabular-nums text-muted-foreground">{i + 1}</span>
            <input value={c.front} onChange={(e) => onEdit(c.id, e.target.value, c.back)} aria-label={`Card ${i + 1} question`} className="h-9 rounded-lg border border-transparent bg-transparent px-2 text-sm hover:border-border focus:border-primary focus:outline-none" />
            <input value={c.back} onChange={(e) => onEdit(c.id, c.front, e.target.value)} aria-label={`Card ${i + 1} answer`} className="h-9 rounded-lg border border-transparent bg-transparent px-2 text-sm hover:border-border focus:border-primary focus:outline-none" />
            <button onClick={() => onDelete(c.id)} aria-label={`Delete card ${i + 1}`} className="justify-self-end rounded-md p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </Card>
    </div>
  );
}
