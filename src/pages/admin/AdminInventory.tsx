import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  Search,
  Loader2,
  Pencil,
  Trash2,
  ArrowUpDown,
  Filter,
  Package,
  TrendingUp,
  History,
  ChevronDown,
  Minus
} from "lucide-react";
import { toast } from "sonner";
import { fetchProducts, createProduct, updateProduct, deleteProduct, fetchCategories, addItemActivity, fetchItemActivity } from "../../api/index.js";

interface Product {
  id: number;
  name: string;
  cost_price: string;
  selling_price: string;
  product_quantity: number;
  low_stock_bar: number;
  category: number;
  category_name: string;
  branch_id: number;
  branch_name: string;
  date_added: string;
  is_available: boolean;
}

interface BackendCategory {
  id: number;
  name: string;
  branch: number;
  branch_name: string;
}

interface ActivityLog {
  id: number;
  product: number;
  product_detail: string;
  types: "ADD_STOCK" | "REDUCE_STOCK" | "INITIAL_STOCK" | "UPDATE_STOCK";
  change: string;
  quantity: number;
  created_at: string;
  remarks: string;
}

export default function AdminInventory() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<BackendCategory[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);

  // Selection State
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);

  // Dialog States
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isAdjustStockOpen, setIsAdjustStockOpen] = useState(false);
  const [stockActionType, setStockActionType] = useState<"add" | "reduce">("add");
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [loadingActivity, setLoadingActivity] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [productsResponse, categoriesData] = await Promise.all([
        fetchProducts({ page_size: 1000 }),
        fetchCategories()
      ]);

      const productsData = productsResponse?.results || (Array.isArray(productsResponse) ? productsResponse : []);

      setProducts(productsData);
      setCategories(categoriesData);

      // Select first product by default if available and none selected
      if (productsData.length > 0 && !selectedProductId) {
        setSelectedProductId(productsData[0].id);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const loadActivity = async (productId: number) => {
    setLoadingActivity(true);
    try {
      const data = await fetchItemActivity(productId);
      setActivityLogs(data || []);
    } catch (err: any) {
      console.error("Failed to load activity:", err);
      setActivityLogs([]);
    } finally {
      setLoadingActivity(false);
    }
  };

  useEffect(() => {
    if (selectedProductId) {
      loadActivity(selectedProductId);
    } else {
      setActivityLogs([]);
    }
  }, [selectedProductId]);

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.category_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedProduct = products.find(p => p.id === selectedProductId);

  // Handle Product Create/Update
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    const formData = new FormData(e.currentTarget);
    const is_available = e.currentTarget.querySelector<HTMLButtonElement>('[role="switch"]')?.['aria-checked' as any] === 'true';

    const payload = {
      name: formData.get("name"),
      cost_price: formData.get("cost_price"),
      selling_price: formData.get("selling_price"),
      product_quantity: parseInt(formData.get("product_quantity") as string),
      low_stock_bar: parseInt(formData.get("low_stock_bar") as string),
      category: parseInt(formData.get("category") as string),
      is_available: is_available !== undefined ? is_available : true
    };

    try {
      if (editProduct) {
        const updated = await updateProduct(editProduct.id, payload);
        setProducts(prev => prev.map(p => p.id === editProduct.id ? updated : p));
        toast.success("Product updated");

        // Log Update Activity
        addActivity(editProduct.id, "Update", "0", payload.product_quantity, "Product details updated");
      } else {
        const newProduct = await createProduct(payload);
        setProducts(prev => [...prev, newProduct]);
        toast.success("Product added");
        setSelectedProductId(newProduct.id); // Select new product

        // Init Activity
        addActivity(newProduct.id, "Initial", `+${newProduct.product_quantity}`, newProduct.product_quantity, "Opening Stock");
      }
      setIsDialogOpen(false);
      setEditProduct(null);
      if (selectedProductId) {
        loadActivity(selectedProductId);
      }
    } catch (err: any) {
      toast.error(err.message || "Operation failed");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (productId: number) => {
    if (!confirm("Are you sure you want to delete this product?")) return;
    try {
      const data = await deleteProduct(productId);
      setProducts(prev => prev.filter(p => p.id !== productId));

      // If deleted product was selected, select another
      if (selectedProductId === productId) {
        const remaining = products.filter(p => p.id !== productId);
        setSelectedProductId(remaining.length > 0 ? remaining[0].id : null);
      }
      toast.success(data.message || "Product deleted");
    } catch (err: any) {
      toast.error(err.message || "Delete failed");
    }
  };

  // Stock Adjustment Handler
  const handleAdjustStock = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedProduct) return;

    setSubmitting(true);
    const formData = new FormData(e.currentTarget);
    const type = formData.get("type") as "add" | "reduce";
    const quantity = parseInt(formData.get("quantity") as string);
    const remarks = formData.get("remarks") as string;

    if (!quantity || quantity <= 0) {
      toast.error("Please enter a valid quantity");
      setSubmitting(false);
      return;
    }

    const newQuantity = type === "add"
      ? selectedProduct.product_quantity + quantity
      : selectedProduct.product_quantity - quantity;

    if (newQuantity < 0) {
      toast.error("Insufficient stock!");
      setSubmitting(false);
      return;
    }

    try {
      const res = await addItemActivity(selectedProduct.id, stockActionType, {
        change: quantity,
        remarks: remarks || ""
      });

      if (res.success) {
        // Update product quantity in local state
        const updatedQuantity = res.data.quantity;
        setProducts(prev => prev.map(p => p.id === selectedProduct.id ? { ...p, product_quantity: updatedQuantity } : p));

        // Refresh activity logs
        loadActivity(selectedProduct.id);

        toast.success(res.message || "Stock adjusted successfully");
        setIsAdjustStockOpen(false);
      }
    } catch (err: any) {
      toast.error(err.message || "Stock adjustment failed");
    } finally {
      setSubmitting(false);
    }
  };


  const currentActivity = activityLogs;

  const stockValue = selectedProduct
    ? (selectedProduct.product_quantity * parseFloat(selectedProduct.cost_price)).toFixed(2)
    : "0.00";

  return (
    <div className="flex h-[calc(100vh-100px)] gap-6 p-6 overflow-hidden">

      {/* Left Sidebar: Product List */}
      <div className="w-1/4 min-w-[300px] flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-800">Products({filteredProducts.length})</h2>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => setEditProduct(null)} size="sm" className="bg-primary text-white hover:bg-primary/90 rounded-lg text-xs font-bold">
                <Plus className="h-3 w-3 mr-1" /> Add Product
              </Button>
            </DialogTrigger>
            {/* Product Form Logic reused here */}
            <DialogContent className="max-w-2xl rounded-3xl">
              <DialogHeader>
                <DialogTitle className="text-2xl font-black uppercase tracking-tight">
                  {editProduct ? 'Edit Product' : 'Add New Product'}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4 pt-4">
                {/* Same Form Fields as before */}
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-[10px] font-black uppercase tracking-widest text-slate-400 pl-1">Product Name</Label>
                  <Input id="name" name="name" className="h-12 text-lg rounded-2xl bg-slate-50 border border-slate-200" placeholder="Enter product name" defaultValue={editProduct?.name} required />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="cost_price" className="text-[10px] font-black uppercase tracking-widest text-slate-400 pl-1">Cost Price (Rs.)</Label>
                    <Input id="cost_price" name="cost_price" className="h-12 rounded-2xl bg-slate-50 border border-slate-200" type="number" step="0.01" defaultValue={editProduct?.cost_price} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="selling_price" className="text-[10px] font-black uppercase tracking-widest text-slate-400 pl-1">Selling Price (Rs.)</Label>
                    <Input id="selling_price" name="selling_price" className="h-12 rounded-2xl bg-slate-50 border border-slate-200 font-bold text-primary" type="number" step="0.01" defaultValue={editProduct?.selling_price} required />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="product_quantity" className="text-[10px] font-black uppercase tracking-widest text-slate-400 pl-1">Current Stock</Label>
                    <Input id="product_quantity" name="product_quantity" className="h-12 rounded-2xl bg-slate-50 border border-slate-200" type="number" defaultValue={editProduct?.product_quantity} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="low_stock_bar" className="text-[10px] font-black uppercase tracking-widest text-slate-400 pl-1">Low Stock Limit</Label>
                    <Input id="low_stock_bar" name="low_stock_bar" className="h-12 rounded-2xl bg-slate-50 border border-slate-200" type="number" defaultValue={editProduct?.low_stock_bar} required />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 items-end">
                  <div className="space-y-2">
                    <Label htmlFor="category" className="text-[10px] font-black uppercase tracking-widest text-slate-400 pl-1">Category</Label>
                    <Select name="category" defaultValue={editProduct?.category?.toString()}>
                      <SelectTrigger className="h-12 rounded-2xl bg-slate-50 border border-slate-200">
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent className="rounded-2xl border-none shadow-2xl">
                        {categories.map(cat => (
                          <SelectItem key={cat.id} value={cat.id.toString()} className="rounded-xl my-1">{cat.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center space-x-3 pb-2.5 pl-2">
                    <Switch id="is_available" defaultChecked={editProduct?.is_available ?? true} />
                    <Label htmlFor="is_available" className="text-sm font-bold text-slate-600">Available for Sale</Label>
                  </div>
                </div>
                <div className="flex gap-3 pt-6">
                  <Button type="button" variant="outline" className="flex-1 h-12 rounded-2xl font-bold" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                  <Button type="submit" className="flex-1 h-12 rounded-2xl font-bold" disabled={submitting}>
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : (editProduct ? 'Update Product' : 'Add Product')}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search products..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 h-10 bg-slate-100 border-none rounded-xl"
          />
        </div>

        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="rounded-lg h-8 text-xs font-bold bg-slate-50 border-slate-200">
            <ArrowUpDown className="h-3 w-3 mr-1" /> Sort By
          </Button>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          <Badge variant="secondary" className="rounded-lg px-3 py-1 bg-slate-200 text-slate-700 hover:bg-slate-300 cursor-pointer">All Category</Badge>
          <Badge variant="outline" className="rounded-lg px-3 py-1 border-slate-200 text-slate-500 hover:bg-slate-50 cursor-pointer">All Stock</Badge>
          <Badge variant="outline" className="rounded-lg px-3 py-1 border-slate-200 text-slate-500 hover:bg-slate-50 cursor-pointer">All Items</Badge>
        </div>

        <div className="flex-1 overflow-y-auto space-y-2 pr-2">
          {loading ? (
            <div className="text-center py-10 text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>
          ) : filteredProducts.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground text-sm">No products found</div>
          ) : (
            filteredProducts.map(product => (
              <div
                key={product.id}
                onClick={() => setSelectedProductId(product.id)}
                className={`p-3 rounded-xl cursor-pointer transition-all ${selectedProductId === product.id ? 'bg-primary shadow-lg scale-[1.02] border-primary' : 'bg-white hover:bg-slate-50 border-transparent'} border`}
              >
                <div className="flex justify-between items-center mb-1">
                  <h3 className={`font-bold text-sm ${selectedProductId === product.id ? 'text-primary-foreground' : 'text-slate-700'}`}>{product.name}</h3>
                  {product.product_quantity <= product.low_stock_bar && (
                    <Badge variant={selectedProductId === product.id ? "secondary" : "destructive"} className="h-5 px-1.5 text-[10px]">Low</Badge>
                  )}
                </div>
                <p className={`text-xs ${selectedProductId === product.id ? 'text-primary-foreground/90' : 'text-slate-400'}`}>{product.product_quantity} units</p>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Right Details Pane */}
      <div className="flex-1 bg-slate-50 rounded-[2rem] p-8 overflow-y-auto w-3/4">
        {selectedProduct ? (
          <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
            {/* Header Row */}
            <div className="flex items-center justify-between">
              <h1 className="text-3xl font-black text-slate-900">{selectedProduct.name}</h1>
              <div className="flex gap-2">
                <Button
                  className="bg-primary hover:bg-primary/90 text-white rounded-xl h-10 px-4 font-bold text-xs shadow-lg shadow-primary/20"
                  onClick={() => {
                    setEditProduct(selectedProduct);
                    setIsDialogOpen(true);
                  }}
                >
                  <Pencil className="h-3 w-3 mr-2" /> Edit Item
                </Button>
                <Button
                  className="bg-red-500 hover:bg-red-600 text-white rounded-xl h-10 px-4 font-bold text-xs"
                  onClick={() => handleDelete(selectedProduct.id)}
                >
                  <Trash2 className="h-3 w-3 mr-2" /> Delete Item
                </Button>
              </div>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-4 gap-8 py-6 border-b border-slate-200">
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Stock Quantity</p>
                <p className="text-2xl font-black text-slate-900">{selectedProduct.product_quantity}</p>
              </div>
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Selling Price</p>
                <p className="text-2xl font-black text-slate-900">Rs.{selectedProduct.selling_price}</p>
              </div>
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Purchase Price</p>
                <p className="text-2xl font-black text-slate-900">Rs.{selectedProduct.cost_price}</p>
              </div>
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Stock Value</p>
                <p className="text-2xl font-black text-slate-900">Rs.{stockValue}</p>
              </div>
            </div>

            {/* Activity Section */}
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-slate-800">Activity({currentActivity.length})</h2>
                <div className="flex gap-2">
                  <div className="relative w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400" />
                    <Input className="h-9 pl-9 bg-white border-slate-200 rounded-lg text-xs" placeholder="Search activity..." />
                  </div>
                  <Button variant="outline" size="sm" className="h-9 rounded-lg text-xs font-bold bg-white border-slate-200">
                    <ArrowUpDown className="h-3 w-3 mr-1" /> Sort By
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="sm" className="h-9 rounded-lg text-xs font-bold bg-primary hover:bg-primary/90 text-white gap-2 shadow-lg shadow-primary/20">
                        Adjust Stock <ChevronDown className="h-3 w-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="rounded-xl">
                      <DropdownMenuItem
                        onClick={() => {
                          setStockActionType("add");
                          setIsAdjustStockOpen(true);
                        }}
                        className="font-bold text-emerald-600 focus:text-emerald-700 focus:bg-emerald-50 cursor-pointer"
                      >
                        <Plus className="h-3 w-3 mr-2" /> Add Stock
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => {
                          setStockActionType("reduce");
                          setIsAdjustStockOpen(true);
                        }}
                        className="font-bold text-red-600 focus:text-red-700 focus:bg-red-50 cursor-pointer"
                      >
                        <Minus className="h-3 w-3 mr-2" /> Reduce Stock
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <Dialog open={isAdjustStockOpen} onOpenChange={setIsAdjustStockOpen}>
                    <DialogContent className="max-w-md rounded-3xl">
                      <DialogHeader>
                        <DialogTitle className="text-xl font-black flex items-center gap-2">
                          {stockActionType === "add" ? (
                            <div className="flex items-center text-emerald-600 gap-2">
                              <div className="p-2 bg-emerald-100 rounded-lg"><Plus className="h-5 w-5" /></div>
                              Add Stock
                            </div>
                          ) : (
                            <div className="flex items-center text-red-600 gap-2">
                              <div className="p-2 bg-red-100 rounded-lg"><Minus className="h-5 w-5" /></div>
                              Reduce Stock
                            </div>
                          )}
                        </DialogTitle>
                      </DialogHeader>
                      <form onSubmit={handleAdjustStock} className="space-y-4 pt-4">
                        <input type="hidden" name="type" value={stockActionType} />

                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Current Stock</p>
                          <p className="text-xl font-black text-slate-900">{selectedProduct?.product_quantity} units</p>
                        </div>

                        <div className="space-y-2">
                          <Label className="text-xs font-bold uppercase text-slate-400">
                            Quantity to {stockActionType === "add" ? "Add" : "Reduce"}
                          </Label>
                          <Input name="quantity" type="number" min="1" className="h-12 rounded-xl bg-slate-50 border-slate-200 text-lg font-bold" placeholder="0" required />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs font-bold uppercase text-slate-400">Remarks</Label>
                          <Input name="remarks" className="h-12 rounded-xl bg-slate-50 border-slate-200" placeholder="Reason for adjustment..." />
                        </div>
                        <Button
                          type="submit"
                          className={`w-full h-12 rounded-xl font-bold mt-2 ${stockActionType === 'add' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'}`}
                          disabled={submitting}
                        >
                          {submitting ? <Loader2 className="animate-spin" /> : (stockActionType === 'add' ? "Confirm Addition" : "Confirm Reduction")}
                        </Button>
                      </form>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>

              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-100">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Type</th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Date</th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Change</th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Quantity</th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Remarks</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {loadingActivity ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-8 text-center text-sm text-slate-400">
                          <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
                          Loading history...
                        </td>
                      </tr>
                    ) : currentActivity.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-8 text-center text-sm text-slate-400">
                          No history found for this product.
                        </td>
                      </tr>
                    ) : (
                      currentActivity.map(log => (
                        <tr key={log.id} className="hover:bg-slate-50">
                          <td className="px-6 py-4 text-sm font-bold text-slate-700">
                            {log.types === "ADD_STOCK" ? "Add Stock" :
                              log.types === "REDUCE_STOCK" ? "Reduce Stock" :
                                log.types === "INITIAL_STOCK" ? "Opening Stock" : "Update"}
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-500 font-medium">
                            {new Date(log.created_at).toLocaleString()}
                          </td>
                          <td className={`px-6 py-4 text-sm font-bold ${log.types.includes('ADD') ? 'text-emerald-500' : 'text-red-500'}`}>
                            {log.types.includes('ADD') ? `+${log.change}` : `-${log.change}`}
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-700 font-bold">{log.quantity}</td>
                          <td className="px-6 py-4 text-sm text-slate-500">{log.remarks || "-"}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-slate-300">
            <Package className="h-16 w-16 mb-4 opacity-20" />
            <p className="font-bold text-lg">Select a product to view details</p>
          </div>
        )}
      </div>
    </div>
  );
}
