import { HandoffApp } from "@/components/handoff-app";

export const dynamic = "force-dynamic";

export default async function HandoffPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <HandoffApp code={code} />;
}
