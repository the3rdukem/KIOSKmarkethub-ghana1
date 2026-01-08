"use client";

import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Users, Eye, CheckCircle, XCircle, AlertTriangle,
  Search, MoreHorizontal, Ban, Trash2, RotateCcw, UserX, UserCheck,
  Mail, Phone, MapPin, Calendar, Shield, Archive, Plus, Loader2, RefreshCw,
  ShoppingBag, Store
} from "lucide-react";
import { formatDistance, format } from "date-fns";
import { toast } from "sonner";

interface UserManagementProps {
  currentAdmin: {
    id: string;
    name: string;
    email?: string;
  };
  isMasterAdmin: boolean;
}

interface ApiUser {
  id: string;
  email: string;
  name: string;
  role: 'buyer' | 'vendor' | 'admin' | 'master_admin';
  status: string;
  avatar: string | null;
  phone: string | null;
  location: string | null;
  businessName: string | null;
  businessType: string | null;
  verificationStatus: string | null;
  verificationNotes: string | null;
  isDeleted: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export function UserManagement({ currentAdmin, isMasterAdmin }: UserManagementProps) {
  const [users, setUsers] = useState<ApiUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState<ApiUser | null>(null);
  const [actionReason, setActionReason] = useState("");
  const [showUserDialog, setShowUserDialog] = useState(false);
  const [showActionDialog, setShowActionDialog] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [actionType, setActionType] = useState<"suspend" | "ban" | "delete" | "permanent_delete" | "restore" | "activate" | null>(null);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [userFilter, setUserFilter] = useState<"all" | "buyers" | "vendors" | "suspended" | "deleted">("all");

  // Create user form state
  const [createUserData, setCreateUserData] = useState({
    email: "",
    password: "",
    name: "",
    role: "buyer" as 'buyer' | 'vendor' | 'admin' | 'master_admin',
    phone: "",
    location: "",
    businessName: "",
    businessType: "",
  });
  const [isCreating, setIsCreating] = useState(false);

  // Fetch users from API
  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (userFilter === 'buyers') params.set('role', 'buyer');
      if (userFilter === 'vendors') params.set('role', 'vendor');
      if (userFilter === 'suspended') params.set('status', 'suspended');
      if (userFilter === 'deleted') params.set('includeDeleted', 'true');

      const response = await fetch(`/api/admin/users?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch users');

      const data = await response.json();
      setUsers(data.users || []);
    } catch (error) {
      console.error('Failed to fetch users:', error);
      toast.error('Failed to load users');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userFilter]);

  const getFilteredUsers = () => {
    let filtered = users;

    // Apply additional filtering for deleted
    if (userFilter === 'deleted') {
      filtered = users.filter(u => u.isDeleted);
    } else if (userFilter !== 'all') {
      filtered = users.filter(u => !u.isDeleted);
    }

    // Apply search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(u =>
        u.name.toLowerCase().includes(query) ||
        u.email.toLowerCase().includes(query) ||
        u.phone?.toLowerCase().includes(query) ||
        u.businessName?.toLowerCase().includes(query)
      );
    }

    return filtered;
  };

  const filteredUsers = getFilteredUsers();

  // Compute stats from users array
  const userStats = useMemo(() => ({
    total: users.filter(u => !u.isDeleted).length,
    buyers: users.filter(u => u.role === 'buyer' && !u.isDeleted).length,
    vendors: users.filter(u => u.role === 'vendor' && !u.isDeleted).length,
    active: users.filter(u => u.status === 'active' && !u.isDeleted).length,
    suspended: users.filter(u => u.status === 'suspended' && !u.isDeleted).length,
    deleted: users.filter(u => u.isDeleted).length,
  }), [users]);

  const getInitials = (name: string) => name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);

  const getStatusBadge = (user: ApiUser) => {
    if (user.isDeleted) {
      return <Badge variant="outline" className="bg-gray-100 text-gray-800">Deleted</Badge>;
    }
    const colors: Record<string, string> = {
      active: "bg-green-100 text-green-800",
      suspended: "bg-red-100 text-red-800",
      banned: "bg-red-200 text-red-900",
      pending: "bg-yellow-100 text-yellow-800",
    };
    return <Badge variant="outline" className={colors[user.status] || "bg-gray-100"}>{user.status}</Badge>;
  };

  const handleAction = (type: typeof actionType, user: ApiUser) => {
    setActionType(type);
    setSelectedUser(user);
    setShowActionDialog(true);
    setActionReason("");
  };

  const executeAction = async () => {
    if (!selectedUser || !actionType) return;

    try {
      const response = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: selectedUser.id,
          action: actionType,
          reason: actionReason,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Action failed');
      }

      toast.success(`${selectedUser.name} has been ${actionType}ed`);
      fetchUsers(); // Refresh the list
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Action failed');
    }

    setShowActionDialog(false);
    setSelectedUser(null);
    setActionType(null);
    setActionReason("");
  };

  // Create user via API
  const handleCreateUser = async () => {
    if (!createUserData.email || !createUserData.password || !createUserData.name || !createUserData.role) {
      toast.error("Please fill in all required fields");
      return;
    }

    if (createUserData.role === 'vendor' && !createUserData.businessName) {
      toast.error("Business name is required for vendors");
      return;
    }

    setIsCreating(true);

    try {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createUserData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create user');
      }

      toast.success(data.message || `${createUserData.role} account created successfully`);
      setShowCreateDialog(false);
      setCreateUserData({
        email: "",
        password: "",
        name: "",
        role: "buyer",
        phone: "",
        location: "",
        businessName: "",
        businessType: "",
      });
      fetchUsers(); // Refresh the list
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create user');
    } finally {
      setIsCreating(false);
    }
  };

  const getActionDialogContent = () => {
    if (!actionType || !selectedUser) return null;

    const configs = {
      suspend: {
        title: "Suspend User",
        description: `This will suspend ${selectedUser.name}'s account. They will not be able to access the platform.`,
        requiresReason: true,
        buttonText: "Suspend User",
        buttonClass: "bg-orange-600 hover:bg-orange-700",
      },
      ban: {
        title: "Ban User",
        description: `This will permanently ban ${selectedUser.name}'s account. They will not be able to access the platform.`,
        requiresReason: true,
        buttonText: "Ban User",
        buttonClass: "bg-red-600 hover:bg-red-700",
      },
      delete: {
        title: "Delete User",
        description: `This will soft-delete ${selectedUser.name}'s account. The account can be restored later.`,
        requiresReason: true,
        buttonText: "Delete User",
        buttonClass: "bg-red-600 hover:bg-red-700",
      },
      permanent_delete: {
        title: "Permanently Delete User",
        description: `This will PERMANENTLY delete ${selectedUser.name}'s account and all associated data. This action CANNOT be undone.`,
        requiresReason: false,
        buttonText: "Permanently Delete",
        buttonClass: "bg-red-700 hover:bg-red-800",
      },
      restore: {
        title: "Restore User",
        description: `This will restore ${selectedUser.name}'s account. They will be able to access the platform again.`,
        requiresReason: false,
        buttonText: "Restore User",
        buttonClass: "bg-green-600 hover:bg-green-700",
      },
      activate: {
        title: "Activate User",
        description: `This will activate ${selectedUser.name}'s account. They will be able to access the platform.`,
        requiresReason: false,
        buttonText: "Activate User",
        buttonClass: "bg-green-600 hover:bg-green-700",
      },
    };

    return configs[actionType];
  };

  const actionConfig = getActionDialogContent();

  return (
    <div className="space-y-6">
      {/* Quick Stats */}
      <div className="grid grid-cols-6 gap-4">
        <Card className="cursor-pointer hover:border-gray-400 transition-colors" onClick={() => setUserFilter("all")}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Users</p>
                <p className="text-2xl font-bold">{userStats.total}</p>
              </div>
              <Users className="w-8 h-8 text-gray-400" />
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-blue-400 transition-colors" onClick={() => setUserFilter("buyers")}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Buyers</p>
                <p className="text-2xl font-bold text-blue-600">{userStats.buyers}</p>
              </div>
              <ShoppingBag className="w-8 h-8 text-blue-400" />
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-green-400 transition-colors" onClick={() => setUserFilter("vendors")}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Vendors</p>
                <p className="text-2xl font-bold text-green-600">{userStats.vendors}</p>
              </div>
              <Store className="w-8 h-8 text-green-400" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active</p>
                <p className="text-2xl font-bold text-emerald-600">{userStats.active}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-emerald-400" />
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-red-400 transition-colors" onClick={() => setUserFilter("suspended")}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Suspended</p>
                <p className="text-2xl font-bold text-red-600">{userStats.suspended}</p>
              </div>
              <Ban className="w-8 h-8 text-red-400" />
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-gray-400 transition-colors" onClick={() => setUserFilter("deleted")}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Deleted</p>
                <p className="text-2xl font-bold text-gray-600">{userStats.deleted}</p>
              </div>
              <Trash2 className="w-8 h-8 text-gray-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                User Management
              </CardTitle>
              <CardDescription>
                Manage all platform users - buyers, vendors, and their access
              </CardDescription>
            </div>
            <div className="flex items-center gap-4">
              {/* Create User Button */}
              <Button onClick={() => setShowCreateDialog(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Create User
              </Button>
              {/* Refresh Button */}
              <Button variant="outline" size="icon" onClick={fetchUsers} disabled={isLoading}>
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              </Button>
              {/* Filter */}
              <Select value={userFilter} onValueChange={(v: typeof userFilter) => setUserFilter(v)}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Filter users" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Users</SelectItem>
                  <SelectItem value="buyers">Buyers Only</SelectItem>
                  <SelectItem value="vendors">Vendors Only</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                  <SelectItem value="deleted">Deleted</SelectItem>
                </SelectContent>
              </Select>
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search users..."
                  className="pl-10 w-64"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold">No Users Found</h3>
              <p className="text-muted-foreground">
                {searchQuery ? "Try adjusting your search query" : "No users match the current filter"}
              </p>
            </div>
          ) : (
            <ScrollArea className="h-[600px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={selectedUsers.length === filteredUsers.length && filteredUsers.length > 0}
                        onCheckedChange={(checked) => {
                          setSelectedUsers(checked ? filteredUsers.map(u => u.id) : []);
                        }}
                      />
                    </TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((user) => (
                    <TableRow key={user.id} className={user.isDeleted ? "opacity-60" : ""}>
                      <TableCell>
                        <Checkbox
                          checked={selectedUsers.includes(user.id)}
                          onCheckedChange={(checked) => {
                            setSelectedUsers(prev =>
                              checked ? [...prev, user.id] : prev.filter(id => id !== user.id)
                            );
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10">
                            <AvatarFallback className={user.role === "vendor" ? "bg-green-100 text-green-800" : "bg-blue-100 text-blue-800"}>
                              {getInitials(user.name)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{user.name}</p>
                            <p className="text-sm text-muted-foreground">{user.email}</p>
                            {user.businessName && (
                              <p className="text-xs text-green-600">{user.businessName}</p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={user.role === "vendor" ? "default" : "secondary"} className={user.role === "vendor" ? "bg-green-100 text-green-800" : ""}>
                          {user.role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {user.phone && (
                            <div className="flex items-center gap-1">
                              <Phone className="w-3 h-3" />
                              {user.phone}
                            </div>
                          )}
                          {user.location && (
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <MapPin className="w-3 h-3" />
                              {user.location}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDistance(new Date(user.createdAt), new Date(), { addSuffix: true })}
                      </TableCell>
                      <TableCell>{getStatusBadge(user)}</TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => { setSelectedUser(user); setShowUserDialog(true); }}>
                              <Eye className="w-4 h-4 mr-2" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />

                            {/* Actions based on user status */}
                            {user.isDeleted ? (
                              <>
                                <DropdownMenuItem className="text-green-600" onClick={() => handleAction("restore", user)}>
                                  <RotateCcw className="w-4 h-4 mr-2" />
                                  Restore User
                                </DropdownMenuItem>
                                {isMasterAdmin && (
                                  <DropdownMenuItem className="text-red-600" onClick={() => handleAction("permanent_delete", user)}>
                                    <Trash2 className="w-4 h-4 mr-2" />
                                    Permanently Delete
                                  </DropdownMenuItem>
                                )}
                              </>
                            ) : (
                              <>
                                {user.status === "active" && (
                                  <DropdownMenuItem className="text-orange-600" onClick={() => handleAction("suspend", user)}>
                                    <Ban className="w-4 h-4 mr-2" />
                                    Suspend
                                  </DropdownMenuItem>
                                )}
                                {(user.status === "suspended" || user.status === "banned") && (
                                  <DropdownMenuItem className="text-green-600" onClick={() => handleAction("activate", user)}>
                                    <UserCheck className="w-4 h-4 mr-2" />
                                    Activate
                                  </DropdownMenuItem>
                                )}
                                {user.status !== "banned" && (
                                  <DropdownMenuItem className="text-red-600" onClick={() => handleAction("ban", user)}>
                                    <UserX className="w-4 h-4 mr-2" />
                                    Ban User
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuSeparator />
                                <DropdownMenuItem className="text-red-600" onClick={() => handleAction("delete", user)}>
                                  <Archive className="w-4 h-4 mr-2" />
                                  Delete User
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Create User Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5" />
              Create New User
            </DialogTitle>
            <DialogDescription>
              Create a new user account. The user will be able to log in immediately.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label>Full Name *</Label>
                <Input
                  value={createUserData.name}
                  onChange={(e) => setCreateUserData({ ...createUserData, name: e.target.value })}
                  placeholder="John Doe"
                />
              </div>
              <div className="col-span-2">
                <Label>Email Address *</Label>
                <Input
                  type="email"
                  value={createUserData.email}
                  onChange={(e) => setCreateUserData({ ...createUserData, email: e.target.value })}
                  placeholder="john@example.com"
                />
              </div>
              <div className="col-span-2">
                <Label>Password *</Label>
                <Input
                  type="password"
                  value={createUserData.password}
                  onChange={(e) => setCreateUserData({ ...createUserData, password: e.target.value })}
                  placeholder="Minimum 6 characters"
                />
              </div>
              <div className="col-span-2">
                <Label>Role *</Label>
                <Select
                  value={createUserData.role}
                  onValueChange={(v) => setCreateUserData({ ...createUserData, role: v as typeof createUserData.role })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="buyer">Buyer</SelectItem>
                    <SelectItem value="vendor">Vendor</SelectItem>
                    {isMasterAdmin && (
                      <>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="master_admin">Master Admin</SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Phone</Label>
                <Input
                  value={createUserData.phone}
                  onChange={(e) => setCreateUserData({ ...createUserData, phone: e.target.value })}
                  placeholder="+233 24 123 4567"
                />
              </div>
              <div>
                <Label>Location</Label>
                <Input
                  value={createUserData.location}
                  onChange={(e) => setCreateUserData({ ...createUserData, location: e.target.value })}
                  placeholder="Accra, Ghana"
                />
              </div>
              {createUserData.role === 'vendor' && (
                <>
                  <div className="col-span-2">
                    <Label>Business Name *</Label>
                    <Input
                      value={createUserData.businessName}
                      onChange={(e) => setCreateUserData({ ...createUserData, businessName: e.target.value })}
                      placeholder="My Business"
                    />
                  </div>
                  <div className="col-span-2">
                    <Label>Business Type</Label>
                    <Select
                      value={createUserData.businessType}
                      onValueChange={(v) => setCreateUserData({ ...createUserData, businessType: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Individual Seller">Individual Seller</SelectItem>
                        <SelectItem value="Small Business">Small Business</SelectItem>
                        <SelectItem value="Medium Enterprise">Medium Enterprise</SelectItem>
                        <SelectItem value="Corporation">Corporation</SelectItem>
                        <SelectItem value="Manufacturer">Manufacturer</SelectItem>
                        <SelectItem value="Wholesaler">Wholesaler</SelectItem>
                        <SelectItem value="Retailer">Retailer</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <p className="text-sm text-yellow-800">
                      <Shield className="w-4 h-4 inline mr-1" />
                      Vendor accounts start with <strong>pending</strong> verification status.
                      They must be approved before they can publish products.
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
            <Button onClick={handleCreateUser} disabled={isCreating}>
              {isCreating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create User'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* User Details Dialog */}
      <Dialog open={showUserDialog} onOpenChange={setShowUserDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedUser && (
                <>
                  <Avatar className="h-8 w-8">
                    <AvatarFallback>{selectedUser ? getInitials(selectedUser.name) : ""}</AvatarFallback>
                  </Avatar>
                  {selectedUser.name}
                </>
              )}
            </DialogTitle>
            <DialogDescription>User account details and activity</DialogDescription>
          </DialogHeader>
          {selectedUser && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground text-xs">Email</Label>
                  <p className="text-sm font-medium">{selectedUser.email}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Phone</Label>
                  <p className="text-sm font-medium">{selectedUser.phone || "Not provided"}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Role</Label>
                  <p className="text-sm font-medium capitalize">{selectedUser.role}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Status</Label>
                  <div className="mt-1">{getStatusBadge(selectedUser)}</div>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Location</Label>
                  <p className="text-sm font-medium">{selectedUser.location || "Not provided"}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Joined</Label>
                  <p className="text-sm font-medium">{format(new Date(selectedUser.createdAt), "PPP")}</p>
                </div>
                {selectedUser.role === "vendor" && (
                  <>
                    <div>
                      <Label className="text-muted-foreground text-xs">Business Name</Label>
                      <p className="text-sm font-medium">{selectedUser.businessName || "Not provided"}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground text-xs">Business Type</Label>
                      <p className="text-sm font-medium">{selectedUser.businessType || "Not provided"}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground text-xs">Verification Status</Label>
                      <p className="text-sm font-medium capitalize">{selectedUser.verificationStatus || "pending"}</p>
                    </div>
                  </>
                )}
                {selectedUser.lastLoginAt && (
                  <div>
                    <Label className="text-muted-foreground text-xs">Last Login</Label>
                    <p className="text-sm font-medium">
                      {formatDistance(new Date(selectedUser.lastLoginAt), new Date(), { addSuffix: true })}
                    </p>
                  </div>
                )}
              </div>

              {selectedUser.isDeleted && (
                <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                  <div className="flex items-center gap-2 text-red-800 mb-2">
                    <AlertTriangle className="w-4 h-4" />
                    <span className="font-medium">This account has been deleted</span>
                  </div>
                </div>
              )}

              <DialogFooter>
                <Button variant="outline" onClick={() => setShowUserDialog(false)}>Close</Button>
                {!selectedUser.isDeleted && selectedUser.status === "active" && (
                  <Button variant="destructive" onClick={() => { setShowUserDialog(false); handleAction("suspend", selectedUser); }}>
                    <Ban className="w-4 h-4 mr-2" />
                    Suspend User
                  </Button>
                )}
                {selectedUser.isDeleted && (
                  <Button className="bg-green-600 hover:bg-green-700" onClick={() => { setShowUserDialog(false); handleAction("restore", selectedUser); }}>
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Restore User
                  </Button>
                )}
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Action Confirmation Dialog */}
      <AlertDialog open={showActionDialog} onOpenChange={setShowActionDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{actionConfig?.title}</AlertDialogTitle>
            <AlertDialogDescription>{actionConfig?.description}</AlertDialogDescription>
          </AlertDialogHeader>
          {actionConfig?.requiresReason && (
            <div className="py-4">
              <Label>Reason</Label>
              <Textarea
                value={actionReason}
                onChange={(e) => setActionReason(e.target.value)}
                placeholder="Provide a reason for this action..."
                className="mt-2"
              />
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setShowActionDialog(false); setActionReason(""); }}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className={actionConfig?.buttonClass}
              onClick={executeAction}
              disabled={actionConfig?.requiresReason && !actionReason.trim()}
            >
              {actionConfig?.buttonText}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
