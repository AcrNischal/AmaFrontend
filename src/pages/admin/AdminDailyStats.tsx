import { useState, useEffect } from "react";
import { fetchDailySales } from "@/api/index.js";
import { format } from "date-fns";
import {
  Calendar as CalendarIcon,
  ChevronRight,
  TrendingUp,
  Package,
  IndianRupee,
  Loader2,
  CalendarDays,
  ArrowRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell
} from "recharts";

export default function AdminDailyStats() {
  const [date, setDate] = useState<Date>(new Date());
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);

  const loadData = async (selectedDate: Date) => {
    setLoading(true);
    try {
      const formattedDate = format(selectedDate, "yyyy-MM-dd");
      const result = await fetchDailySales(formattedDate);
      setData(result);
    } catch (error) {
      console.error("Failed to fetch daily sales:", error);
      toast.error("Failed to load daily statistics");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData(date);
  }, [date]);

  const totalRevenue = data?.sales?.reduce((acc: number, item: any) => acc + item.total_revenue, 0) || 0;
  const totalItems = data?.sales?.reduce((acc: number, item: any) => acc + item.qty_sold, 0) || 0;

  // Colors for the chart
  const COLORS = ['#8B4513', '#A0522D', '#CD853F', '#DEB887', '#D2691E'];

  return (
    <div className="p-6 space-y-8 animate-in fade-in duration-700">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Daily Stats</h1>
          <p className="text-xs text-muted-foreground font-medium flex items-center gap-2">
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-none shadow-xl shadow-slate-200/50 rounded-[2rem] overflow-hidden group hover:scale-[1.02] transition-transform duration-300">
          <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
            <IndianRupee className="h-16 w-16" />
          </div>
          <CardContent className="p-6">
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-1">Total Revenue</p>
            <div className="flex items-baseline gap-1">
              <span className="text-xs font-bold text-slate-400">Rs.</span>
              <h3 className="text-xl font-black text-slate-900">{totalRevenue.toLocaleString()}</h3>
            </div>
            <div className="mt-3 flex items-center gap-2 text-emerald-600 bg-emerald-50 w-fit px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider">
              <TrendingUp className="h-3 w-3" />
              Live Data
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-xl shadow-slate-200/50 rounded-[2rem] overflow-hidden group hover:scale-[1.02] transition-transform duration-300">
          <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
            <Package className="h-16 w-16" />
          </div>
          <CardContent className="p-6">
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-1">Products Sold</p>
            <h3 className="text-xl font-black text-slate-900">{totalItems} <span className="text-xs font-bold text-slate-400">Items</span></h3>
            <div className="mt-3 flex items-center gap-2 text-amber-600 bg-amber-50 w-fit px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider">
              <ChevronRight className="h-3 w-3" />
              Volume Analysis
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-xl shadow-slate-200/50 rounded-[2rem] overflow-hidden group hover:scale-[1.02] transition-transform duration-300">
          <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
            <CalendarDays className="h-16 w-16" />
          </div>
          <CardContent className="p-6">
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-1">Active Branch</p>
            <h3 className="text-lg font-black text-slate-900 capitalize">{data?.branch || "Boudha Branch"}</h3>
            <div className="mt-3 flex items-center gap-2 text-blue-600 bg-blue-50 w-fit px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider">
              <ArrowRight className="h-3 w-3" />
              Main Outlet
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts & Table Section */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* Chart Card */}
        <Card className="border-none shadow-xl shadow-slate-200/50 rounded-[2rem] p-8">
          <CardHeader className="p-0 mb-6">
            <CardTitle className="text-lg font-black uppercase tracking-tight">Sales Visualization</CardTitle>
            <CardDescription className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Top items by quantity sold</CardDescription>
          </CardHeader>
          <div className="h-[300px] w-full">
            {loading ? (
              <div className="h-full w-full flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : data?.sales?.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.sales.slice(0, 10)} layout="vertical" margin={{ left: 0, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                  <XAxis type="number" hide />
                  <YAxis 
                    dataKey="product__name" 
                    type="category" 
                    width={150} 
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 13, fontWeight: 700, fill: '#334155' }}
                  />
                  <Tooltip
                    cursor={{ fill: '#f8fafc' }}
                    contentStyle={{
                      borderRadius: '1rem',
                      border: 'none',
                      boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)',
                      padding: '1rem'
                    }}
                  />
                  <Bar dataKey="qty_sold" radius={[0, 10, 10, 0]} barSize={22}>
                    {data.sales.map((_: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full w-full flex flex-col items-center justify-center text-muted-foreground">
                <Package className="h-12 w-12 mb-4 opacity-20" />
                <p className="font-bold">No sales data for this date</p>
              </div>
            )}
          </div>
        </Card>

        {/* Table Card */}
        <Card className="border-none shadow-xl shadow-slate-200/50 rounded-[2rem] overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-black uppercase tracking-tight">Product Breakdown</h3>
              <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Itemized sales performance</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100">
                  <th className="px-8 py-4 text-left text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Product</th>
                  <th className="px-8 py-4 text-center text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Qty Sold</th>
                  <th className="px-8 py-4 text-right text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td colSpan={3} className="px-8 py-6 h-16 bg-slate-100/20"></td>
                    </tr>
                  ))
                ) : data?.sales?.length > 0 ? (
                  data.sales.map((item: any) => (
                    <tr key={item.product__id} className="hover:bg-slate-50/50 transition-colors group text-sm">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-lg bg-primary/5 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-all duration-300">
                            <span className="font-black text-[10px]">{item.product__name.charAt(0)}</span>
                          </div>
                          <span className="font-bold text-slate-700">{item.product__name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="inline-flex items-center justify-center h-6 w-10 rounded-lg bg-slate-100 text-[10px] font-black text-slate-600">
                          {item.qty_sold}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right font-black text-slate-900">
                        Rs.{item.total_revenue.toLocaleString()}
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
