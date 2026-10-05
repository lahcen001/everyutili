export type GpaScale = "4.0" | "4.3";
export type CourseLevel = "regular" | "honors" | "ap";

export const LEVEL_BONUS: Record<CourseLevel, number> = { regular: 0, honors: 0.5, ap: 1 };

const BASE: Record<string, number> = { A: 4, "A-": 3.7, "B+": 3.3, B: 3, "B-": 2.7, "C+": 2.3, C: 2, "C-": 1.7, "D+": 1.3, D: 1, "D-": 0.7, F: 0 };

export const GRADES = ["A+", "A", "A-", "B+", "B", "B-", "C+", "C", "C-", "D+", "D", "D-", "F"];

export function gradePoints(grade: string, scale: GpaScale): number {
  if (grade === "A+") return scale === "4.3" ? 4.3 : 4;
  return BASE[grade] ?? 0;
}

export interface GpaCourse {
  grade: string;
  credits: number;
  level: CourseLevel;
}

export interface GpaResult {
  credits: number;
  unweightedPoints: number;
  weightedPoints: number;
  unweighted: number;
  weighted: number;
}

/** Weighted bonus applies only to passing grades (anything above F). */
export function calculateGpa(courses: GpaCourse[], scale: GpaScale): GpaResult {
  let credits = 0;
  let un = 0;
  let w = 0;
  for (const c of courses) {
    if (!(c.credits > 0)) continue;
    const base = gradePoints(c.grade, scale);
    credits += c.credits;
    un += base * c.credits;
    w += (base > 0 ? base + LEVEL_BONUS[c.level] : 0) * c.credits;
  }
  return { credits, unweightedPoints: un, weightedPoints: w, unweighted: credits ? un / credits : 0, weighted: credits ? w / credits : 0 };
}

/** Combine the current term with a previous cumulative GPA and its credits. */
export function cumulativeGpa(termPoints: number, termCredits: number, priorGpa: number, priorCredits: number): number {
  const credits = termCredits + Math.max(0, priorCredits);
  return credits > 0 ? (termPoints + Math.max(0, priorGpa) * Math.max(0, priorCredits)) / credits : 0;
}

/** GPA needed over `nextCredits` to reach `target` cumulative. */
export function gpaNeeded(target: number, currentPoints: number, currentCredits: number, nextCredits: number): number {
  if (nextCredits <= 0) return NaN;
  return (target * (currentCredits + nextCredits) - currentPoints) / nextCredits;
}
