import { currentSession } from "@/lib/http";
import { quotePdf } from "@/lib/pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await currentSession();
  if (!session?.quote || !session.profile) {
    return new Response("Save a quote first.", { status: 404 });
  }
  const bytes = await quotePdf(session.quote, session.profile.businessName);
  return new Response(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="Accel-Business-Quote-${session.id.slice(0, 8)}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
