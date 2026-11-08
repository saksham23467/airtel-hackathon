import { spawn } from "child_process";
import fs from "fs";
import path from "path";

function pythonBin(): string {
  const venv = path.join(process.cwd(), ".venv", "bin", "python");
  return fs.existsSync(venv) ? venv : "python3";
}

export function runOcr(imagePath: string): Promise<{ text: string; orientation: number }> {
  return new Promise((resolve, reject) => {
    const child = spawn(pythonBin(), [path.join(process.cwd(), "model", "ocr.py"), imagePath], { stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    let err = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("OCR timed out"));
    }, 30_000);
    child.stdout.on("data", (chunk) => {
      out += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      err += String(chunk);
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (!out) {
        reject(new Error(err || `OCR exited ${code}`));
        return;
      }
      const parsed = JSON.parse(out) as { text?: string; orientation?: number; error?: string };
      if (parsed.error) reject(new Error(parsed.error));
      else resolve({ text: parsed.text || "", orientation: parsed.orientation || 0 });
    });
  });
}
