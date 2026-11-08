import fs from "fs";
import path from "path";
import { json } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const root = path.join(process.cwd(), "model", "artifacts");
  const metricsPath = path.join(root, "metrics.json");
  const funnelPath = path.join(root, "funnel.json");
  if (!fs.existsSync(metricsPath) || !fs.existsSync(funnelPath)) {
    return json({ error: "Train the model first: python3 model/train.py" }, 404);
  }
  return json({
    metrics: JSON.parse(fs.readFileSync(metricsPath, "utf8")),
    funnel: JSON.parse(fs.readFileSync(funnelPath, "utf8")),
  });
}
