export type Dir = "up" | "down" | "left" | "right";
export interface Point {
  x: number;
  y: number;
}
export interface SnakeState {
  size: number;
  /** head first */
  snake: Point[];
  dir: Dir;
  food: Point;
  score: number;
  over: boolean;
}

const VEC: Record<Dir, Point> = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };
const OPPOSITE: Record<Dir, Dir> = { up: "down", down: "up", left: "right", right: "left" };

export const canTurn = (current: Dir, next: Dir): boolean => OPPOSITE[current] !== next;

export function placeFood(size: number, snake: Point[], rand: () => number = Math.random): Point {
  const free: Point[] = [];
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (!snake.some((s) => s.x === x && s.y === y)) free.push({ x, y });
  return free.length ? free[Math.floor(rand() * free.length)] : { x: -1, y: -1 };
}

export function initialState(size = 16, rand: () => number = Math.random): SnakeState {
  const mid = Math.floor(size / 2);
  const snake = [{ x: mid, y: mid }, { x: mid - 1, y: mid }, { x: mid - 2, y: mid }];
  return { size, snake, dir: "right", food: placeFood(size, snake, rand), score: 0, over: false };
}

/** Advances one tick. Hitting a wall or yourself ends the game; eating grows the snake. */
export function step(state: SnakeState, requested: Dir, rand: () => number = Math.random): SnakeState {
  if (state.over) return state;
  const dir = canTurn(state.dir, requested) ? requested : state.dir;
  const head = state.snake[0];
  const next = { x: head.x + VEC[dir].x, y: head.y + VEC[dir].y };
  const ate = next.x === state.food.x && next.y === state.food.y;
  const body = ate ? state.snake : state.snake.slice(0, -1);
  const hit = next.x < 0 || next.y < 0 || next.x >= state.size || next.y >= state.size || body.some((s) => s.x === next.x && s.y === next.y);
  if (hit) return { ...state, dir, over: true };
  const snake = [next, ...body];
  return { ...state, dir, snake, score: state.score + (ate ? 1 : 0), food: ate ? placeFood(state.size, snake, rand) : state.food };
}
