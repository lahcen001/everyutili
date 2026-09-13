"use client";

import * as React from "react";
import { Plus, Save, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useTrackTool } from "@/hooks/useTrackTool";
import { saveToolResult } from "@/lib/storage/toolHistoryDb";
import { ToolHistoryList, type ToolHistoryListHandle } from "@/components/tools/shared/ToolHistoryList";

const GRADE_POINTS: Record<string, number> = {
  "A+": 4.0,
  A: 4.0,
  "A-": 3.7,
  "B+": 3.3,
  B: 3.0,
  "B-": 2.7,
  "C+": 2.3,
  C: 2.0,
  "C-": 1.7,
  "D+": 1.3,
  D: 1.0,
  F: 0.0,
};

const GRADE_OPTIONS = Object.keys(GRADE_POINTS);

interface Course {
  id: string;
  name: string;
  grade: string;
  credits: number;
}

function newCourse(index: number): Course {
  return { id: crypto.randomUUID(), name: `Course ${index}`, grade: "A", credits: 3 };
}

export default function GpaCalculator() {
  useTrackTool("gpa-calculator");
  const [courses, setCourses] = React.useState<Course[]>(() => [
    newCourse(1),
    newCourse(2),
    newCourse(3),
  ]);
  const historyRef = React.useRef<ToolHistoryListHandle>(null);

  const { totalPoints, totalCredits, gpa } = React.useMemo(() => {
    let points = 0;
    let credits = 0;
    for (const course of courses) {
      if (course.credits <= 0) continue;
      points += GRADE_POINTS[course.grade] * course.credits;
      credits += course.credits;
    }
    return { totalPoints: points, totalCredits: credits, gpa: credits > 0 ? points / credits : 0 };
  }, [courses]);

  const updateCourse = (id: string, patch: Partial<Course>) => {
    setCourses((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  };

  const addCourse = () => {
    setCourses((prev) => [...prev, newCourse(prev.length + 1)]);
  };

  const removeCourse = (id: string) => {
    setCourses((prev) => prev.filter((c) => c.id !== id));
  };

  const handleSave = async () => {
    if (totalCredits <= 0) return;
    await saveToolResult("gpa-calculator", {
      title: `GPA: ${gpa.toFixed(2)}`,
      summary: `${courses.length} course${courses.length === 1 ? "" : "s"}, ${totalCredits} total credits`,
    });
    historyRef.current?.refresh();
  };

  return (
    <div className="space-y-6">
      <Card className="space-y-3 p-6">
        <div className="hidden gap-3 px-1 text-xs font-medium text-muted-foreground sm:grid sm:grid-cols-[1fr_140px_100px_40px]">
          <span>Course</span>
          <span>Grade</span>
          <span>Credits</span>
          <span />
        </div>
        {courses.map((course) => (
          <div key={course.id} className="grid gap-2 sm:grid-cols-[1fr_140px_100px_40px] sm:items-center">
            <input
              type="text"
              value={course.name}
              onChange={(e) => updateCourse(course.id, { name: e.target.value })}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <select
              value={course.grade}
              onChange={(e) => updateCourse(course.id, { grade: e.target.value })}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {GRADE_OPTIONS.map((grade) => (
                <option key={grade} value={grade}>
                  {grade} ({GRADE_POINTS[grade].toFixed(1)})
                </option>
              ))}
            </select>
            <input
              type="number"
              min={0}
              max={12}
              value={course.credits}
              onChange={(e) => updateCourse(course.id, { credits: Number(e.target.value) || 0 })}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <button
              onClick={() => removeCourse(course.id)}
              disabled={courses.length <= 1}
              aria-label="Remove course"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:pointer-events-none disabled:opacity-40"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
        <Button size="sm" variant="outline" onClick={addCourse}>
          <Plus className="h-3.5 w-3.5" /> Add course
        </Button>
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-5 text-center">
          <p className="text-sm text-muted-foreground">GPA</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-primary">{gpa > 0 ? gpa.toFixed(2) : "—"}</p>
        </Card>
        <Card className="p-5 text-center">
          <p className="text-sm text-muted-foreground">Total credits</p>
          <p className="mt-1 text-2xl font-bold tabular-nums">{totalCredits}</p>
        </Card>
        <Card className="p-5 text-center">
          <p className="text-sm text-muted-foreground">Total quality points</p>
          <p className="mt-1 text-2xl font-bold tabular-nums">{totalPoints.toFixed(2)}</p>
        </Card>
      </div>

      <Button size="sm" variant="outline" onClick={handleSave} disabled={totalCredits <= 0}>
        <Save className="h-3.5 w-3.5" /> Save result
      </Button>

      <ToolHistoryList ref={historyRef} toolSlug="gpa-calculator" />
    </div>
  );
}
