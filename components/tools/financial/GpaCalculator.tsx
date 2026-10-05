"use client";

import * as React from "react";
import { Plus, Save, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useTrackTool } from "@/hooks/useTrackTool";
import { saveToolResult } from "@/lib/storage/toolHistoryDb";
import { ToolHistoryList, type ToolHistoryListHandle } from "@/components/tools/shared/ToolHistoryList";
import { GRADES, LEVEL_BONUS, calculateGpa, cumulativeGpa, gpaNeeded, gradePoints, type CourseLevel, type GpaScale } from "@/lib/finance/gpa";
import { cn } from "@/lib/utils";

interface Course {
  id: string;
  name: string;
  grade: string;
  credits: number;
  level: CourseLevel;
}

const LEVEL_LABEL: Record<CourseLevel, string> = { regular: "Regular", honors: "Honors (+0.5)", ap: "AP / IB (+1.0)" };
const inputClass = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary";

function newCourse(index: number): Course {
  return { id: crypto.randomUUID(), name: `Course ${index}`, grade: "A", credits: 3, level: "regular" };
}

export default function GpaCalculator() {
  useTrackTool("gpa-calculator");
  const [courses, setCourses] = React.useState<Course[]>(() => [newCourse(1), newCourse(2), newCourse(3)]);
  const [scale, setScale] = React.useState<GpaScale>("4.0");
  const [priorGpa, setPriorGpa] = React.useState("");
  const [priorCredits, setPriorCredits] = React.useState("");
  const [target, setTarget] = React.useState("");
  const [nextCredits, setNextCredits] = React.useState("15");
  const historyRef = React.useRef<ToolHistoryListHandle>(null);

  const term = calculateGpa(courses, scale);
  const hasPrior = Number(priorCredits) > 0 && priorGpa.trim() !== "";
  const prior = Math.max(0, Number(priorGpa) || 0);
  const priorCr = Math.max(0, Number(priorCredits) || 0);
  const anyWeighted = courses.some((c) => c.level !== "regular" && c.credits > 0);
  const cumulative = hasPrior ? cumulativeGpa(term.unweightedPoints, term.credits, prior, priorCr) : null;
  const currentPoints = hasPrior ? term.unweightedPoints + prior * priorCr : term.unweightedPoints;
  const currentCredits = hasPrior ? term.credits + priorCr : term.credits;
  const targetNum = Number(target);
  const needed = target.trim() !== "" && Number(nextCredits) > 0 ? gpaNeeded(targetNum, currentPoints, currentCredits, Number(nextCredits)) : null;
  const maxScale = scale === "4.3" ? 4.3 : 4;

  const updateCourse = (id: string, patch: Partial<Course>) => setCourses((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));

  const handleSave = async () => {
    if (term.credits <= 0) return;
    await saveToolResult("gpa-calculator", {
      title: `GPA: ${term.unweighted.toFixed(2)}${anyWeighted ? ` (weighted ${term.weighted.toFixed(2)})` : ""}`,
      summary: `${courses.length} course${courses.length === 1 ? "" : "s"}, ${term.credits} credits${cumulative !== null ? ` · cumulative ${cumulative.toFixed(2)}` : ""}`,
    });
    historyRef.current?.refresh();
  };

  return (
    <div className="space-y-6">
      <Card className="space-y-3 p-6">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium">Grade scale</span>
          <div className="flex overflow-hidden rounded-lg border border-border" role="group" aria-label="Grade scale">
            {(["4.0", "4.3"] as const).map((s) => (
              <button key={s} onClick={() => setScale(s)} aria-pressed={scale === s} className={cn("px-3 py-1.5 text-sm font-medium transition-colors", scale === s ? "bg-primary text-primary-foreground" : "hover:bg-muted")}>
                {s} {s === "4.3" ? "(A+ = 4.3)" : "(A+ = 4.0)"}
              </button>
            ))}
          </div>
        </div>
        <div className="hidden gap-3 px-1 text-xs font-medium text-muted-foreground sm:grid sm:grid-cols-[1fr_130px_150px_90px_40px]">
          <span>Course</span>
          <span>Grade</span>
          <span>Level</span>
          <span>Credits</span>
          <span />
        </div>
        {courses.map((course) => (
          <div key={course.id} className="grid gap-2 sm:grid-cols-[1fr_130px_150px_90px_40px] sm:items-center">
            <input type="text" value={course.name} aria-label="Course name" onChange={(e) => updateCourse(course.id, { name: e.target.value })} className={inputClass} />
            <select value={course.grade} aria-label="Grade" onChange={(e) => updateCourse(course.id, { grade: e.target.value })} className={inputClass}>
              {GRADES.map((g) => (
                <option key={g} value={g}>
                  {g} ({gradePoints(g, scale).toFixed(1)})
                </option>
              ))}
            </select>
            <select value={course.level} aria-label="Course level" onChange={(e) => updateCourse(course.id, { level: e.target.value as CourseLevel })} className={inputClass}>
              {(Object.keys(LEVEL_BONUS) as CourseLevel[]).map((l) => (
                <option key={l} value={l}>
                  {LEVEL_LABEL[l]}
                </option>
              ))}
            </select>
            <input type="number" min={0} max={12} step={0.5} value={course.credits} aria-label="Credits" onChange={(e) => updateCourse(course.id, { credits: Math.max(0, Number(e.target.value) || 0) })} className={inputClass} />
            <button onClick={() => setCourses((prev) => prev.filter((c) => c.id !== course.id))} disabled={courses.length <= 1} aria-label="Remove course" className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:pointer-events-none disabled:opacity-40">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
        <Button size="sm" variant="outline" onClick={() => setCourses((prev) => [...prev, newCourse(prev.length + 1)])}>
          <Plus className="h-3.5 w-3.5" /> Add course
        </Button>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-5 text-center">
          <p className="text-sm text-muted-foreground">GPA (unweighted)</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-primary">{term.credits > 0 ? term.unweighted.toFixed(2) : "—"}</p>
          <p className="text-xs text-muted-foreground">out of {maxScale.toFixed(1)}</p>
        </Card>
        <Card className="p-5 text-center">
          <p className="text-sm text-muted-foreground">GPA (weighted)</p>
          <p className="mt-1 text-2xl font-bold tabular-nums">{term.credits > 0 && anyWeighted ? term.weighted.toFixed(2) : "—"}</p>
          <p className="text-xs text-muted-foreground">{anyWeighted ? "honors / AP bonus included" : "mark a course Honors or AP"}</p>
        </Card>
        <Card className="p-5 text-center">
          <p className="text-sm text-muted-foreground">Total credits</p>
          <p className="mt-1 text-2xl font-bold tabular-nums">{term.credits}</p>
        </Card>
        <Card className="p-5 text-center">
          <p className="text-sm text-muted-foreground">Quality points</p>
          <p className="mt-1 text-2xl font-bold tabular-nums">{term.unweightedPoints.toFixed(2)}</p>
        </Card>
      </div>

      <Card className="space-y-4 p-6">
        <p className="text-sm font-medium">Cumulative GPA &amp; goal</p>
        <div className="grid gap-4 sm:grid-cols-4">
          <label className="space-y-1.5 text-sm">
            <span className="text-xs text-muted-foreground">Previous cumulative GPA</span>
            <input type="number" min={0} max={5} step={0.01} value={priorGpa} onChange={(e) => setPriorGpa(e.target.value)} placeholder="e.g. 3.20" className={inputClass} />
          </label>
          <label className="space-y-1.5 text-sm">
            <span className="text-xs text-muted-foreground">Previous credits</span>
            <input type="number" min={0} value={priorCredits} onChange={(e) => setPriorCredits(e.target.value)} placeholder="e.g. 60" className={inputClass} />
          </label>
          <label className="space-y-1.5 text-sm">
            <span className="text-xs text-muted-foreground">Target cumulative GPA</span>
            <input type="number" min={0} max={5} step={0.01} value={target} onChange={(e) => setTarget(e.target.value)} placeholder="e.g. 3.50" className={inputClass} />
          </label>
          <label className="space-y-1.5 text-sm">
            <span className="text-xs text-muted-foreground">Credits next term</span>
            <input type="number" min={1} value={nextCredits} onChange={(e) => setNextCredits(e.target.value)} className={inputClass} />
          </label>
        </div>
        {cumulative !== null && (
          <p className="text-sm" role="status">
            New cumulative GPA after this term: <span className="font-semibold tabular-nums">{cumulative.toFixed(2)}</span>
          </p>
        )}
        {needed !== null && Number.isFinite(needed) && (
          <p className={cn("text-sm", needed > maxScale ? "text-destructive" : needed < 0 ? "text-emerald-600 dark:text-emerald-400" : "")} role="status">
            {needed > maxScale
              ? `Reaching ${targetNum.toFixed(2)} in ${nextCredits} credits would need ${needed.toFixed(2)}, above the ${maxScale.toFixed(1)} maximum — it will take more than one term.`
              : needed <= 0
                ? `You already meet ${targetNum.toFixed(2)} whatever you score next term.`
                : `You need about ${needed.toFixed(2)} GPA over the next ${nextCredits} credits to reach ${targetNum.toFixed(2)}.`}
          </p>
        )}
        <p className="text-xs text-muted-foreground">Cumulative and goal figures use unweighted points. Schools differ (some give no D−, some scale A+ differently) — check your own policy.</p>
      </Card>

      <Button size="sm" variant="outline" onClick={handleSave} disabled={term.credits <= 0}>
        <Save className="h-3.5 w-3.5" /> Save result
      </Button>

      <ToolHistoryList ref={historyRef} toolSlug="gpa-calculator" />
    </div>
  );
}
