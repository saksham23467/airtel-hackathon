import path from "path";

export function dataRoot() {
  return process.env.UDYAM_DATA_ROOT || path.join(process.cwd(), "data");
}

export function storePath() {
  return process.env.UDYAM_STORE || path.join(dataRoot(), "runtime", "store.json");
}

export function uploadRoot() {
  return process.env.UDYAM_UPLOADS || path.join(dataRoot(), "runtime", "uploads");
}
