import { buildLlmsTxt } from "@/lib/llms";

// Static at build time: the tool registry doesn't change per-request.
export const dynamic = "force-static";

export function GET() {
  return new Response(buildLlmsTxt(), {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
    },
  });
}
