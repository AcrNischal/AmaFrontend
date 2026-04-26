import { useState, useEffect } from "react";
import { Store, MapPin, Search, Filter, Plus, Trash2, Loader2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { fetchBranches, createBranch, deleteBranch, createUser, updateBranch, createTable, fetchTables } from "../../api/index.js";

interface Branch {
    id: number;
    name: string;
    location: string;
    status?: string;
    branch_manager?: {
        id: number;
        username: string;
        email: string;
        total_user: number;
    } | null;
    revenue?: number;
    total_tables?: number;
}

export default function SuperAdminBranches() {
    const [branches, setBranches] = useState<Branch[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [isDetailsOpen, setIsDetailsOpen] = useState(false);

    const [isEditOpen, setIsEditOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null);
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const [branchToDelete, setBranchToDelete] = useState<Branch | null>(null);

    const [form, setForm] = useState({
        name: "",
        location: "",
        showManager: false,
        manager_username: "",
        manager_full_name: "",
        manager_email: "",
        manager_phone: "",
    });

    const [editForm, setEditForm] = useState({
        name: "",
        location: ""
    });

    useEffect(() => {
        loadBranches();
    }, []);

    const loadBranches = async () => {
        setLoading(true);
        try {
            const [branchRes, tableRes] = await Promise.all([
                fetchBranches(),
                fetchTables()
            ]);

            const branchesData = branchRes.data || [];
            const tablesData = tableRes || [];

            const merged = branchesData.map((b: Branch) => {
                const tableInfo = tablesData.find((t: any) => t.branch === b.id);
                return {
                    ...b,
                    total_tables: tableInfo ? tableInfo.table_count : 0
                };
            });

            setBranches(merged);
        } catch (err: any) {
            toast.error(err.message || "Failed to load branches");
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async () => {
        if (!form.name || !form.location) {
            toast.error("Please fill Name and Location");
            return;
        }

        if (form.showManager) {
            if (!form.manager_username || !form.manager_full_name || !form.manager_email) {
                toast.error("Please provide Username, Full Name and Email for the new manager");
                return;
            }
        }

        setIsSubmitting(true);
        try {
            // 1. Create Branch
            const branchRes = await createBranch({
                name: form.name,
                location: form.location
            });

            const newBranchId = branchRes.data.id;

            // 3. Handle New Manager (Only if opted-in)
            if (form.showManager) {
                await createUser({
                    username: form.manager_username,
                    full_name: form.manager_full_name,
                    email: form.manager_email,
                    phone: form.manager_phone,
                    user_type: "BRANCH_MANAGER",
                    branch: newBranchId,
                    password: "amabakery@123"
                });
                toast.success(`Branch created and manager ${form.manager_username} registered`);
            } else {
                toast.success(`Branch created successfully`);
            }

            setIsAddOpen(false);
            setForm({
                name: "",
                location: "",
                showManager: false,
                manager_username: "",
                manager_full_name: "",
                manager_email: "",
                manager_phone: "",
            });
            loadBranches();
        } catch (err: any) {
            toast.error(err.message || "Failed to create branch");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async () => {
        if (!branchToDelete) return;

        try {
            const response = await deleteBranch(branchToDelete.id);
            toast.success(response.message || "Branch deleted");
            setIsDeleteOpen(false);
            setBranchToDelete(null);
            loadBranches();
        } catch (err: any) {
            toast.error(err.message || "Failed to delete branch");
        }
    };

    const openDetailsModal = (branch: Branch) => {
        setSelectedBranch(branch);
        setIsDetailsOpen(true);
    };

    const handleEditFromDetails = () => {
        setIsDetailsOpen(false);
        setTimeout(() => {
            setEditForm({
                name: selectedBranch?.name || "",
                location: selectedBranch?.location || ""
            });
            setIsEditOpen(true);
        }, 100);
    };

    const handleUpdate = async () => {
        if (!editForm.name || !editForm.location) {
            toast.error("Please fill all fields");
            return;
        }
        if (!selectedBranch) return;

        setIsSubmitting(true);
        try {
            const response = await updateBranch(selectedBranch.id, editForm);
            toast.success(response.message || "Branch updated successfully");
            setIsEditOpen(false);
            loadBranches();
        } catch (err: any) {
            toast.error(err.message || "Failed to update branch");
        } finally {
            setIsSubmitting(false);
        }
    };

    const filteredBranches = branches.filter(b =>
        b.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.location.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-xl sm:text-2xl md:text-3xl font-black tracking-tight text-slate-900">All Branches</h1>
                    <p className="text-sm text-muted-foreground font-medium">
                        {loading ? "Loading branches..." : `Manage your ${branches.length} locations.`}
                    </p>
                </div>
                <Button
                    onClick={() => setIsAddOpen(true)}
                    className="gradient-warm text-white font-black uppercase tracking-widest text-[10px] sm:text-xs h-9 sm:h-10 px-4 rounded-xl"
                >
                    <Plus className="h-4 w-4 mr-2" />
                    New Branch
                </Button>
            </div>

            <div className="card-elevated p-4 md:p-6 border-2 border-slate-50 rounded-[2rem]">
                <div className="relative mb-6">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                    <Input
                        placeholder="Search branches..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="h-11 sm:h-14 pl-12 pr-4 rounded-2xl bg-slate-50/50 border-slate-100 focus:bg-white focus:ring-primary shadow-sm text-base sm:text-lg font-medium"
                    />
                </div>

                {loading ? (
                    // ... (Loader) ...
                    <div className="flex flex-col items-center justify-center py-20">
                        <Loader2 className="h-10 w-10 animate-spin text-primary/30" />
                        <p className="text-muted-foreground mt-4 font-medium">Fetching branches...</p>
                    </div>
                ) : filteredBranches.length === 0 ? (
                    // ... (Empty State) ...
                    <div className="text-center py-10 text-muted-foreground">
                        <Store className="h-12 w-12 mx-auto mb-3 opacity-20" />
                        <p>No branches found.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                        {filteredBranches.map(branch => (
                            <div
                                key={branch.id}
                                className="group relative bg-white border border-slate-100 rounded-2xl p-5 hover:shadow-lg hover:border-primary/20 transition-all cursor-pointer"
                                onClick={() => openDetailsModal(branch)}
                            >
                                <div className="absolute top-4 right-4 flex gap-2">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-lg"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setBranchToDelete(branch);
                                            setIsDeleteOpen(true);
                                        }}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>

                                <div className="h-12 w-12 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center mb-4 group-hover:bg-primary group-hover:text-white transition-colors">
                                    <Store className="h-6 w-6" />
                                </div>

                                <h3 className="text-base sm:text-lg font-bold text-slate-900 mb-1">{branch.name}</h3>
                                <div className="flex items-center text-sm text-muted-foreground mb-4">
                                    <MapPin className="h-4 w-4 mr-1" />
                                    {branch.location}
                                </div>

                                <div className="grid grid-cols-3 gap-2 items-center text-sm py-3 border-t border-slate-50">
                                    <div>
                                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Manager</p>
                                        <p className="font-semibold text-slate-700 truncate">{branch.branch_manager?.username || "N/A"}</p>
                                    </div>
                                    <div className="text-center">
                                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Tables</p>
                                        <p className="font-bold text-primary">{branch.total_tables || 0}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Staff</p>
                                        <p className="font-semibold text-slate-700">{branch.branch_manager?.total_user || 0}</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Details Dialog */}
            <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
                <DialogContent className="sm:max-w-[425px] rounded-[2rem] overflow-hidden">
                    <DialogHeader className="bg-slate-50/50 p-4 sm:p-6 border-b border-slate-100">
                        <DialogTitle className="text-lg sm:text-xl font-black text-slate-900 flex items-center gap-3">
                            <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                                <Store className="h-4 w-4 sm:h-5 sm:w-5" />
                            </div>
                            Branch Details
                        </DialogTitle>
                    </DialogHeader>

                    <div className="p-6 space-y-6">
                        <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-1">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Branch Name</Label>
                                <p className="font-bold text-base text-slate-900">{selectedBranch?.name}</p>
                            </div>
                            <div className="space-y-1 text-right">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Location</Label>
                                <p className="font-bold text-base text-slate-900 flex items-center justify-end gap-1">
                                    <MapPin className="h-3 w-3 text-slate-400" />
                                    {selectedBranch?.location}
                                </p>
                            </div>
                             <div className="space-y-1">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total Tables</Label>
                                <p className="font-black text-lg sm:text-xl text-primary">{selectedBranch?.total_tables || 0}</p>
                            </div>
                            <div className="space-y-1 text-right">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Lifetime Revenue</Label>
                                <p className="font-black text-lg sm:text-xl text-emerald-600">Rs. {(parseFloat(selectedBranch?.revenue as any) || 0).toLocaleString()}</p>
                            </div>
                        </div>

                        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-3">
                            <div className="flex items-center justify-between">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-primary">Manager Information</Label>
                                <Badge variant="outline" className="text-[10px] font-bold bg-white">{selectedBranch?.branch_manager ? "Active" : "Unassigned"}</Badge>
                            </div>
                            {selectedBranch?.branch_manager ? (
                                <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 font-black text-sm">
                                        {selectedBranch.branch_manager.username.substring(0, 2).toUpperCase()}
                                    </div>
                                    <div>
                                        <p className="font-bold text-slate-900 text-sm">{selectedBranch.branch_manager.username}</p>
                                        <p className="text-xs text-slate-500 font-medium">{selectedBranch.branch_manager.email}</p>
                                    </div>
                                </div>
                            ) : (
                                <p className="text-xs text-muted-foreground italic">No manager assigned to this branch.</p>
                            )}
                        </div>
                    </div>

                    <DialogFooter className="bg-slate-50/50 p-4 sm:p-6 flex flex-col !flex-col gap-2 sm:space-x-0">
                        <Button
                            onClick={handleEditFromDetails}
                            className="w-full h-10 sm:h-12 rounded-xl gradient-warm text-white font-black uppercase tracking-widest text-[10px] sm:text-xs shadow-lg shadow-orange-200"
                        >
                            <Pencil className="h-3 w-3 sm:h-4 sm:w-4 mr-2" />
                            Edit Branch Details
                        </Button>
                        <Button
                            variant="ghost"
                            onClick={() => setIsDetailsOpen(false)}
                            className="w-full h-10 sm:h-12 rounded-xl font-bold text-slate-400 hover:text-slate-600 text-xs sm:text-sm"
                        >
                            Close
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                <DialogContent className="sm:max-w-[500px] rounded-[2rem] overflow-hidden">
                    <DialogHeader className="p-4 sm:p-6">
                        <DialogTitle className="text-xl sm:text-2xl font-black text-slate-900">Add New Branch</DialogTitle>
                        <DialogDescription className="font-medium text-xs sm:text-sm">
                            Create a new branch location in the system.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-6 py-4 max-h-[70vh] overflow-y-auto px-1">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="name" className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Branch Name</Label>
                                <Input
                                    id="name"
                                    value={form.name}
                                    onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
                                    placeholder="Bakery Name"
                                    className="h-10 sm:h-12 rounded-xl border-slate-200 focus:ring-primary shadow-sm font-bold text-sm"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="location" className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Location Address</Label>
                                <Input
                                    id="location"
                                    value={form.location}
                                    onChange={(e) => setForm(prev => ({ ...prev, location: e.target.value }))}
                                    placeholder="Location Address"
                                    className="h-10 sm:h-12 rounded-xl border-slate-200 focus:ring-primary shadow-sm font-bold text-sm"
                                />
                            </div>
                        </div>


                        <div className="pt-2 border-t border-slate-100 mt-2">
                            {!form.showManager ? (
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => setForm(p => ({ ...p, showManager: true }))}
                                    className="w-full h-10 sm:h-12 rounded-xl border-dashed border-2 border-slate-200 text-slate-500 hover:text-white hover:border-primary transition-all font-bold gap-2 text-xs"
                                >
                                    <Plus className="h-4 w-4" />
                                    Add New Manager Account
                                </Button>
                            ) : (
                                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                    <div className="flex items-center justify-between">
                                        <div className="flex flex-col">
                                            <Label className="text-[10px] font-black uppercase tracking-widest text-primary ml-1">New Manager Details</Label>
                                            <p className="text-[9px] text-slate-400 font-medium ml-1">Registration for this branch only</p>
                                        </div>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => setForm(p => ({ ...p, showManager: false, manager_username: "", manager_full_name: "", manager_email: "", manager_phone: "" }))}
                                            className="h-7 text-[9px] font-black uppercase tracking-tighter text-red-400 hover:text-red-500 hover:bg-red-50"
                                        >
                                            Remove
                                        </Button>
                                    </div>

                                    <div className="space-y-4 p-4 rounded-2xl bg-primary/5 border-2 border-primary/10 animate-in fade-in zoom-in-95 duration-300">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label className="text-[10px] font-black uppercase tracking-widest text-primary/60 ml-1">Username</Label>
                                                <Input
                                                    value={form.manager_username}
                                                    onChange={(e) => setForm(prev => ({ ...prev, manager_username: e.target.value }))}
                                                    placeholder="raj_mgr"
                                                    className="h-10 sm:h-12 rounded-xl border-primary/10 bg-white font-bold text-sm"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-[10px] font-black uppercase tracking-widest text-primary/60 ml-1">Full Name</Label>
                                                <Input
                                                    value={form.manager_full_name}
                                                    onChange={(e) => setForm(prev => ({ ...prev, manager_full_name: e.target.value }))}
                                                    placeholder="Full Name"
                                                    className="h-10 sm:h-12 rounded-xl border-primary/10 bg-white font-bold text-sm"
                                                />
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label className="text-[10px] font-black uppercase tracking-widest text-primary/60 ml-1">Email</Label>
                                                <Input
                                                    value={form.manager_email}
                                                    onChange={(e) => setForm(prev => ({ ...prev, manager_email: e.target.value }))}
                                                    placeholder="manager@ama.com"
                                                    className="h-10 sm:h-12 rounded-xl border-primary/10 bg-white text-sm"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-[10px] font-black uppercase tracking-widest text-primary/60 ml-1">Phone</Label>
                                                <Input
                                                    type="tel"
                                                    value={form.manager_phone}
                                                    onChange={(e) => {
                                                        const val = e.target.value.replace(/\D/g, '');
                                                        setForm(prev => ({ ...prev, manager_phone: val }));
                                                    }}
                                                    placeholder="98XXXXXXXX"
                                                    className="h-10 sm:h-12 rounded-xl border-primary/10 bg-white text-sm"
                                                />
                                            </div>
                                        </div>
                                        <p className="text-[10px] text-slate-400 font-bold tracking-tight text-center">
                                            Default Password: <span className="text-primary">amabakery@123</span>
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                    <DialogFooter className="bg-slate-50/50 p-4 sm:p-6">
                        <Button
                            variant="ghost"
                            onClick={() => setIsAddOpen(false)}
                            className="h-10 sm:h-12 rounded-xl font-bold text-xs sm:text-sm"
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleCreate}
                            disabled={isSubmitting}
                            className="h-10 sm:h-12 px-8 rounded-xl gradient-warm text-white font-black uppercase tracking-widest text-[10px] sm:text-xs shadow-lg shadow-orange-200"
                        >
                            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create Branch"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Edit Dialog */}
            <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
                <DialogContent className="sm:max-w-[425px] rounded-[2rem]">
                    <DialogHeader>
                        <DialogTitle className="text-xl sm:text-2xl font-black text-slate-900">Edit Branch</DialogTitle>
                        <DialogDescription className="font-medium text-xs sm:text-sm">
                            Update branch information.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="edit-name" className="text-sm font-bold uppercase tracking-wider text-slate-500 ml-1">Branch Name</Label>
                            <Input
                                id="edit-name"
                                value={editForm.name}
                                onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                                placeholder="Bakery Name"
                                className="h-10 sm:h-12 rounded-xl border-slate-200 focus:ring-primary shadow-sm text-sm"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="edit-location" className="text-sm font-bold uppercase tracking-wider text-slate-500 ml-1">Location Address</Label>
                            <Input
                                id="edit-location"
                                value={editForm.location}
                                onChange={(e) => setEditForm(prev => ({ ...prev, location: e.target.value }))}
                                placeholder="Location"
                                className="h-10 sm:h-12 rounded-xl border-slate-200 focus:ring-primary shadow-sm text-sm"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button
                            variant="ghost"
                            onClick={() => setIsEditOpen(false)}
                            className="h-10 sm:h-12 rounded-xl font-bold text-xs sm:text-sm"
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleUpdate}
                            disabled={isSubmitting}
                            className="h-10 sm:h-12 px-8 rounded-xl gradient-warm text-white font-black uppercase tracking-widest text-[10px] sm:text-xs shadow-lg shadow-orange-200"
                        >
                            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Update Branch"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
                <AlertDialogContent className="rounded-[2rem] border-2 border-slate-50 shadow-2xl">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-xl sm:text-2xl font-black text-slate-900">Delete Branch?</AlertDialogTitle>
                        <AlertDialogDescription className="text-slate-500 font-medium text-xs sm:text-sm">
                            Are you sure you want to delete <span className="text-primary font-bold">"{branchToDelete?.name}"</span>?
                            This action cannot be undone and will remove all associated data.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="gap-2 sm:gap-0">
                        <AlertDialogCancel className="h-11 sm:h-12 rounded-xl font-bold text-slate-400 border-none hover:text-slate-800 hover:bg-slate-50 transition-all text-xs sm:text-sm">
                            Keep Branch
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={(e) => {
                                e.preventDefault();
                                handleDelete();
                            }}
                            className="h-11 sm:h-12 px-6 rounded-xl bg-red-500 hover:bg-red-600 text-white font-black uppercase tracking-widest text-[10px] sm:text-xs"
                        >
                            Delete Permanently
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
