import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Pencil, Trash2, User, Shield, ChefHat, UtensilsCrossed, Loader2, CookingPot, Check, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { fetchUsers, createUser, updateUser, deleteUser, fetchKitchenTypes, createKitchenType } from "../../api/index.js";
import { ResetPasswordModal } from "../../components/auth/ResetPasswordModal";
import { Card } from "@/components/ui/card";
import { getCurrentUser } from "@/auth/auth";



interface UserType {
  id: string;
  username: string;
  full_name: string;
  user_type: string;
  branch?: number;
  branch_name?: string;
  kitchentype?: number;
  kitchentype_name?: string;
}

interface KitchenType {
  id: number;
  name: string;
  branch?: number;
}

const roleIcons: Record<string, any> = {
  WAITER: UtensilsCrossed,
  KITCHEN: ChefHat,
  BRANCH_MANAGER: Shield,
  ADMIN: Shield,
  COUNTER: User,
};

const roleColors: Record<string, string> = {
  WAITER: 'bg-info/10 text-info',
  KITCHEN: 'bg-warning/10 text-warning',
  BRANCH_MANAGER: 'bg-success/10 text-success',
  ADMIN: 'bg-primary/10 text-primary',
  COUNTER: 'bg-slate-100 text-slate-700',
};

export default function AdminUsers() {
  const [userList, setUserList] = useState<UserType[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [editUser, setEditUser] = useState<UserType | null>(null);
  const [resetTargetUser, setResetTargetUser] = useState<UserType | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [kitchenTypes, setKitchenTypes] = useState<KitchenType[]>([]);
  const [selectedKitchenId, setSelectedKitchenId] = useState<number | null>(null);
  const [kitchenSearchValue, setKitchenSearchValue] = useState("");
  const [isKitchenDropdownOpen, setIsKitchenDropdownOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState("WAITER");
  const [showPassword, setShowPassword] = useState(false);

  const currentUser = getCurrentUser();
  const branchId = currentUser?.branch_id ?? null;

  const canResetPassword = (targetRole: string) => {
    if (!currentUser?.role) return false;
    if (currentUser.role === 'ADMIN') return true;
    if (currentUser.role === 'BRANCH_MANAGER') {
      return ['WAITER', 'COUNTER', 'KITCHEN'].includes(targetRole);
    }
    return false;
  };


  useEffect(() => {
    loadUsers();
    loadKitchens();
  }, [branchId]);

  const loadKitchens = async () => {
    try {
      const data = await fetchKitchenTypes();
      setKitchenTypes(data || []);
    } catch (err: any) {
      console.error("Failed to load kitchens", err);
    }
  };

  const handleCreateKitchen = async (name: string) => {
    try {
      const payload: any = { name };
      if (branchId) payload.branch = branchId;
      const res = await createKitchenType(payload);
      const newKitchen = res.data;
      setKitchenTypes(prev => [...prev, newKitchen].sort((a, b) => a.name.localeCompare(b.name)));
      setSelectedKitchenId(newKitchen.id);
      setKitchenSearchValue(newKitchen.name);
      setIsKitchenDropdownOpen(false);
      toast.success(`Kitchen "${newKitchen.name}" created`);
      return newKitchen;
    } catch (err: any) {
      toast.error("Failed to create kitchen");
    }
  };

  const loadUsers = async () => {
    setLoading(true);
    try {
      const data = await fetchUsers();
      const scoped =
        branchId != null
          ? (data || []).filter((u: any) => u.branch === branchId)
          : data || [];
      setUserList(scoped);
    } catch (err: any) {
      toast.error("Failed to load users", { description: err.message });
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = userList.filter(user =>
    (user.full_name || user.username).toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.user_type.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleDelete = async (userId: string) => {
    if (userId === currentUser?.id) {
      toast.error("You cannot delete yourself");
      return;
    }
    if (!confirm("Are you sure you want to delete this user?")) return;
    try {
      await deleteUser(userId);
      setUserList(prev => prev.filter(user => user.id !== userId));
      toast.success("User deleted");
    } catch (err: any) {
      toast.error("Delete failed", { description: err.message });
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    const formData = new FormData(e.currentTarget);
    const payload: any = {
      full_name: formData.get("full_name"),
      username: formData.get("username"),
      user_type: selectedRole,
      email: formData.get("email"),
    };

    if (selectedRole === 'KITCHEN' && selectedKitchenId) {
      payload.kitchentype = selectedKitchenId;
    }

    // When admin/super admin is scoped to a branch, create/update users in that branch
    if (branchId) {
      payload.branch = branchId;
    }

    try {
      if (editUser) {
        const updated = await updateUser(editUser.id, payload);
        setUserList(prev => prev.map(u => u.id === editUser.id ? updated : u));
        toast.success("User updated");
      } else {
        const password = formData.get("password") as string;
        const newUser = await createUser({ ...payload, password });
        setUserList(prev => [...prev, newUser]);
        toast.success("User added");
      }
      setIsDialogOpen(false);
      setEditUser(null);
      setSelectedKitchenId(null);
      setKitchenSearchValue("");
      setSelectedRole("WAITER");
    } catch (err: any) {
      console.error("User operation error:", err);
      const errorMessage = err.message || "Operation failed";
      const errorDetail = errorMessage.includes("Branch not assigned")
        ? "Your admin account needs to have a branch assigned. Please contact the super admin to assign a branch to your account."
        : errorMessage;
      toast.error("Operation failed", {
        description: errorDetail,
        duration: 6000
      });
    } finally {
      setSubmitting(false);
    }
  };

  const countByRole = (role: string) => userList.filter(u => u.user_type === role).length;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground">User Management</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">Manage staff accounts and access</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => {
              setEditUser(null);
              setSelectedRole("WAITER");
              setSelectedKitchenId(null);
              setKitchenSearchValue("");
              setIsDialogOpen(true);
            }}>
              <Plus className="h-4 w-4 mr-2" />
              Add User
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editUser ? 'Edit User' : 'Add New User'}</DialogTitle>
            </DialogHeader>
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div>
                <Label htmlFor="full_name">Full Name</Label>
                <Input id="full_name" name="full_name" placeholder="Enter name" defaultValue={editUser?.full_name} required />
              </div>
              <div>
                <Label htmlFor="username">Username</Label>
                <Input id="username" name="username" placeholder="Enter username" defaultValue={editUser?.username} required />
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input id="email" name="email" type="email" placeholder="Enter email" required />
              </div>
              <div>
                <Label htmlFor="user_type">Role</Label>
                <Select
                  name="user_type"
                  value={selectedRole}
                  onValueChange={(val) => {
                    setSelectedRole(val);
                    if (val !== 'KITCHEN') {
                      setSelectedKitchenId(null);
                      setKitchenSearchValue("");
                    }
                  }}
                >
                  <SelectTrigger className="rounded-xl h-12">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="WAITER">Waiter</SelectItem>
                    <SelectItem value="KITCHEN">Kitchen Staff</SelectItem>
                    <SelectItem value="COUNTER">Counter</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {selectedRole === 'KITCHEN' && (
                <div className="space-y-1 relative">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 pl-1">Assigned Kitchen</Label>
                  <div className="relative">
                    <Input
                      placeholder="Search or type new kitchen..."
                      value={kitchenSearchValue}
                      onChange={(e) => {
                        setKitchenSearchValue(e.target.value);
                        setIsKitchenDropdownOpen(true);
                        const match = kitchenTypes.find(k => k.name.toLowerCase() === e.target.value.toLowerCase());
                        if (match) setSelectedKitchenId(match.id);
                        else setSelectedKitchenId(null);
                      }}
                      onFocus={() => setIsKitchenDropdownOpen(true)}
                      className="h-12 rounded-xl bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-primary/20 pr-10"
                    />
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                      <CookingPot className="h-4 w-4" />
                    </div>

                    {isKitchenDropdownOpen && (
                      <>
                        <div className="fixed inset-0 z-[100]" onClick={() => setIsKitchenDropdownOpen(false)} />
                        <Card className="absolute top-full left-0 right-0 mt-2 z-[110] rounded-xl border border-slate-100 shadow-2xl overflow-hidden max-h-[200px] overflow-y-auto py-2 animate-in fade-in slide-in-from-top-2">
                          {kitchenTypes
                            .filter(k => k.name.toLowerCase().includes(kitchenSearchValue.toLowerCase()))
                            .map(k => (
                              <button
                                key={k.id}
                                type="button"
                                className="w-full text-left px-4 py-3 text-sm font-bold hover:bg-primary/5 hover:text-primary transition-colors flex items-center justify-between group"
                                onClick={() => {
                                  setSelectedKitchenId(k.id);
                                  setKitchenSearchValue(k.name);
                                  setIsKitchenDropdownOpen(false);
                                }}
                              >
                                {k.name}
                                <Check className={cn("h-4 w-4 text-primary", selectedKitchenId === k.id ? "opacity-100" : "opacity-0")} />
                              </button>
                            ))}

                          {kitchenSearchValue.trim() && !kitchenTypes.some(k => k.name.toLowerCase() === kitchenSearchValue.toLowerCase()) && (
                            <button
                              type="button"
                              className="w-full text-left px-4 py-3 text-sm font-black text-primary bg-primary/5 hover:bg-primary/10 transition-all flex items-center gap-2 border-t border-slate-50"
                              onClick={() => handleCreateKitchen(kitchenSearchValue.trim())}
                            >
                              <Plus className="h-4 w-4" />
                              Add Kitchen "{kitchenSearchValue}"
                            </button>
                          )}
                        </Card>
                      </>
                    )}
                  </div>
                </div>
              )}
              {!editUser && (
                <div>
                  <Label htmlFor="password">Password (Default: amabakery@123)</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      defaultValue="amabakery@123"
                      placeholder="••••••••"
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              )}
              <div className="flex gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setIsDialogOpen(false);
                    setEditUser(null);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="flex-1"
                  disabled={submitting}
                >
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : (editUser ? 'Update' : 'Add')}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Role Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
        {(['WAITER', 'KITCHEN', 'BRANCH_MANAGER', 'ADMIN', 'COUNTER'] as const).map(role => {
          const Icon = roleIcons[role];
          return (
            <div key={role} className="card-elevated p-3 sm:p-4 flex items-center gap-3">
              <div className={`h-10 w-10 sm:h-12 sm:w-12 rounded-xl flex items-center justify-center ${roleColors[role]}`}>
                {Icon && <Icon className="h-5 w-5 sm:h-6 sm:w-6" />}
              </div>
              <div>
                <p className="text-2xl font-bold">{countByRole(role)}</p>
                <p className="text-sm text-muted-foreground capitalize">{role.toLowerCase().replace('_', ' ')}s</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Search */}
      <div className="card-elevated p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search staff by name or role..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 h-11 border border-slate-200 bg-white"
          />
        </div>
      </div>

      {/* Users Table */}
      <div className="card-elevated overflow-hidden border-none shadow-sm bg-white">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-6 py-4 text-left text-[10px] sm:text-xs font-black uppercase tracking-wider text-slate-400">Staff Member</th>
                <th className="px-6 py-4 text-left text-[10px] sm:text-xs font-black uppercase tracking-wider text-slate-400">Role</th>
                <th className="px-6 py-4 text-left text-[10px] sm:text-xs font-black uppercase tracking-wider text-slate-400">Access Method</th>
                <th className="px-6 py-4 text-center text-[10px] sm:text-xs font-black uppercase tracking-wider text-slate-400">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredUsers.map((user) => {
                const Icon = roleIcons[user.user_type];
                const isWaiter = user.user_type === 'WAITER';

                return (
                  <tr
                    key={user.id}
                    className="hover:bg-slate-50 transition-colors group cursor-pointer"
                    onClick={() => {
                      setEditUser(user);
                      setSelectedRole(user.user_type);
                      if (user.user_type === 'KITCHEN') {
                        setSelectedKitchenId(user.kitchentype || null);
                        setKitchenSearchValue(user.kitchentype_name || "");
                      } else {
                        setSelectedKitchenId(null);
                        setKitchenSearchValue("");
                      }
                      setIsDialogOpen(true);
                    }}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className={`h-8 w-8 sm:h-10 sm:w-10 rounded-xl flex items-center justify-center ${roleColors[user.user_type]} shadow-sm`}>
                          {Icon && <Icon className="h-4 w-4 sm:h-5 sm:w-5" />}
                        </div>
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-700">{user.full_name || user.username}</span>
                          <span className="text-xs text-slate-400">
                            @{user.username} {user.kitchentype_name && <span className="text-primary font-black ml-1 uppercase text-[9px] tracking-widest">• {user.kitchentype_name}</span>}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={cn(
                        "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tight",
                        roleColors[user.user_type]
                      )}>
                        {user.user_type.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2 text-sm text-slate-500 font-medium">
                        <span className="bg-slate-800 text-white px-2 py-0.5 rounded text-[10px] font-black uppercase">User/Pass</span>
                        <span className="font-mono text-xs opacity-50 italic">{user.branch_name || 'Global'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="flex justify-center items-center gap-3">
                        {canResetPassword(user.user_type) && user.id !== currentUser?.id && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 px-3 text-[10px] font-black uppercase tracking-widest border-amber-200 text-amber-600 hover:bg-amber-50 hover:text-amber-700"
                            onClick={(e) => {
                              e.stopPropagation();
                              setResetTargetUser(user);
                              setIsResetModalOpen(true);
                            }}
                          >
                            Reset Password
                          </Button>
                        )}
                        {user.id !== currentUser?.id && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 hover:bg-red-50 text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(user.id);
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>

                );
              })}
            </tbody>
          </table>
        </div>

        <ResetPasswordModal
          isOpen={isResetModalOpen}
          onClose={() => {
            setIsResetModalOpen(false);
            setResetTargetUser(null);
          }}
          user={resetTargetUser}
        />


        {filteredUsers.length === 0 && (
          <div className="py-20 text-center">
            <User className="h-12 w-12 text-slate-200 mx-auto mb-3" />
            <h3 className="text-slate-400 font-medium">No staff members found</h3>
          </div>
        )}
      </div>
    </div>
  );
}
