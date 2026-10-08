export type Op = "+" | "-" | "×" | "÷";
export type Level = 1 | 2 | 3;

export interface Problem {
  a: number;
  b: number;
  op: Op;
  answer: number;
  text: string;
}

const RANGE: Record<Level, number> = { 1: 10, 2: 20, 3: 100 };

const int = (rand: () => number, min: number, max: number) => min + Math.floor(rand() * (max - min + 1));

/** One arithmetic question with a whole-number answer (subtraction never goes negative, division is exact). */
export function makeProblem(op: Op, level: Level, rand: () => number = Math.random): Problem {
  const max = RANGE[level];
  let a: number;
  let b: number;
  let answer: number;
  switch (op) {
    case "+":
      a = int(rand, 1, max);
      b = int(rand, 1, max);
      answer = a + b;
      break;
    case "-":
      a = int(rand, 2, max);
      b = int(rand, 1, a);
      answer = a - b;
      break;
    case "×": {
      const m = level === 3 ? 12 : level === 2 ? 10 : 5;
      a = int(rand, 2, m);
      b = int(rand, 2, m);
      answer = a * b;
      break;
    }
    case "÷": {
      const m = level === 3 ? 12 : level === 2 ? 10 : 5;
      b = int(rand, 2, m);
      answer = int(rand, 2, m);
      a = b * answer;
      break;
    }
  }
  return { a, b, op, answer, text: `${a} ${op} ${b}` };
}

export function accuracy(correct: number, total: number): number {
  return total === 0 ? 0 : Math.round((correct / total) * 100);
}
