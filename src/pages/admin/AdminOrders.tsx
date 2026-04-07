import { useState, useEffect, useMemo } from "react";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Filter, Download, Eye, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { format, parseISO } from "date-fns";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { fetchInvoices, fetchProducts, fetchBranches, fetchInvoiceDetail } from "@/api/index.js";
import { toast } from "sonner";
import { getCurrentUser } from "@/auth/auth";

export default function AdminOrders() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [productsMap, setProductsMap] = useState<Record<string, any>>({});
  const [branchesMap, setBranchesMap] = useState<Record<string, any>>({});
  const [isFetchingDetail, setIsFetchingDetail] = useState(false);
  const [showPopupItems, setShowPopupItems] = useState(true);
  
  // Helper to parse dates with space format
  const parseSafeDate = (dateStr: string) => {
    if (!dateStr) return null;
    try {
      const formatted = dateStr.replace(' ', 'T');
      return parseISO(formatted);
    } catch {
      return new Date(dateStr);
    }
  };
  
  // Pagination state
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);

  const currentUser = getCurrentUser();
  const branchId = currentUser?.branch_id ?? null;

  // Handle initial load only
  useEffect(() => {
    loadInvoices(1, true);
    loadProducts();
    loadBranches();
  }, [branchId]);

  const loadProducts = async () => {
    try {
      const data = await fetchProducts();
      // data is an array here (fetchProducts returns data.data)
      if (Array.isArray(data)) {
        const map = data.reduce((acc: any, p: any) => {
          acc[String(p.id)] = p;
          return acc;
        }, {});
        setProductsMap(map);
      }
    } catch (err) {
      console.error("Failed to load products for mapping", err);
    }
  };

  const loadBranches = async () => {
    try {
      const data = await fetchBranches();
      // fetchBranches returns data.data (array)
      if (Array.isArray(data)) {
        const map = data.reduce((acc: any, b: any) => {
          acc[String(b.id)] = b;
          return acc;
        }, {});
        setBranchesMap(map);
      }
    } catch (err) {
      console.error("Failed to load branches for mapping", err);
    }
  };

  const loadInvoices = async (pageNumber: number = 1, isReset: boolean = false) => {
    if (isReset) {
      setLoading(true);
      setPage(1);
    } else {
      setLoadingMore(true);
    }

    try {
      const params: any = {
        page: pageNumber,
      };

      // Add other filters if backend supports them (or for future-proofing)
      if (searchTerm) params.search = searchTerm;
      if (statusFilter !== "all") params.payment_status = statusFilter;
      if (dateFilter) params.date = dateFilter;
      if (branchId) params.branch = branchId;

      const data = await fetchInvoices(params);
      
      let results = [];
      let nextUrl = null;
      let count = 0;

      // Handle paginated response
      if (data && typeof data === 'object' && 'results' in data) {
        results = data.results;
        nextUrl = data.next;
        count = data.count || 0;
      } else if (Array.isArray(data)) {
        // Fallback for non-paginated response
        results = data;
        count = data.length;
      }

      const scoped = branchId != null
          ? results.filter((o: any) => o.branch === branchId || o.branch_id === branchId)
          : results;

      if (isReset) {
        setOrders(scoped);
      } else {
        setOrders(prev => [...prev, ...scoped]);
      }
      
      setHasMore(!!nextUrl);
      setTotalCount(count);
      if (!isReset) setPage(pageNumber);

    } catch (err: any) {
      toast.error(err.message || "Failed to load invoices");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const handleSearchKeyDown = async (e: any) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const term = searchTerm.trim();
      if (!term) return;

      // Loose check for invoice-like format (e.g. 04-2026-...) or common search terms
      setIsFetchingDetail(true);
      try {
        const res = await fetchInvoices({ search: term });
        const results = res.results || res;

        // Try to find an exact invoice number match in the results
        const exactMatch = results.find((o: any) => 
          o.invoice_number.toLowerCase() === term.toLowerCase()
        );

        if (exactMatch) {
          handleRowClick(exactMatch);
          // Also update the list with these search results to keep them in sync
          setOrders(results);
          setTotalCount(res.count || results.length);
          setHasMore(!!res.next);
          return;
        }
      } catch (err) {
        console.error("Direct invoice lookup failed:", err);
      } finally {
        setIsFetchingDetail(false);
      }
      
      // Default: immediate search for other terms/if no exact invoice match
      loadInvoices(1, true);
    }
  };

  const handleRowClick = async (order: any) => {
    setSelectedOrder(order); // Show partial info immediately
    setIsFetchingDetail(true);
    try {
      const fullDetail = await fetchInvoiceDetail(order.id);
      setSelectedOrder(fullDetail);
    } catch (err: any) {
      console.error("Failed to fetch invoice details:", err);
      // We keep the partial info from the list if detail fetch fails
    } finally {
      setIsFetchingDetail(false);
    }
  };

  const handleLoadMore = () => {
    if (!loadingMore && hasMore) {
      loadInvoices(page + 1);
    }
  };

  // Purely client-side filtering for immediate feedback
  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      const matchesSearch = !searchTerm || 
        order.invoice_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (order.customer_name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        String(order.total_amount).includes(searchTerm);
      
      const matchesStatus = statusFilter === "all" || 
        (order.payment_status || "PENDING").toUpperCase() === statusFilter.toUpperCase();
      
      const matchesDate = !dateFilter || 
        (order.created_at && order.created_at.startsWith(dateFilter));
      
      return matchesSearch && matchesStatus && matchesDate;
    });
  }, [orders, searchTerm, statusFilter, dateFilter]);

  const handleExport = () => {
    try {
      const exportData = filteredOrders.map(order => ({
        'Invoice #': order.invoice_number,
        'Created By': order.created_by_name || 'N/A',
        'Customer': order.customer_name?.trim() || 'Walk-in',
        'Date': order.created_at ? format(parseSafeDate(order.created_at)!, 'MMM d, yyyy h:mm a') : 'N/A',
        'Status': order.payment_status || 'PENDING',
        'Total Amount': `${order.total_amount}`
      }));

      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Orders");

      // Generate Excel file and trigger download
      const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
      const data = new Blob([excelBuffer], { type: 'application/octet-stream' });
      saveAs(data, `Orders_Report_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);

      toast.success("Orders exported successfully!");
    } catch (error) {
      console.error("Export failed:", error);
      toast.error("Failed to export orders. Please try again.");
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground">Orders</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">View and manage {totalCount > 0 ? `${totalCount} ` : 'all '}orders</p>
        </div>
        <Button variant="outline" onClick={handleExport} disabled={filteredOrders.length === 0}>
          <Download className="h-4 w-4 mr-2" />
          Export
        </Button>
      </div>

      {/* Filters */}
      <div className="card-elevated p-3 sm:p-4 flex flex-wrap gap-3 sm:gap-4 items-center">
        <div className="relative flex-1 min-w-full sm:min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search orders..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="PENDING">Pending</SelectItem>
            <SelectItem value="PAID">Paid</SelectItem>
            <SelectItem value="WAITER RECEIVED">Waiter Received</SelectItem>
            <SelectItem value="PARTIAL">Partial</SelectItem>
            <SelectItem value="CANCELLED">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        <Input 
          type="date" 
          className="w-full sm:w-[180px]" 
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
        />
      </div>

      {/* Orders Table */}
      <div className="card-elevated overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-6 py-4 text-left font-medium text-muted-foreground">Invoice #</th>
                <th className="px-6 py-4 text-left font-medium text-muted-foreground">Created By</th>
                <th className="px-6 py-4 text-left font-medium text-muted-foreground">Customer</th>
                <th className="px-6 py-4 text-left font-medium text-muted-foreground">Date</th>
                <th className="px-6 py-4 text-left font-medium text-muted-foreground">Status</th>
                <th className="px-6 py-4 text-right font-medium text-muted-foreground">Amount</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Loader2 className="h-8 w-8 text-primary animate-spin" />
                      <p className="text-muted-foreground">Loading invoices...</p>
                    </div>
                  </td>
                </tr>
              ) : filteredOrders.map((order) => (
                <tr
                  key={order.id}
                  className="border-t hover:bg-slate-50 transition-colors cursor-pointer"
                  onClick={() => handleRowClick(order)}
                >
                  <td className="px-6 py-4 font-medium">{order.invoice_number}</td>
                  <td className="px-6 py-4">{order.created_by_name}</td>
                  <td className="px-6 py-4">{order.customer_name?.trim() || 'Walk-in'}</td>
                  <td className="px-6 py-4 text-muted-foreground text-sm">
                    {order.created_at ? format(parseSafeDate(order.created_at)!, 'MMM d, h:mm a') : 'N/A'}
                  </td>
                  <td className="px-6 py-4">
                    <StatusBadge status={(order.payment_status || 'unpaid').toLowerCase()} />
                  </td>
                  <td className="px-6 py-4 text-right font-semibold">Rs.{order.total_amount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredOrders.length === 0 && !loading && (
          <div className="py-12 text-center text-muted-foreground">
            No orders found matching your criteria
          </div>
        )}

        {hasMore && (
          <div className="p-4 border-t flex justify-center bg-muted/20">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleLoadMore} 
              disabled={loadingMore}
              className="gap-2"
            >
              {loadingMore ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading more...
                </>
              ) : (
                <>
                  Load More Orders
                </>
              )}
            </Button>
          </div>
        )}
      </div>

      {/* Order Detail Dialog */}
      <Dialog open={!!selectedOrder} onOpenChange={() => setSelectedOrder(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Invoice {selectedOrder?.invoice_number}</DialogTitle>
          </DialogHeader>

          {selectedOrder && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground font-bold text-[10px] uppercase">Branch</p>
                  <p className="font-medium">{selectedOrder.branch_name}</p>
                </div>
                <div>
                  <p className="text-muted-foreground font-bold text-[10px] uppercase">Created By</p>
                  <p className="font-medium">{selectedOrder.created_by_name}</p>
                </div>
                {(selectedOrder.received_by_waiter_name || selectedOrder.received_by_counter_name) && (
                  <div>
                    <p className="text-muted-foreground font-bold text-[10px] uppercase">Received By</p>
                    <p className="font-medium">{selectedOrder.received_by_waiter_name || selectedOrder.received_by_counter_name}</p>
                  </div>
                )}
                <div>
                  <p className="text-muted-foreground font-bold text-[10px] uppercase">Customer</p>
                  <p className="font-medium">{selectedOrder.customer_name || 'Walk-in'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground font-bold text-[10px] uppercase">Payment Status</p>
                  <StatusBadge status={selectedOrder.payment_status.toLowerCase()} />
                </div>
              </div>

              {selectedOrder.notes && (
                <div className="bg-muted/30 p-2 rounded text-xs italic">
                  <p className="text-muted-foreground font-bold text-[9px] uppercase mb-1">Notes</p>
                  {selectedOrder.notes}
                </div>
              )}

              <div className="border-t pt-4">
                <button 
                  onClick={() => setShowPopupItems(!showPopupItems)}
                  className="w-full flex justify-between items-center text-xs font-bold uppercase text-muted-foreground mb-2 tracking-widest hover:text-primary transition-colors"
                >
                  <span>Items</span>
                  {showPopupItems ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
                
                {isFetchingDetail ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  </div>
                ) : showPopupItems ? (
                  <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-slate-200">
                    {selectedOrder.items?.map((item: any, idx: number) => {
                      const productName = item.product_name || productsMap[String(item.product)]?.name || `Product #${item.product}`;
                      return (
                        <div key={idx} className="flex justify-between text-sm">
                          <div className="flex flex-col text-left">
                            <span className="font-medium">{item.quantity}× {productName}</span>
                          </div>
                          <span className="font-medium">Rs.{(parseFloat(item.unit_price) * item.quantity).toFixed(2)}</span>
                        </div>
                      );
                    })}
                    {(!selectedOrder.items || selectedOrder.items.length === 0) && (
                      <p className="text-xs text-muted-foreground italic">No items recorded</p>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic px-1">Click to expand items ({(selectedOrder.items || []).length})</p>
                )}
              </div>

              <div className="border-t pt-4 space-y-1">
                {isFetchingDetail ? (
                  <div className="flex justify-center py-2">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span>Rs.{selectedOrder.subtotal || '0.00'}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Tax</span>
                      <span>Rs.{selectedOrder.tax_amount || '0.00'}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Discount</span>
                      <span>-Rs.{selectedOrder.discount || '0.00'}</span>
                    </div>
                    <div className="flex justify-between font-bold text-base pt-2 text-primary">
                      <span>Total</span>
                      <span>Rs.{selectedOrder.total_amount}</span>
                    </div>
                    <div className="border-t mt-2 pt-2 space-y-1">
                      <div className="flex justify-between text-xs font-medium text-success">
                        <span>Paid Amount</span>
                        <span>Rs.{selectedOrder.paid_amount || '0.00'}</span>
                      </div>
                      {parseFloat(selectedOrder.due_amount || '0') > 0 && (
                        <div className="flex justify-between text-xs font-medium text-destructive">
                          <span>Due Amount</span>
                          <span>Rs.{selectedOrder.due_amount}</span>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
