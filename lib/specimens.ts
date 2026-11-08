import fs from "fs";
import path from "path";
import { dataRoot } from "@/lib/paths";
import type { DocKind } from "@/lib/types";

const NAME = /^K(0[1-9]|1[0-2])_(gst_certificate|udyam_certificate|address_proof|signatory_id)\.png$/;

const KIND: Record<string, DocKind> = {
  gst_certificate: "gst",
  udyam_certificate: "udyam",
  address_proof: "address",
  signatory_id: "signatory",
};

export function specimenPath(name: string): string | null {
  if (!NAME.test(name)) return null;
  const full = path.resolve(dataRoot(), "kyc_documents", name);
  return fs.existsSync(full) ? full : null;
}

export function kindFromSpecimen(name: string): DocKind | null {
  const match = name.match(/_(gst_certificate|udyam_certificate|address_proof|signatory_id)\.png$/);
  return match ? KIND[match[1]] : null;
}

export function specimensForPack(pack: string): { name: string; kind: DocKind }[] {
  if (!/^K(0[1-9]|1[0-2])$/.test(pack)) return [];
  const dir = path.join(dataRoot(), "kyc_documents");
  return fs
    .readdirSync(dir)
    .filter((name) => name.startsWith(`${pack}_`) && NAME.test(name))
    .sort()
    .map((name) => ({ name, kind: kindFromSpecimen(name)! }));
}
