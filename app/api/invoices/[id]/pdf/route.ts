import fs from "node:fs";
import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { getInvoiceById, resolveInvoicePdfPath } from "@/lib/invoices";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const invoice = await getInvoiceById(id);
  if (!invoice) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const diskPath = resolveInvoicePdfPath(invoice);
  if (!diskPath || !fs.existsSync(diskPath)) {
    return NextResponse.json({ error: "PDF missing" }, { status: 404 });
  }

  const bytes = fs.readFileSync(diskPath);
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="invoice-${invoice.invoice_number}.pdf"`,
    },
  });
}
