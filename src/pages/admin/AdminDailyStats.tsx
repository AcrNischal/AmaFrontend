import { useState, useEffect } from "react";
import { fetchDailySales } from "@/api/index.js";
import { getCurrentUser } from "../../auth/auth";
import { format } from "date-fns";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import {
  Calendar as CalendarIcon,
  ChevronRight,
  TrendingUp,
  Package,
  IndianRupee,
  Loader2,
  CalendarDays,
  ArrowRight,
  Download
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export default function AdminDailyStats() {
  const [date, setDate] = useState<Date>(new Date());
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);

  const loadData = async (selectedDate: Date) => {
    setLoading(true);
    const user = getCurrentUser();
    const branchId = user?.branch_id;

    if (!branchId) {
      toast.error("No branch selected or assigned.");
      setLoading(false);
      return;
    }

    try {
      const formattedDate = format(selectedDate, "yyyy-MM-dd");
      const result = await fetchDailySales(branchId, formattedDate);
      setData(result);
    } catch (error) {
      console.error("Failed to fetch daily sales:", error);
      toast.error("Failed to load daily statistics");
    } finally {
      setLoading(false);
    }
  };

  const exportToExcel = () => {
    if (!data?.sales || data.sales.length === 0) {
      toast.error("No data available to export.");
      return;
    }

    const branchName = data?.branch || "Branch";
    const formattedDate = format(date, "yyyy-MM-dd");

    // Prepare data for Excel
    const excelData = data.sales.map((item: any) => ({
      "Product Name": item.product__name || "Unknown",
      "Quantity Sold": item.qty_sold || 0,
      "Total Revenue": item.total_revenue || 0,
    }));

    // Create worksheet
    const worksheet = XLSX.utils.json_to_sheet(excelData);

    // Create workbook
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Daily Sales");

    // Generate buffer
    const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });

    // Create Blob and Save
    const dataBlob = new Blob([excelBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8" });
    saveAs(dataBlob, `Daily_Sales_${branchName}_${formattedDate}.xlsx`);

    toast.success("Daily sales report exported successfully.");
  };

  useEffect(() => {
    loadData(date);
  }, [date]);

  const totalRevenue = data?.sales?.reduce((acc: number, item: any) => acc + (item.total_revenue || 0), 0) || 0;
  const totalItems = data?.sales?.reduce((acc: number, item: any) => acc + (item.qty_sold || 0), 0) || 0;

  return (
    <div className="p-6 space-y-8">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Daily Stats</h1>
          <p className="text-sm text-muted-foreground font-medium flex items-center gap-2">
            Detailed sales breakdown for <span className="text-primary font-bold">{format(date, "MMMM d, yyyy")}</span>
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "h-12 rounded-2xl border-2 px-6 font-bold transition-all hover:bg-slate-50 border-slate-200 shadow-sm gap-3",
                  !date && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="h-5 w-5 text-primary" />
                {date ? format(date, "PPP") : <span>Pick a date</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 border-none shadow-2xl rounded-3xl overflow-hidden" align="end">
              <Calendar
                mode="single"
                selected={date}
                onSelect={(d) => d && setDate(d)}
                initialFocus
                className="p-4"
              />
            </PopoverContent>
          </Popover>

          <Button
            className="h-12 rounded-2xl px-6 font-bold shadow-lg shadow-primary/20 gap-2"
            onClick={() => loadData(date)}
            disabled={loading}
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <TrendingUp className="h-5 w-5" />}
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="border-none shadow-xl shadow-slate-200/50 rounded-[2rem] overflow-hidden group">
          <CardContent className="p-8">
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-1">Total Revenue</p>
            <div className="flex items-baseline gap-1">
              <span className="text-sm font-bold text-slate-400">Rs.</span>
              <h3 className="text-2xl font-black text-slate-900">{totalRevenue.toLocaleString()}</h3>
            </div>
            <div className="mt-4 flex items-center gap-2 text-emerald-600 bg-emerald-50 w-fit px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider">
              <TrendingUp className="h-3 w-3" />
              Live Data
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-xl shadow-slate-200/50 rounded-[2rem] overflow-hidden group">
          <CardContent className="p-8">
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-1">Products Sold</p>
            <h3 className="text-2xl font-black text-slate-900">{totalItems} <span className="text-sm font-bold text-slate-400">Items</span></h3>
            <div className="mt-4 flex items-center gap-2 text-amber-600 bg-amber-50 w-fit px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider">
              <ChevronRight className="h-3 w-3" />
              Volume Analysis
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Table Section */}
      <div className="w-full">
        <Card className="border-none shadow-xl shadow-slate-200/50 rounded-[2rem] overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="text-xl font-black uppercase tracking-tight">Itemized sales performance</h3>

            </div>
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl font-bold h-9 gap-2 border-2"
              onClick={exportToExcel}
              disabled={loading || !data?.sales?.length}
            >
              <Download className="h-4 w-4" />
              Export XLSX
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-6 py-4 text-left font-bold uppercase tracking-wider text-[11px] text-muted-foreground">Product</th>
                  <th className="px-6 py-4 text-center font-bold uppercase tracking-wider text-[11px] text-muted-foreground">Qty Sold</th>
                  <th className="px-6 py-4 text-right font-bold uppercase tracking-wider text-[11px] text-muted-foreground">Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>
                      <td colSpan={3} className="px-6 py-6 h-16 bg-slate-100/10"></td>
                    </tr>
                  ))
                ) : data?.sales && data.sales.length > 0 ? (
                  data.sales.map((item: any) => (
                    <tr key={item.product__id} className="border-t hover:bg-slate-50 transition-colors group text-lg">
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-4">
                          <div className="h-9 w-9 rounded-xl bg-primary/5 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white">
                            <span className="font-black text-xs">{item.product__name ? item.product__name.charAt(0) : '?'}</span>
                          </div>
                          <span className="font-bold text-slate-700">{item.product__name || 'Unknown'}</span>
                        </div>
                      </td>
                      <td className="px-6 py-3 text-center">
                        <span className="inline-flex items-center justify-center h-8 w-12 rounded-lg bg-slate-100 text-sm font-black text-slate-600">
                          {item.qty_sold || 0}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-right font-black text-slate-900">
                        Rs.{(item.total_revenue || 0).toLocaleString()}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} className="px-8 py-20 text-center text-muted-foreground font-bold italic">
                      Zero transactions recorded for this period.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
