"use client"

import { useState, useEffect } from "react"
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
import { Plus, Pencil, Trash2, Loader2, RefreshCw, Users, Shield, Eye, EyeOff } from "lucide-react"
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

interface User {
  id: number
  username: string
  password: string
  email: string
  phone_no: string | null
  status: string
  role: string
  page_access: string[] | null
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
  "Settings"
]

const ROLES = ["admin", "user"]
const STATUSES = ["active", "inactive"]

export default function SettingsPage() {
  const { toast } = useToast()
  const [users, setUsers] = useState<User[]>([])
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
    page_access: [] as string[]
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

  // Reset form
  const resetForm = () => {
    setFormData({
      username: "",
      password: "",
      email: "",
      phone_no: "",
      status: "active",
      role: "user",
      page_access: []
    })
    setShowPassword(false)
  }

  // Handle add user
  const handleAddUser = async () => {
    if (!formData.username || !formData.password || !formData.email || !formData.role) {
      toast({
        title: "Validation Error",
        description: "Username, password, email, and role are required",
        variant: "destructive",
      })
      return
    }

    setIsSubmitting(true)
    try {
      const response = await userApi.create(formData)
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
        password: formData.password === "••••••••" ? undefined : formData.password
      }
      
      const response = await userApi.update(selectedUser.id, updateData)
      if (response.success) {
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
    setFormData({
      username: user.username,
      password: user.password,
      email: user.email,
      phone_no: user.phone_no || "",
      status: user.status,
      role: user.role,
      page_access: user.page_access || []
    })
    setIsEditDialogOpen(true)
  }

  // Open delete dialog
  const openDeleteDialog = (user: User) => {
    setSelectedUser(user)
    setIsDeleteDialogOpen(true)
  }

  // Toggle page access
  const togglePageAccess = (page: string) => {
    setFormData(prev => ({
      ...prev,
      page_access: prev.page_access.includes(page)
        ? prev.page_access.filter(p => p !== page)
        : [...prev.page_access, page]
    }))
  }

  // Select all pages
  const selectAllPages = () => {
    setFormData(prev => ({
      ...prev,
      page_access: PAGE_ACCESS_OPTIONS
    }))
  }

  // Deselect all pages
  const deselectAllPages = () => {
    setFormData(prev => ({
      ...prev,
      page_access: []
    }))
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
            <Button className="bg-primary hover:bg-primary/90">
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
                    <Label htmlFor="add-email">Email *</Label>
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
                  <div className="grid grid-cols-3 gap-2 max-h-[200px] overflow-y-auto border rounded-lg p-3">
                    {PAGE_ACCESS_OPTIONS.map((page) => (
                      <div key={page} className="flex items-center space-x-2">
                        <Checkbox
                          id={`add-page-${page}`}
                          checked={formData.page_access.includes(page)}
                          onCheckedChange={() => togglePageAccess(page)}
                        />
                        <Label htmlFor={`add-page-${page}`} className="text-sm cursor-pointer">
                          {page}
                        </Label>
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
        <CardHeader className="border-b bg-slate-50/50 flex flex-row items-center justify-between py-4 px-6">
          <div>
            <CardTitle className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              User Management
            </CardTitle>
            <CardDescription className="mt-1">
              {users.length} user{users.length !== 1 ? 's' : ''} registered
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50/50">
              <TableRow>
                <TableHead className="w-[60px] pl-6">ID</TableHead>
                <TableHead>Username</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-center">Role</TableHead>
                <TableHead>Page Access</TableHead>
                <TableHead>Created At</TableHead>
                <TableHead className="text-center w-[100px] pr-6">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-16">
                    <div className="flex flex-col items-center justify-center gap-3 text-muted-foreground">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                      <span className="text-sm font-medium">Loading users...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-16">
                    <div className="flex flex-col items-center justify-center gap-3 text-muted-foreground">
                      <Users className="h-12 w-12 text-slate-300" />
                      <div>
                        <p className="font-medium text-slate-600">No users found</p>
                        <p className="text-sm text-slate-400">Click "Add User" to create one.</p>
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                users.map((user) => (
                  <TableRow key={user.id} className="hover:bg-slate-50/50">
                    <TableCell className="font-medium pl-6">{user.id}</TableCell>
                    <TableCell className="font-semibold text-slate-800">{user.username}</TableCell>
                    <TableCell className="text-slate-600">{user.email}</TableCell>
                    <TableCell className="text-slate-600">{user.phone_no || "—"}</TableCell>
                    <TableCell className="text-center">
                      <Badge 
                        variant={user.status === "active" ? "default" : "secondary"}
                        className={user.status === "active" ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100" : ""}
                      >
                        {user.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge 
                        variant="outline" 
                        className={user.role === "admin" ? "border-blue-500 text-blue-600 bg-blue-50" : "border-slate-300"}
                      >
                        <Shield className="h-3 w-3 mr-1" />
                        {user.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1 max-w-[200px]">
                        {user.page_access && user.page_access.length > 0 ? (
                          user.page_access.length <= 2 ? (
                            user.page_access.map((page, idx) => (
                              <Badge key={idx} variant="secondary" className="text-xs bg-slate-100">
                                {page}
                              </Badge>
                            ))
                          ) : (
                            <>
                              <Badge variant="secondary" className="text-xs bg-slate-100">
                                {user.page_access[0]}
                              </Badge>
                              <Badge variant="secondary" className="text-xs bg-slate-100">
                                +{user.page_access.length - 1} more
                              </Badge>
                            </>
                          )
                        ) : (
                          <span className="text-muted-foreground text-sm">None</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-slate-500">
                      {new Date(user.created_at).toLocaleDateString("en-GB")}
                    </TableCell>
                    <TableCell className="pr-6">
                      <div className="flex justify-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(user)}
                          className="h-8 w-8 hover:bg-blue-50 hover:text-blue-600"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openDeleteDialog(user)}
                          className="h-8 w-8 text-destructive hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
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
                <Label htmlFor="edit-email">Email *</Label>
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
              <div className="grid grid-cols-3 gap-2 max-h-[200px] overflow-y-auto border rounded-lg p-3">
                {PAGE_ACCESS_OPTIONS.map((page) => (
                  <div key={page} className="flex items-center space-x-2">
                    <Checkbox
                      id={`edit-page-${page}`}
                      checked={formData.page_access.includes(page)}
                      onCheckedChange={() => togglePageAccess(page)}
                    />
                    <Label htmlFor={`edit-page-${page}`} className="text-sm cursor-pointer">
                      {page}
                    </Label>
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
