import { useState, useEffect } from "react";
import { Outlet } from "react-router-dom";
import { CounterSidebar } from "@/components/layout/CounterSidebar";
import { Sheet, SheetContent } from "@/components/ui/sheet";

export function CounterLayout() {
    const [sidebarOpen, setSidebarOpen] = useState(false);

    useEffect(() => {
        const handleOpenSidebar = () => {
            setSidebarOpen(true);
        };
        window.addEventListener("open-counter-sidebar", handleOpenSidebar);
        return () => {
            window.removeEventListener("open-counter-sidebar", handleOpenSidebar);
        };
    }, []);

    return (
        <div className="min-h-screen bg-slate-50/50 flex">
            {/* Desktop Sidebar */}
            <aside className="fixed left-0 top-0 z-[60] h-screen w-64 hidden md:block border-r bg-white shrink-0">
                <CounterSidebar />
            </aside>

            {/* Mobile Sidebar Sheet */}
            <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
                <SheetContent side="left" className="p-0 w-64 border-r-0 z-[100]">
                    <CounterSidebar onNavigate={() => setSidebarOpen(false)} />
                </SheetContent>
            </Sheet>

            {/* Main Content Area */}
            <div className="flex-1 md:pl-64 min-h-screen flex flex-col overflow-hidden">
                <main className="flex-1 flex flex-col overflow-hidden">
                    <Outlet />
                </main>
            </div>
        </div>
    );
}
