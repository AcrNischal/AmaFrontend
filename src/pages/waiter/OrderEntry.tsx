import { useState, useMemo, useEffect } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { MobileHeader } from "@/components/layout/MobileHeader";
import { MenuItemCard } from "@/components/waiter/MenuItemCard";
import { CartItem } from "@/components/waiter/CartItem";
import { WaiterBottomNav } from "@/components/waiter/WaiterBottomNav";
import { MenuItem } from "@/lib/mockData";
import { saveTableOrder } from "@/lib/orderStorage";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { ShoppingCart, Search, X, Receipt, Loader2, Check } from "lucide-react";
import { toast } from "sonner";
import { fetchProducts, fetchCategories } from "../../api/index.js";

interface CartItemData {
  item: MenuItem;
  quantity: number;
  notes?: string;
}

export default function OrderEntry() {
  const navigate = useNavigate();
  const { tableNumber } = useParams();
  const [searchParams] = useSearchParams();

  const [products, setProducts] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [cart, setCart] = useState<CartItemData[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [orderSent, setOrderSent] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

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

      // Map backend products to MenuItem interface
      const mappedProducts: MenuItem[] = productsData.map((p: any) => ({
        id: p.id.toString(),
        name: p.name,
        price: parseFloat(p.selling_price),
        category: p.category_name,
        available: p.is_available,
        image: p.image || undefined
      }));

      setProducts(mappedProducts);

      const categoryNames = categoriesData.map((cat: any) => cat.name).sort();
      setCategories(categoryNames);

      if (categoryNames.length > 0) {
        // We default to "All" (empty string), so no need to set initial category
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to load menu data");
    } finally {
      setLoading(false);
    }
  };

  // Save cart to storage whenever it changes
  useEffect(() => {
    if (tableNumber && cart.length > 0) {
      saveTableOrder(tableNumber, cart);
    }
  }, [cart, tableNumber]);

  const filteredItems = useMemo(() => {
    let items = products;

    if (selectedCategory) {
      items = items.filter(item => item.category === selectedCategory);
    }

    if (searchQuery.trim()) {
      items = items.filter(item =>
        item.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    return items;
  }, [products, selectedCategory, searchQuery]);

  const cartTotal = useMemo(() =>
    cart.reduce((sum, c) => sum + (c.item.price * c.quantity), 0),
    [cart]
  );

  const cartCount = useMemo(() =>
    cart.reduce((sum, c) => sum + c.quantity, 0),
    [cart]
  );

  const getItemQuantity = (itemId: string) => {
    const cartItem = cart.find(c => c.item.id === itemId);
    return cartItem?.quantity || 0;
  };

  const addToCart = (item: MenuItem) => {
    setCart(prev => {
      const existing = prev.find(c => c.item.id === item.id);
      if (existing) {
        return prev.map(c =>
          c.item.id === item.id
            ? { ...c, quantity: c.quantity + 1 }
            : c
        );
      }
      return [...prev, { item, quantity: 1 }];
    });
  };

  const removeFromCart = (item: MenuItem) => {
    setCart(prev => {
      const existing = prev.find(c => c.item.id === item.id);
      if (existing && existing.quantity > 1) {
        return prev.map(c =>
          c.item.id === item.id
            ? { ...c, quantity: c.quantity - 1 }
            : c
        );
      }
      return prev.filter(c => c.item.id !== item.id);
    });
  };

  const setQuantity = (item: MenuItem, quantity: number) => {
    setCart(prev => {
      const existing = prev.find(c => c.item.id === item.id);
      if (quantity <= 0) {
        return prev.filter(c => c.item.id !== item.id);
      }
      if (existing) {
        return prev.map(c =>
          c.item.id === item.id
            ? { ...c, quantity }
            : c
        );
      }
      return [...prev, { item, quantity }];
    });
  };

  const deleteFromCart = (itemId: string) => {
    setCart(prev => prev.filter(c => c.item.id !== itemId));
  };

  const updateNotes = (itemId: string, notes: string) => {
    setCart(prev => prev.map(c =>
      c.item.id === itemId ? { ...c, notes } : c
    ));
  };

  const handleSendOrder = () => {
    setIsCartOpen(false);
    proceedToCheckout();
  };

  const proceedToCheckout = () => {
    navigate('/waiter/checkout', {
      state: {
        cart,
        tableNumber,
        floorId: searchParams.get('floorId'),
      }
    });
  };

  return (
    <div className="min-h-screen bg-background pb-24 text-left">
      <MobileHeader
        title={`Table ${tableNumber}`}
        showBack
      />

      {/* Search Bar */}
      <div className="sticky top-[60px] z-50 glass-panel border-b px-4 py-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search products..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 pr-10 h-12 text-base bg-background/50 border-border/50 focus:border-primary transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>

      {/* Category Tabs */}
      <div className="sticky top-[120px] z-40 glass-panel border-b px-4 py-3 overflow-x-auto scrollbar-hide">
        <div className="flex gap-2">
          <Button
            variant={selectedCategory === "" ? "default" : "secondary"}
            size="sm"
            className="shrink-0"
            onClick={() => setSelectedCategory("")}
          >
            All
          </Button>
          {categories.map((category) => (
            <Button
              key={category}
              variant={selectedCategory === category ? "default" : "secondary"}
              size="sm"
              className="shrink-0"
              onClick={() => setSelectedCategory(category)}
            >
              {category}
            </Button>
          ))}
        </div>
      </div>

      {/* Menu Items */}
      <main className="p-4 space-y-3">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="h-10 w-10 animate-spin text-primary/30" />
            <p className="text-muted-foreground mt-4 font-medium">Loading menu items...</p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Search className="h-12 w-12 mb-3 opacity-50" />
            <p className="text-lg font-medium">No products found</p>
            <p className="text-sm">Try searching with different keywords</p>
          </div>
        ) : (
          filteredItems.map((item) => (
            <MenuItemCard
              key={item.id}
              item={item}
              quantity={getItemQuantity(item.id)}
              onAdd={addToCart}
              onRemove={removeFromCart}
              onSetQuantity={setQuantity}
            />
          ))
        )}
      </main>

      {/* Cart Sheet */}
      <Sheet open={isCartOpen} onOpenChange={setIsCartOpen}>
        <SheetContent side="bottom" className="h-[80vh] rounded-t-2xl">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-primary" />
              Your Order
            </SheetTitle>
          </SheetHeader>

          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
              <ShoppingCart className="h-12 w-12 mb-3 opacity-50" />
              <p>Your cart is empty</p>
              <p className="text-sm">Add items from the menu</p>
            </div>
          ) : (
            <>
              <div className="mt-4 space-y-3 max-h-[calc(80vh-200px)] overflow-y-auto">
                {cart.map((cartItem) => (
                  <CartItem
                    key={cartItem.item.id}
                    item={cartItem.item}
                    quantity={cartItem.quantity}
                    notes={cartItem.notes}
                    onAdd={() => addToCart(cartItem.item)}
                    onRemove={() => removeFromCart(cartItem.item)}
                    onDelete={() => deleteFromCart(cartItem.item.id)}
                    onNotesChange={(notes) => updateNotes(cartItem.item.id, notes)}
                  />
                ))}
              </div>

              <div className="absolute bottom-0 left-0 right-0 p-4 bg-card border-t">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-muted-foreground">Total</span>
                  <span className="text-2xl font-bold text-primary">Rs.{cartTotal}</span>
                </div>
                <Button
                  className="w-full btn-touch gradient-warm"
                  onClick={handleSendOrder}
                  disabled={orderSent}
                >
                  {orderSent ? (
                    <>
                      <Check className="h-5 w-5 mr-2" />
                      Order Sent!
                    </>
                  ) : (
                    <>
                      <Receipt className="h-5 w-5 mr-2" />
                      Proceed to Checkout
                    </>
                  )}
                </Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Floating Cart Button */}
      {cart.length > 0 && (
        <div className="fixed bottom-20 left-4 right-4 z-50">
          <Button
            className="w-full h-16 rounded-[1.5rem] gradient-warm shadow-xl shadow-primary/20 flex items-center justify-between px-6 transition-all active:scale-95"
            onClick={() => setIsCartOpen(true)}
          >
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-sm">
                  <ShoppingCart className="h-6 w-6 text-white" />
                </div>
                <span className="absolute -top-2 -right-2 min-w-[22px] px-1.5 h-6 rounded-full bg-white text-primary text-[11px] flex items-center justify-center font-black border-2 border-primary shadow-sm">
                  {cartCount}
                </span>
              </div>
              <span className="font-black uppercase tracking-wider text-sm">View Order</span>
            </div>
            <span className="font-black text-lg">Rs.{cartTotal}</span>
          </Button>
        </div>
      )}

      {/* Bottom Navigation */}
      <WaiterBottomNav />
    </div>
  );
}
