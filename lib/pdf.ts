import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { quoteText } from "@/lib/quote";
import type { Quote } from "@/lib/types";

export async function quotePdf(quote: Quote, businessName: string): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  let page = doc.addPage([595, 842]);
  let y = 800;
  const draw = (text: string, emphasis = false) => {
    if (y < 48) {
      page = doc.addPage([595, 842]);
      y = 800;
    }
    page.drawText(text.slice(0, 110), { x: 40, y, size: emphasis ? 11 : 9, font: emphasis ? bold : font, color: rgb(0.12, 0.16, 0.22) });
    y -= emphasis ? 16 : 13;
  };
  page.drawRectangle({ x: 0, y: 812, width: 595, height: 30, color: rgb(0.72, 0.38, 0.22) });
  page.drawText("SIMULATED QUOTE  ·  NO PAYMENT  ·  NOT A TAX INVOICE", { x: 40, y: 822, size: 9, font: bold, color: rgb(1, 0.97, 0.94) });
  for (const line of quoteText(quote, businessName).replaceAll("₹", "Rs ").split("\n")) {
    draw(line, line.startsWith("ACCEL") || line.startsWith("Monthly") || line.startsWith("Setup"));
  }
  return doc.save();
}
