import { buildLlmsFullTxt } from "@/lib/llms";

// Static at build time: the tool registry and English content don't change
// per-request.
export const dynamic = "force-static";

export async function GET() {
  const body = await buildLlmsFullTxt();
  return new Response(body, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
    },
  });
}
