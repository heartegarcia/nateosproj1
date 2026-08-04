import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { getInvoiceById, getInvoicePdfBuffer } from "@/lib/invoices";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const invoice = await getInvoiceById(id);
  if (!invoice) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const bytes = await getInvoicePdfBuffer(invoice);
  if (!bytes) {
    return NextResponse.json({ error: "PDF missing" }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="invoice-${invoice.invoice_number}.pdf"`,
    },
  });
}
