import { TrackerApp } from "@/components/tracker-app";

export const dynamic = "force-dynamic";

export default async function TrackPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <TrackerApp id={id} />;
}
