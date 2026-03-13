"use client"

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { useToast } from "@/hooks/use-toast"
import { userApi } from "@/lib/api-service"
import { useAuth } from "@/hooks/use-auth"
import { Plus, Pencil, Trash2, Loader2, RefreshCw, Users, Shield, Eye, EyeOff, Search, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { PageHeader } from "@/components/page-header"

type AccessLevel = 'view_only' | 'modify'
type PageAccessMap = Record<string, AccessLevel>

interface User {
  id: number
  username: string
  password: string
  email: string
  phone_no: string | null
  status: string
  role: string
  page_access: string[] | PageAccessMap | null
  created_at: string
  updated_at: string
}

const PAGE_ACCESS_OPTIONS = [
  "Dashboard",
  "Order Punch",
  "Pre Approval",
  "Approval of Order",
  "Dispatch Planning",
  "Actual Dispatch",
  "Vehicle Details",
  "Material Load",
  "Security Guard Approval",
  "Make Invoice",
  "Check Invoice",
  "Gate Out",
  "Confirm Material Receipt",
  "Damage Adjustment",
  "Variable Parameters",
  "Settings",
  "Master",
  "Reports"
]

const ROLES = ["admin", "user", "guard", "pc"]
const STATUSES = ["active", "inactive"]

export default function SettingsPage() {
  const { toast } = useToast()
  const { isReadOnly } = useAuth()
  const [users, setUsers] = useState<User[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [sortField, setSortField] = useState<string>("id")
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc")
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  // Dialog states
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  
  // Form state
  const [formData, setFormData] = useState({
    username: "",
    password: "",
    email: "",
    phone_no: "",
    status: "active",
    role: "user",
    page_access: {} as PageAccessMap
  })
  
  const [showPassword, setShowPassword] = useState(false)

  // Fetch users
  const fetchUsers = async () => {
    try {
      setIsLoading(true)
      const response = await userApi.getAll()
      if (response.success && response.data?.users) {
        setUsers(response.data.users)
      }
    } catch (error: any) {
      console.error("Failed to fetch users:", error)
      toast({
        title: "Error",
        description: error?.message || "Failed to load users",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers()
  }, [])

  // Sort helper
  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(prev => prev === "asc" ? "desc" : "asc")
    } else {
      setSortField(field)
      setSortDirection("asc")
    }
  }

  const SortIcon = ({ field }: { field: string }) => {
    if (sortField !== field) return <ArrowUpDown className="ml-1 h-3 w-3 text-slate-400 inline" />
    return sortDirection === "asc"
      ? <ArrowUp className="ml-1 h-3 w-3 text-blue-600 inline" />
      : <ArrowDown className="ml-1 h-3 w-3 text-blue-600 inline" />
  }

  // Filter + Sort
  const filteredAndSortedUsers = useMemo(() => {
    const q = searchQuery.toLowerCase().trim()
    let filtered = q
      ? users.filter(u =>
          u.username.toLowerCase().includes(q) ||
          (u.email || "").toLowerCase().includes(q) ||
          (u.phone_no || "").includes(q) ||
          u.role.toLowerCase().includes(q) ||
          u.status.toLowerCase().includes(q) ||
          String(u.id).includes(q)
        )
      : [...users]

    filtered.sort((a, b) => {
      let aVal: any = (a as any)[sortField] ?? ""
      let bVal: any = (b as any)[sortField] ?? ""
      if (sortField === "id") {
        aVal = Number(aVal); bVal = Number(bVal)
      } else if (sortField === "created_at") {
        aVal = new Date(aVal).getTime(); bVal = new Date(bVal).getTime()
      } else {
        aVal = String(aVal).toLowerCase(); bVal = String(bVal).toLowerCase()
      }
      if (aVal < bVal) return sortDirection === "asc" ? -1 : 1
      if (aVal > bVal) return sortDirection === "asc" ? 1 : -1
      return 0
    })

    return filtered
  }, [users, searchQuery, sortField, sortDirection])

  // Reset form
  const resetForm = () => {
    setFormData({
      username: "",
      password: "",
      email: "",
      phone_no: "",
      status: "active",
      role: "user",
      page_access: {}
    })
    setShowPassword(false)
  }

  // Handle add user
  const handleAddUser = async () => {
    if (!formData.username || !formData.password || !formData.role) {
      toast({
        title: "Validation Error",
        description: "Username, password, and role are required",
        variant: "destructive",
      })
      return
    }

    setIsSubmitting(true)
    try {
      const response = await userApi.create({ ...formData, page_access: formData.page_access as any })
      if (response.success) {
        toast({
          title: "Success",
          description: "User created successfully",
        })
        setIsAddDialogOpen(false)
        resetForm()
        fetchUsers()
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message || "Failed to create user",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  // Handle edit user
  const handleEditUser = async () => {
    if (!selectedUser) return

    setIsSubmitting(true)
    try {
      const updateData = {
        ...formData,
        page_access: formData.page_access as any,
        password: formData.password === "••••••••" ? undefined : formData.password
      }
      
      const response = await userApi.update(selectedUser.id, updateData)
      if (response.success) {
        // If we just edited the currently logged-in user, sync localStorage immediately
        try {
          const currentUserStr = localStorage.getItem("user")
          if (currentUserStr) {
            const currentUser = JSON.parse(currentUserStr)
            if (currentUser.id === selectedUser.id) {
              const updatedUser = { ...currentUser, ...updateData, password: currentUser.password }
              localStorage.setItem("user", JSON.stringify(updatedUser))
            }
          }
        } catch (e) {
          console.warn("Failed to sync localStorage after edit", e)
        }

        toast({
          title: "Success",
          description: "User updated successfully",
        })
        setIsEditDialogOpen(false)
        resetForm()
        setSelectedUser(null)
        fetchUsers()
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message || "Failed to update user",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  // Handle delete user
  const handleDeleteUser = async () => {
    if (!selectedUser) return

    setIsSubmitting(true)
    try {
      const response = await userApi.delete(selectedUser.id)
      if (response.success) {
        toast({
          title: "Success",
          description: "User deleted successfully",
        })
        setIsDeleteDialogOpen(false)
        setSelectedUser(null)
        fetchUsers()
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message || "Failed to delete user",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  // Open edit dialog with user data
  const openEditDialog = (user: User) => {
    setSelectedUser(user)
    // Normalize page_access to PageAccessMap format
    let pa: PageAccessMap = {}
    if (Array.isArray(user.page_access)) {
      user.page_access.forEach(p => { pa[p] = 'modify' })
    } else if (user.page_access && typeof user.page_access === 'object') {
      pa = { ...user.page_access } as PageAccessMap
    }
    setFormData({
      username: user.username,
      password: user.password,
      email: user.email,
      phone_no: user.phone_no || "",
      status: user.status,
      role: user.role,
      page_access: pa
    })
    setIsEditDialogOpen(true)
  }

  // Open delete dialog
  const openDeleteDialog = (user: User) => {
    setSelectedUser(user)
    setIsDeleteDialogOpen(true)
  }

  // Toggle page access on/off (default to 'modify' when first enabled)
  const togglePageAccess = (page: string) => {
    setFormData(prev => {
      const pa = { ...(prev.page_access as PageAccessMap) }
      if (pa[page]) {
        delete pa[page]
      } else {
        pa[page] = 'modify'
      }
      return { ...prev, page_access: pa }
    })
  }

  // Set access level for a page
  const setPageAccessLevel = (page: string, level: AccessLevel) => {
    setFormData(prev => ({
      ...prev,
      page_access: { ...(prev.page_access as PageAccessMap), [page]: level }
    }))
  }

  // Select all pages (all as 'modify')
  const selectAllPages = () => {
    const pa: PageAccessMap = {}
    PAGE_ACCESS_OPTIONS.forEach(p => { pa[p] = 'modify' })
    setFormData(prev => ({ ...prev, page_access: pa }))
  }

  // Deselect all pages
  const deselectAllPages = () => {
    setFormData(prev => ({ ...prev, page_access: {} }))
  }

  // Helper: is a page enabled in the form
  const isPageEnabled = (page: string) => {
    return !!(formData.page_access as PageAccessMap)[page]
  }

  // Helper: get level for a page in the form
  const getPageLevel = (page: string): AccessLevel => {
    return (formData.page_access as PageAccessMap)[page] || 'modify'
  }

  // Helper: get readable page access for display in table
  const getDisplayPageAccess = (user: User): { page: string; level: AccessLevel }[] => {
    if (!user.page_access) return []
    if (Array.isArray(user.page_access)) {
      return user.page_access.map(p => ({ page: p, level: 'modify' as AccessLevel }))
    }
    return Object.entries(user.page_access as PageAccessMap).map(([page, level]) => ({ page, level }))
  }

  return (
    <div className="p-8 max-w-[1600px] mx-auto min-h-screen space-y-8 animate-in fade-in duration-700">
      {/* Header */}
      <PageHeader 
        title="Settings" 
        description="Manage users, roles, and page access permissions"
      >
        <Button variant="outline" onClick={fetchUsers} disabled={isLoading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
        <Dialog open={isAddDialogOpen} onOpenChange={(open) => {
          setIsAddDialogOpen(open)
          if (!open) resetForm()
        }}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary/90" disabled={isReadOnly} title={isReadOnly ? "View Only Access" : "Add User"}>
              <Plus className="mr-2 h-4 w-4" />
              Add User
            </Button>
          </DialogTrigger>
            <DialogContent className="sm:max-w-[600px]">
              <DialogHeader>
                <DialogTitle>Add New User</DialogTitle>
                <DialogDescription>
                  Create a new user account with role and page access permissions.
                </DialogDescription>
              </DialogHeader>
              {/* Inline form content to prevent re-mount on state change */}
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="add-username">Username *</Label>
                    <Input
                      id="add-username"
                      value={formData.username}
                      onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))}
                      placeholder="Enter username"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="add-email">Email</Label>
                    <Input
                      id="add-email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                      placeholder="Enter email"
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="add-password">Password *</Label>
                    <div className="relative">
                      <Input
                        id="add-password"
                        type={showPassword ? "text" : "password"}
                        value={formData.password}
                        onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                        placeholder="Enter password"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="add-phone">Phone Number</Label>
                    <Input
                      id="add-phone"
                      value={formData.phone_no}
                      onChange={(e) => setFormData(prev => ({ ...prev, phone_no: e.target.value }))}
                      placeholder="Enter phone number"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="add-role">Role *</Label>
                    <Select
                      value={formData.role}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, role: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                      <SelectContent>
                        {ROLES.map((role) => (
                          <SelectItem key={role} value={role}>
                            {role.charAt(0).toUpperCase() + role.slice(1)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="add-status">Status</Label>
                    <Select
                      value={formData.status}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, status: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUSES.map((status) => (
                          <SelectItem key={status} value={status}>
                            {status.charAt(0).toUpperCase() + status.slice(1)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Page Access</Label>
                    <div className="flex gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={selectAllPages}>
                        Select All
                      </Button>
                      <Button type="button" variant="outline" size="sm" onClick={deselectAllPages}>
                        Deselect All
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-1.5 max-h-[260px] overflow-y-auto border rounded-lg p-3">
                    {PAGE_ACCESS_OPTIONS.map((page) => (
                      <div key={page} className="flex items-center justify-between py-1 px-1 rounded hover:bg-slate-50">
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id={`add-page-${page}`}
                            checked={isPageEnabled(page)}
                            onCheckedChange={() => togglePageAccess(page)}
                          />
                          <Label htmlFor={`add-page-${page}`} className="text-sm cursor-pointer font-normal">
                            {page}
                          </Label>
                        </div>
                        {isPageEnabled(page) && (
                          <div className="flex rounded-md border overflow-hidden text-xs">
                            <button
                              type="button"
                              onClick={() => setPageAccessLevel(page, 'view_only')}
                              className={`px-2 py-0.5 font-medium transition-colors ${
                                getPageLevel(page) === 'view_only'
                                  ? 'bg-amber-100 text-amber-700 border-amber-300'
                                  : 'bg-white text-slate-500 hover:bg-slate-50'
                              }`}
                            >
                              View
                            </button>
                            <button
                              type="button"
                              onClick={() => setPageAccessLevel(page, 'modify')}
                              className={`px-2 py-0.5 font-medium transition-colors border-l ${
                                getPageLevel(page) === 'modify'
                                  ? 'bg-emerald-100 text-emerald-700 border-emerald-300'
                                  : 'bg-white text-slate-500 hover:bg-slate-50'
                              }`}
                            >
                              Modify
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleAddUser} disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create User
                </Button>
              </DialogFooter>
              </DialogContent>
            </Dialog>
          </PageHeader>

      {/* User Management Card */}
      <Card className="shadow-xl border-none rounded-2xl overflow-hidden bg-white">
        <CardHeader className="border-b bg-slate-50/50 py-4 px-6">
          <div className="flex flex-row items-center justify-between gap-4 flex-wrap">
            <div>
              <CardTitle className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                User Management
              </CardTitle>
              <CardDescription className="mt-1">
                {filteredAndSortedUsers.length} of {users.length} user{users.length !== 1 ? 's' : ''} shown
              </CardDescription>
            </div>
            {/* Search Box */}
            <div className="relative w-full max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search by name, email, role..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 text-sm bg-white border-slate-200 focus:border-blue-400"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
        <div className="overflow-auto rounded-b-2xl" style={{ maxHeight: 600 }}>
          <table className="w-full caption-bottom text-sm">
            <thead className="[&_tr]:border-b">
              <tr>
                <th className="sticky top-0 left-0 z-30 bg-slate-50 w-[60px] pl-6 cursor-pointer whitespace-nowrap select-none border-r border-b border-slate-200 h-10 px-2 text-left align-middle font-medium text-sm" onClick={() => handleSort("id")}>
                  ID <SortIcon field="id" />
                </th>
                <th className="sticky top-0 left-[60px] z-30 bg-slate-50 cursor-pointer whitespace-nowrap select-none border-r border-b border-slate-200 h-10 px-2 text-left align-middle font-medium text-sm" onClick={() => handleSort("username")}>
                  Username <SortIcon field="username" />
                </th>
                <th className="sticky top-0 left-[120px] z-30 bg-slate-50 cursor-pointer whitespace-nowrap select-none border-r border-b border-slate-200 h-10 px-2 text-left align-middle font-medium text-sm" onClick={() => handleSort("email")}>
                  Email <SortIcon field="email" />
                </th>
                <th className="sticky top-0 z-20 bg-slate-50 border-b border-slate-200 cursor-pointer whitespace-nowrap select-none h-10 px-2 text-left align-middle font-medium text-sm" onClick={() => handleSort("phone_no")}>
                  Phone <SortIcon field="phone_no" />
                </th>
                <th className="sticky top-0 z-20 bg-slate-50 border-b border-slate-200 text-center cursor-pointer whitespace-nowrap select-none h-10 px-2 align-middle font-medium text-sm" onClick={() => handleSort("status")}>
                  Status <SortIcon field="status" />
                </th>
                <th className="sticky top-0 z-20 bg-slate-50 border-b border-slate-200 text-center cursor-pointer whitespace-nowrap select-none h-10 px-2 align-middle font-medium text-sm" onClick={() => handleSort("role")}>
                  Role <SortIcon field="role" />
                </th>
                <th className="sticky top-0 z-20 bg-slate-50 border-b border-slate-200 h-10 px-2 text-left align-middle font-medium text-sm">Page Access</th>
                <th className="sticky top-0 z-20 bg-slate-50 border-b border-slate-200 cursor-pointer whitespace-nowrap select-none h-10 px-2 text-left align-middle font-medium text-sm" onClick={() => handleSort("created_at")}>
                  Created At <SortIcon field="created_at" />
                </th>
                <th className="sticky top-0 z-20 bg-slate-50 border-b border-slate-200 text-center w-[100px] pr-6 h-10 px-2 align-middle font-medium text-sm">Actions</th>
              </tr>
            </thead>
            <tbody className="[&_tr:last-child]:border-0">
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="text-center py-16 p-2 align-middle">
                    <div className="flex flex-col items-center justify-center gap-3 text-muted-foreground">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                      <span className="text-sm font-medium">Loading users...</span>
                    </div>
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-16 p-2 align-middle">
                    <div className="flex flex-col items-center justify-center gap-3 text-muted-foreground">
                      <Users className="h-12 w-12 text-slate-300" />
                      <div>
                        <p className="font-medium text-slate-600">No users found</p>
                        <p className="text-sm text-slate-400">Click "Add User" to create one.</p>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : filteredAndSortedUsers.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-16 p-2 align-middle">
                    <div className="flex flex-col items-center justify-center gap-3 text-muted-foreground">
                      <Search className="h-10 w-10 text-slate-300" />
                      <p className="font-medium text-slate-600">No users match your search</p>
                      <p className="text-sm text-slate-400">Try a different keyword</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredAndSortedUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-slate-50/50 border-b transition-colors">
                    <td className="sticky left-0 z-10 bg-white font-medium pl-6 p-2 align-middle whitespace-nowrap border-r border-slate-100">{user.id}</td>
                    <td className="sticky left-[60px] z-10 bg-white font-semibold text-slate-800 p-2 align-middle whitespace-nowrap border-r border-slate-100">{user.username}</td>
                    <td className="sticky left-[120px] z-10 bg-white text-slate-600 p-2 align-middle whitespace-nowrap border-r border-slate-100 max-w-[200px] truncate">{user.email}</td>
                    <td className="text-slate-600 p-2 align-middle whitespace-nowrap">{user.phone_no || "—"}</td>
                    <td className="text-center p-2 align-middle whitespace-nowrap">
                      <Badge 
                        variant={user.status === "active" ? "default" : "secondary"}
                        className={user.status === "active" ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100" : ""}
                      >
                        {user.status}
                      </Badge>
                    </td>
                    <td className="text-center p-2 align-middle whitespace-nowrap">
                      <Badge 
                        variant="outline" 
                        className={user.role === "admin" ? "border-blue-500 text-blue-600 bg-blue-50" : "border-slate-300"}
                      >
                        <Shield className="h-3 w-3 mr-1" />
                        {user.role}
                      </Badge>
                    </td>
                    <td className="p-2 align-middle">
                      <div className="flex flex-wrap gap-1 max-w-[220px]">
                        {(() => {
                          const pages = getDisplayPageAccess(user)
                          if (pages.length === 0) return <span className="text-muted-foreground text-sm">None</span>
                          const shown = pages.slice(0, 1)
                          const rest = pages.length - 1
                          return (
                            <>
                              {shown.map(({ page, level }) => (
                                <Badge key={page} variant="secondary" className={`text-xs ${
                                  level === 'view_only' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-700'
                                }`}>
                                  {page} {level === 'view_only' ? '👁' : ''}
                                </Badge>
                              ))}
                              {rest > 0 && (
                                <Badge variant="secondary" className="text-xs bg-slate-100">
                                  +{rest} more
                                </Badge>
                              )}
                            </>
                          )
                        })()}
                      </div>
                    </td>
                    <td className="p-2 align-middle whitespace-nowrap text-sm text-slate-500">
                      {new Date(user.created_at).toLocaleDateString("en-GB")}
                    </td>
                    <td className="pr-6 p-2 align-middle">
                      <div className="flex justify-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(user)}
                          className="h-8 w-8 hover:bg-blue-50 hover:text-blue-600"
                          disabled={isReadOnly}
                          title={isReadOnly ? "View Only Access" : "Edit User"}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openDeleteDialog(user)}
                          className="h-8 w-8 text-destructive hover:bg-red-50 hover:text-red-600"
                          disabled={isReadOnly}
                          title={isReadOnly ? "View Only Access" : "Delete User"}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        </CardContent>
      </Card>

      {/* Footer */}
      <div className="flex items-center justify-center pt-12 border-t border-slate-100 opacity-100">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.5em] hover:text-primary transition-colors cursor-default">
          Powered by Botivate
        </p>
      </div>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={(open) => {
        setIsEditDialogOpen(open)
        if (!open) {
          resetForm()
          setSelectedUser(null)
        }
      }}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>
              Update user details and permissions for {selectedUser?.username}.
            </DialogDescription>
          </DialogHeader>
          {/* Inline form content to prevent re-mount on state change */}
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-username">Username *</Label>
                <Input
                  id="edit-username"
                  value={formData.username}
                  onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))}
                  placeholder="Enter username"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-email">Email</Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="Enter email"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-password">Password</Label>
                <div className="relative">
                  <Input
                    id="edit-password"
                    type={showPassword ? "text" : "password"}
                    value={formData.password}
                    onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                    placeholder="Leave blank to keep current"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-phone">Phone Number</Label>
                <Input
                  id="edit-phone"
                  value={formData.phone_no}
                  onChange={(e) => setFormData(prev => ({ ...prev, phone_no: e.target.value }))}
                  placeholder="Enter phone number"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-role">Role *</Label>
                <Select
                  value={formData.role}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, role: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map((role) => (
                      <SelectItem key={role} value={role}>
                        {role.charAt(0).toUpperCase() + role.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-status">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, status: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((status) => (
                      <SelectItem key={status} value={status}>
                        {status.charAt(0).toUpperCase() + status.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Page Access</Label>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={selectAllPages}>
                    Select All
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={deselectAllPages}>
                    Deselect All
                  </Button>
                </div>
              </div>
              <div className="space-y-1.5 max-h-[260px] overflow-y-auto border rounded-lg p-3">
                {PAGE_ACCESS_OPTIONS.map((page) => (
                  <div key={page} className="flex items-center justify-between py-1 px-1 rounded hover:bg-slate-50">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id={`edit-page-${page}`}
                        checked={isPageEnabled(page)}
                        onCheckedChange={() => togglePageAccess(page)}
                      />
                      <Label htmlFor={`edit-page-${page}`} className="text-sm cursor-pointer font-normal">
                        {page}
                      </Label>
                    </div>
                    {isPageEnabled(page) && (
                      <div className="flex rounded-md border overflow-hidden text-xs">
                        <button
                          type="button"
                          onClick={() => setPageAccessLevel(page, 'view_only')}
                          className={`px-2 py-0.5 font-medium transition-colors ${
                            getPageLevel(page) === 'view_only'
                              ? 'bg-amber-100 text-amber-700 border-amber-300'
                              : 'bg-white text-slate-500 hover:bg-slate-50'
                          }`}
                        >
                          View
                        </button>
                        <button
                          type="button"
                          onClick={() => setPageAccessLevel(page, 'modify')}
                          className={`px-2 py-0.5 font-medium transition-colors border-l ${
                            getPageLevel(page) === 'modify'
                              ? 'bg-emerald-100 text-emerald-700 border-emerald-300'
                              : 'bg-white text-slate-500 hover:bg-slate-50'
                          }`}
                        >
                          Modify
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEditUser} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the user "{selectedUser?.username}". This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteUser}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isSubmitting}
            >
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
