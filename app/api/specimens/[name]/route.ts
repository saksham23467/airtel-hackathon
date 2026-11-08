import fs from "fs";
import { specimenPath } from "@/lib/specimens";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ name: string }> }) {
  const { name } = await context.params;
  const file = specimenPath(name);
  if (!file) return new Response("Not found", { status: 404 });
  return new Response(fs.readFileSync(file), {
    headers: { "Content-Type": "image/png", "Cache-Control": "private, max-age=3600" },
  });
}
