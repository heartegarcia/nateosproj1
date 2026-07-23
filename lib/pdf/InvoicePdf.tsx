import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { format, parseISO } from "date-fns";
import type { InvoiceSettings, TimeEntry } from "@/lib/types";

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 11, fontFamily: "Helvetica", color: "#18181b" },
  title: { fontSize: 22, fontWeight: 700, marginBottom: 4 },
  subtitle: { fontSize: 11, color: "#71717a", marginBottom: 20 },
  row: { flexDirection: "row", justifyContent: "space-between", marginBottom: 20 },
  label: { fontSize: 9, color: "#a1a1aa", textTransform: "uppercase", marginBottom: 2 },
  value: { fontSize: 11 },
  table: { marginTop: 10, borderTop: "1 solid #e4e4e7" },
  tableHeaderRow: { flexDirection: "row", borderBottom: "1 solid #e4e4e7", paddingVertical: 6 },
  tableRow: { flexDirection: "row", borderBottom: "1 solid #f4f4f5", paddingVertical: 6 },
  colDate: { width: "40%" },
  colHours: { width: "30%", textAlign: "right" },
  colNotes: { width: "30%", textAlign: "right", color: "#71717a" },
  headerCell: { fontSize: 9, color: "#a1a1aa", textTransform: "uppercase" },
  totalsBlock: { marginTop: 20, alignItems: "flex-end" },
  totalsRow: { flexDirection: "row", gap: 40, marginBottom: 4 },
  totalsLabel: { fontSize: 10, color: "#71717a", width: 100, textAlign: "right" },
  totalsValue: { fontSize: 10, width: 80, textAlign: "right" },
  grandTotal: { fontSize: 14, fontWeight: 700 },
  terms: { marginTop: 30, fontSize: 9, color: "#71717a" },
});

export function InvoicePdf({
  invoiceNumber,
  periodStart,
  periodEnd,
  entries,
  hourlyRate,
  totalHours,
  totalAmount,
  settings,
  createdAt,
}: {
  invoiceNumber: number;
  periodStart: string;
  periodEnd: string;
  entries: TimeEntry[];
  hourlyRate: number;
  totalHours: number;
  totalAmount: number;
  settings: InvoiceSettings;
  createdAt: string;
}) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>Invoice #{invoiceNumber}</Text>
        <Text style={styles.subtitle}>Issued {format(parseISO(createdAt), "MMMM d, yyyy")}</Text>

        <View style={styles.row}>
          <View>
            <Text style={styles.label}>From</Text>
            <Text style={styles.value}>{settings.full_name || "—"}</Text>
            <Text style={styles.value}>{settings.bank_details || "—"}</Text>
          </View>
          <View>
            <Text style={styles.label}>Period</Text>
            <Text style={styles.value}>
              {format(parseISO(periodStart), "MMM d, yyyy")} – {format(parseISO(periodEnd), "MMM d, yyyy")}
            </Text>
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeaderRow}>
            <Text style={[styles.colDate, styles.headerCell]}>Date</Text>
            <Text style={[styles.colHours, styles.headerCell]}>Hours</Text>
            <Text style={[styles.colNotes, styles.headerCell]}>Notes</Text>
          </View>
          {entries.map((e) => (
            <View key={e.id} style={styles.tableRow}>
              <Text style={styles.colDate}>{format(parseISO(e.work_date), "MMM d, yyyy")}</Text>
              <Text style={styles.colHours}>{e.hours.toFixed(2)}</Text>
              <Text style={styles.colNotes}>{e.notes || ""}</Text>
            </View>
          ))}
        </View>

        <View style={styles.totalsBlock}>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>Total hours</Text>
            <Text style={styles.totalsValue}>{totalHours.toFixed(2)}</Text>
          </View>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>Rate</Text>
            <Text style={styles.totalsValue}>${hourlyRate.toFixed(2)}/hr</Text>
          </View>
          <View style={styles.totalsRow}>
            <Text style={[styles.totalsLabel, styles.grandTotal]}>Total due</Text>
            <Text style={[styles.totalsValue, styles.grandTotal]}>${totalAmount.toFixed(2)}</Text>
          </View>
        </View>

        <Text style={styles.terms}>{settings.payment_terms || ""}</Text>
      </Page>
    </Document>
  );
}
