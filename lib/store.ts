import fs from "fs";
import path from "path";
import { uploadRoot, storePath } from "@/lib/paths";
import { planRetention } from "@/lib/retention";
import type { StoreData } from "@/lib/types";

let chain: Promise<unknown> = Promise.resolve();

export function emptyStore(): StoreData {
  return { sessions: {}, orders: {}, audit: [] };
}

function insideUploads(file: string): boolean {
  const root = path.resolve(uploadRoot());
  const target = path.resolve(file);
  return target.startsWith(`${root}${path.sep}`);
}

function write(data: StoreData) {
  const file = storePath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify(data));
  fs.renameSync(temporary, file);
}

function enforceRetention(data: StoreData) {
  const plan = planRetention(data);
  if (!plan.changed) return;
  for (const file of plan.files) {
    if (insideUploads(file) && fs.existsSync(file)) fs.rmSync(file, { force: true });
  }
  write(data);
}

function read(): StoreData {
  const file = storePath();
  if (!fs.existsSync(file)) return emptyStore();
  const data = JSON.parse(fs.readFileSync(file, "utf8")) as StoreData;
  if (!data.sessions) data.sessions = {};
  if (!data.orders) data.orders = {};
  if (!data.audit) data.audit = [];
  enforceRetention(data);
  return data;
}

export function updateStore<T>(mutator: (store: StoreData) => T): Promise<T> {
  const run = chain.then(() => {
    const data = read();
    const result = mutator(data);
    write(data);
    return result;
  });
  chain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

export function readStore(): StoreData {
  return read();
}
