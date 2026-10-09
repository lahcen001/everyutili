import { TOOLS, type ToolConfig } from "@/config/tools";

/** Skill trainers that live in the "train" group but are not games. */
const NOT_GAMES = new Set(["math-speed-trainer", "typing-speed-test"]);

/** Everything shown on the Games page: casual games first, then the brain-training games. */
export function getGameTools(): ToolConfig[] {
  const games = TOOLS.filter((t) => (t.group === "fun" || t.group === "train") && !NOT_GAMES.has(t.slug));
  return games.slice().sort((a, b) => b.priority - a.priority);
}

/** Games pinned on the home page banner. */
export const HOME_GAME_SLUGS = ["sudoku", "block-stacker", "minesweeper", "snake-game", "game-2048", "connect-four"] as const;
