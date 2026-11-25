"use client"

import { useState, useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useToast } from "@/hooks/use-toast"
import { userApi, depotApi, brokerApi, salespersonApi } from "@/lib/api-service"
import { useAuth } from "@/hooks/use-auth"
import { useAuthContext } from "@/contexts/auth-context"
import { Pencil, Trash2, Loader2, RefreshCw, Settings, Shield, Eye, EyeOff, Search, Users, UserPlus } from "lucide-react"
import { useInfiniteQuery } from "@tanstack/react-query"
import { useInView } from "react-intersection-observer"
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

type AccessLevel = 'view_only' | 'modify'
type PageAccessMap = Record<string, AccessLevel>
type MasterTabAccessMap = Record<string, AccessLevel>

interface User {
  id: number
  username: string
  password: string
  email: string
  phone_no: string | null
  status: string
  role: string
  page_access: string[] | PageAccessMap | null
  depo_access: Record<string, string[]> | null
  features: Record<string, boolean> | null
  created_at: string
  updated_at: string
}

const PAGE_ACCESS_OPTIONS = [
  "Dashboard",
  "Owner Dashboard",
  "System Flow",
  "Commitment Punch",
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
  "Gate In",
  "Variable Parameters",
  "Settings",
  "Set Turn Around Time",
  "Production",
  "Master",
  "Inventory",
  "Reports"
]

// Pages that support per-page accessible depot/location selection
const DEPOT_SCOPED_PAGES = ["Order Punch", "Dispatch Planning", "Actual Dispatch", "Inventory"]

// Values selectable in Order Punch's "Is This Order Through" field
const ORDER_THROUGH_OPTIONS = ["Direct", "Broker", "Salesperson"]

// Values selectable in Order Punch's "Order Type" field
const ORDER_TYPE_OPTIONS = [
  { value: "regular", label: "Regular" },
  { value: "pre-approval", label: "Pre-Approval" },
]

// Values selectable in Order Punch's "Order Category" field
const ORDER_CATEGORY_OPTIONS = [
  { value: "Sales", label: "Sales" },
  { value: "Stock Transfer", label: "Stock Transfer" },
]

const MASTER_TABS = [
  { key: "customers", label: "Customers" },
  { key: "depots", label: "Depots" },
  { key: "brokers", label: "Brokers" },
  { key: "salespersons", label: "Salespersons" },
  { key: "sku_details", label: "SKU Details" },
  { key: "sku_selling_price", label: "SKU Pricing" },
  { key: "vehicle_master", label: "Vehicles" },
  { key: "driver_master", label: "Drivers" },
  { key: "transport_master", label: "Transporters" },
]

const STATUSES = ["active", "inactive"]

// Broker / Salesperson master row usable for Order Punch access: Active, named, not rejected
const isActiveMasterRow = (r: any) =>
  String(r?.status || "").trim().toLowerCase() === "active" &&
  String(r?.salesman_name || "").trim() !== "" &&
  String(r?.approval_status || "").trim().toLowerCase() !== "rejected"

export default function SettingsPage() {
  const { toast } = useToast()
  const { isReadOnly, user: currentUser } = useAuth()
  const { refreshUser } = useAuthContext()
  const currentUserRole = currentUser?.role ?? ''
  const isSuperAdmin = currentUserRole === 'super_admin'

  const availableRoles = isSuperAdmin
    ? ["super_admin", "admin", "user", "guard", "pc"]
    : ["user", "guard", "pc"]

  const [searchQuery, setSearchQuery] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { ref: loadMoreRef, inView } = useInView()

  // Single dialog for create/edit (null selectedUser = create mode)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [showPassword, setShowPassword] = useState(false)

  // Form state
  const [formData, setFormData] = useState({
    username: "",
    password: "",
    email: "",
    phone_no: "",
    status: "active",
    role: "user",
    page_access: {} as PageAccessMap,
    depo_access: {} as Record<string, string[]>,
    features: {} as Record<string, boolean>,
    master_tab_access: {} as MasterTabAccessMap,
    order_punch_access: {
      is_order_through: [] as string[],
      broker_name: [] as string[],
      salesperson_name: [] as string[],
      order_type: [] as string[],
      order_category: [] as string[],
    }
  })

  const [depots, setDepots] = useState<any[]>([])
  const [isDepotsLoading, setIsDepotsLoading] = useState(false)
  const [brokers, setBrokers] = useState<any[]>([])
  const [isBrokersLoading, setIsBrokersLoading] = useState(false)
  const [salespersons, setSalespersons] = useState<any[]>([])
  const [isSalespersonsLoading, setIsSalespersonsLoading] = useState(false)

  // Fetch depots for access control
  useEffect(() => {
    const fetchDepots = async () => {
      setIsDepotsLoading(true)
      try {
        const depotRes = await depotApi.getAll();
        if (depotRes.success && depotRes.data?.depots) {
          setDepots(depotRes.data.depots || [])
        }
      } catch (error) {
        console.error("Failed to fetch depots", error)
      } finally {
        setIsDepotsLoading(false)
      }
    }
    fetchDepots()
  }, [])

  // Fetch brokers for Order Punch field access control
  useEffect(() => {
    const fetchBrokers = async () => {
      setIsBrokersLoading(true)
      try {
        const brokerRes = await brokerApi.getAll({ all: "true" });
        if (brokerRes.success) {
          const list = brokerRes.data?.brokers || (Array.isArray(brokerRes.data) ? brokerRes.data : [])
          // Only Active brokers with a name are offered for access
          setBrokers(list.filter((b: any) => isActiveMasterRow(b)))
        }
      } catch (error) {
        console.error("Failed to fetch brokers", error)
      } finally {
        setIsBrokersLoading(false)
      }
    }
    fetchBrokers()
  }, [])

  // Fetch salespersons for Order Punch field access control
  useEffect(() => {
    const fetchSalespersons = async () => {
      setIsSalespersonsLoading(true)
      try {
        const salespersonRes = await salespersonApi.getAll({ all: "true" });
        if (salespersonRes.success) {
          const list = salespersonRes.data?.salespersons || (Array.isArray(salespersonRes.data) ? salespersonRes.data : [])
          // Only Active salespersons with a name are offered for access
          setSalespersons(list.filter((s: any) => isActiveMasterRow(s)))
        }
      } catch (error) {
        console.error("Failed to fetch salespersons", error)
      } finally {
        setIsSalespersonsLoading(false)
      }
    }
    fetchSalespersons()
  }, [])

  // User query with infinite pagination
  const {
    data: usersData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: isUsersLoading,
    refetch: refetchUsers,
  } = useInfiniteQuery({
    queryKey: ["settings-users", searchQuery],
    queryFn: async ({ pageParam = 1 }) => {
      const response = await userApi.getAll({
        page: pageParam,
        limit: 20,
        search: searchQuery
      });
      return response.success ? response.data : { users: [], pagination: { total: 0 } };
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      const currentCount = allPages.reduce((sum, page) => sum + (page.users?.length || 0), 0);
      return currentCount < (lastPage.pagination?.total || 0) ? allPages.length + 1 : undefined;
    },
  });

  const users = useMemo(() => {
    return usersData?.pages.flatMap((page) => page.users) || [];
  }, [usersData]);

  useEffect(() => {
    if (inView && hasNextPage) {
      fetchNextPage();
    }
  }, [inView, hasNextPage, fetchNextPage]);

  // Filter (client-side, on top of server search)
  const filteredUsers = useMemo(() => {
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

    // Admin can only see/manage non-admin, non-super_admin users (excluding themselves)
    if (!isSuperAdmin) {
      filtered = filtered.filter(u =>
        u.role !== 'admin' && u.role !== 'super_admin' && u.id !== currentUser?.id
      )
    }

    // Always sort by ID (ascending)
    filtered.sort((a, b) => Number(a.id) - Number(b.id))

    return filtered
  }, [users, searchQuery, isSuperAdmin, currentUser?.id])

  // Reset form
  const resetForm = () => {
    setFormData({
      username: "",
      password: "",
      email: "",
      phone_no: "",
      status: "active",
      role: "user",
      page_access: {},
      depo_access: {},
      features: {},
      master_tab_access: {} as MasterTabAccessMap,
      order_punch_access: { is_order_through: [], broker_name: [], salesperson_name: [], order_type: [], order_category: [] }
    })
    setShowPassword(false)
  }

  // Open create dialog
  const openCreateDialog = () => {
    resetForm()
    setSelectedUser(null)
    setIsDialogOpen(true)
  }

  // Submit (create or update based on selectedUser)
  const handleSubmit = async () => {
    if (selectedUser) {
      await handleEditUser()
    } else {
      await handleAddUser()
    }
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
      const featuresPayload = { ...formData.features, master_tabs: formData.master_tab_access, order_punch_access: formData.order_punch_access }
      const response = await userApi.create({ ...formData, page_access: formData.page_access as any, features: featuresPayload })
      if (response.success) {
        toast({
          title: "Success",
          description: "User created successfully",
        })
        refetchUsers()
        setIsDialogOpen(false)
        resetForm()
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
      const featuresPayload = { ...formData.features, master_tabs: formData.master_tab_access, order_punch_access: formData.order_punch_access }
      const updateData = {
        ...formData,
        page_access: formData.page_access as any,
        features: featuresPayload,
        password: formData.password === "••••••••" ? undefined : formData.password
      }

      const response = await userApi.update(selectedUser.id, updateData)
      if (response.success) {
        // If we just edited the currently logged-in user, refresh auth context immediately
        if (currentUser?.id === selectedUser.id) {
          refreshUser()
        }

        toast({
          title: "Success",
          description: "User updated successfully",
        })
        setIsDialogOpen(false)
        setSelectedUser(null)
        resetForm()
        refetchUsers()
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
        refetchUsers()
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
    // Normalize page_access: parse JSON string if TEXT column, then convert to PageAccessMap
    let pa: PageAccessMap = {}
    let pageAccessParsed: any = user.page_access
    if (typeof pageAccessParsed === 'string') {
      try { pageAccessParsed = JSON.parse(pageAccessParsed) } catch { pageAccessParsed = {} }
    }
    if (Array.isArray(pageAccessParsed)) {
      pageAccessParsed.forEach((p: string) => { pa[p] = 'modify' })
    } else if (pageAccessParsed && typeof pageAccessParsed === 'object') {
      pa = { ...pageAccessParsed } as PageAccessMap
    }
    // Normalize depo_access: parse JSON string (TEXT column) then ensure arrays
    let rawDepoAccess: Record<string, unknown> = {}
    const depoRaw = user.depo_access
    if (typeof depoRaw === 'string') {
      try { rawDepoAccess = JSON.parse(depoRaw) } catch { rawDepoAccess = {} }
    } else if (depoRaw && typeof depoRaw === 'object') {
      rawDepoAccess = depoRaw as Record<string, unknown>
    }
    const normalizedDepoAccess: Record<string, string[]> = {}
    Object.entries(rawDepoAccess).forEach(([page, val]) => {
      if (Array.isArray(val)) {
        normalizedDepoAccess[page] = val.map(String)
      } else if (typeof val === 'string') {
        // Handle PostgreSQL text array format like {Banari,Dallrajhara}
        normalizedDepoAccess[page] = (val as string)
          .replace(/^\{/, '').replace(/\}$/, '')
          .split(',')
          .map((s: string) => s.replace(/^"/, '').replace(/"$/, '').trim())
          .filter(Boolean)
      } else {
        normalizedDepoAccess[page] = []
      }
    })

    // Normalize features — extract master_tabs and order_punch_access separately
    let normalizedFeatures: Record<string, boolean> = {}
    let masterTabAccess: MasterTabAccessMap = {}
    let orderPunchAccess: { is_order_through: string[], broker_name: string[], salesperson_name: string[], order_type: string[], order_category: string[] } = { is_order_through: [], broker_name: [], salesperson_name: [], order_type: [], order_category: [] }
    const hasMasterAccess = Array.isArray(pageAccessParsed)
      ? pageAccessParsed.includes("Master")
      : !!(pageAccessParsed && typeof pageAccessParsed === 'object' && pageAccessParsed["Master"]);

    if (user.features && typeof user.features === 'object' && !Array.isArray(user.features)) {
      const { master_tabs, order_punch_access, ...restFeatures } = user.features as any
      normalizedFeatures = restFeatures as Record<string, boolean>
      if (order_punch_access && typeof order_punch_access === 'object') {
        orderPunchAccess = {
          is_order_through: Array.isArray(order_punch_access.is_order_through) ? order_punch_access.is_order_through.map(String) : [],
          broker_name: Array.isArray(order_punch_access.broker_name) ? order_punch_access.broker_name.map(String) : [],
          salesperson_name: Array.isArray(order_punch_access.salesperson_name) ? order_punch_access.salesperson_name.map(String) : [],
          order_type: Array.isArray(order_punch_access.order_type) ? order_punch_access.order_type.map(String) : [],
          order_category: Array.isArray(order_punch_access.order_category) ? order_punch_access.order_category.map(String) : []
        }
      }
      if (master_tabs && typeof master_tabs === 'object') {
        // Migrate old boolean format to new AccessLevel format
        const raw = master_tabs as Record<string, any>
        MASTER_TABS.forEach(t => {
          const val = raw[t.key]
          if (val === 'view_only' || val === 'modify') {
            masterTabAccess[t.key] = val
          } else if (val === true) {
            masterTabAccess[t.key] = 'modify'
          }
          // false / undefined → not in map (no access)
        })
      } else if (hasMasterAccess) {
        MASTER_TABS.forEach(t => { masterTabAccess[t.key] = 'modify' })
      }
    } else if (hasMasterAccess) {
      MASTER_TABS.forEach(t => { masterTabAccess[t.key] = 'modify' })
    }

    setFormData({
      username: user.username,
      password: "",
      email: user.email || "",
      phone_no: user.phone_no || "",
      status: user.status,
      role: user.role,
      page_access: pa,
      depo_access: normalizedDepoAccess,
      features: normalizedFeatures,
      master_tab_access: masterTabAccess,
      order_punch_access: orderPunchAccess
    })
    setIsDialogOpen(true)
  }

  // Open delete dialog
  const openDeleteDialog = (user: User) => {
    setSelectedUser(user)
    setIsDeleteDialogOpen(true)
  }

  // Toggle depo access for a specific page
  const toggleDepoAccess = (page: string, depoName: string) => {
    setFormData(prev => {
      const da = { ...prev.depo_access }
      const currentDepos = da[page] || []
      if (currentDepos.includes(depoName)) {
        da[page] = currentDepos.filter(d => d !== depoName)
      } else {
        da[page] = [...currentDepos, depoName]
      }
      return { ...prev, depo_access: da }
    })
  }

  // Toggle allowed "Is This Order Through" value for Order Punch access
  const toggleOrderThroughAccess = (value: string) => {
    setFormData(prev => {
      const current = prev.order_punch_access.is_order_through
      const next = current.includes(value) ? current.filter(v => v !== value) : [...current, value]
      return { ...prev, order_punch_access: { ...prev.order_punch_access, is_order_through: next } }
    })
  }

  // Toggle allowed broker name for Order Punch access
  const toggleBrokerNameAccess = (brokerName: string) => {
    setFormData(prev => {
      const current = prev.order_punch_access.broker_name
      const exists = current.some(b => b.toLowerCase() === brokerName.toLowerCase())
      const next = exists ? current.filter(b => b.toLowerCase() !== brokerName.toLowerCase()) : [...current, brokerName]
      return { ...prev, order_punch_access: { ...prev.order_punch_access, broker_name: next } }
    })
  }

  // Toggle allowed salesperson name for Order Punch access
  const toggleSalespersonNameAccess = (salespersonName: string) => {
    setFormData(prev => {
      const current = prev.order_punch_access.salesperson_name
      const exists = current.some(s => s.toLowerCase() === salespersonName.toLowerCase())
      const next = exists ? current.filter(s => s.toLowerCase() !== salespersonName.toLowerCase()) : [...current, salespersonName]
      return { ...prev, order_punch_access: { ...prev.order_punch_access, salesperson_name: next } }
    })
  }

  // Toggle allowed "Order Type" value for Order Punch access
  const toggleOrderTypeAccess = (value: string) => {
    setFormData(prev => {
      const current = prev.order_punch_access.order_type
      const next = current.includes(value) ? current.filter(v => v !== value) : [...current, value]
      return { ...prev, order_punch_access: { ...prev.order_punch_access, order_type: next } }
    })
  }

  // Toggle allowed "Order Category" value for Order Punch access
  const toggleOrderCategoryAccess = (value: string) => {
    setFormData(prev => {
      const current = prev.order_punch_access.order_category
      const next = current.includes(value) ? current.filter(v => v !== value) : [...current, value]
      return { ...prev, order_punch_access: { ...prev.order_punch_access, order_category: next } }
    })
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

  // Master tab access helpers
  const toggleMasterTab = (key: string) => {
    setFormData(prev => {
      const current = { ...prev.master_tab_access } as MasterTabAccessMap
      if (current[key]) {
        delete current[key]
      } else {
        current[key] = 'modify'
      }
      return { ...prev, master_tab_access: current }
    })
  }
  const setMasterTabLevel = (key: string, level: AccessLevel) => {
    setFormData(prev => ({
      ...prev,
      master_tab_access: { ...prev.master_tab_access, [key]: level } as MasterTabAccessMap
    }))
  }
  const selectAllMasterTabs = () => {
    const all: MasterTabAccessMap = {}
    MASTER_TABS.forEach(t => { all[t.key] = 'modify' })
    setFormData(prev => ({ ...prev, master_tab_access: all }))
  }
  const deselectAllMasterTabs = () => {
    setFormData(prev => ({ ...prev, master_tab_access: {} as MasterTabAccessMap }))
  }

  // Helper: is a page enabled in the form
  const isPageEnabled = (page: string) => {
    return !!(formData.page_access as PageAccessMap)[page]
  }

  // Helper: get level for a page in the form
  const getPageLevel = (page: string): AccessLevel => {
    return (formData.page_access as PageAccessMap)[page] || 'modify'
  }

  // Helper: count enabled pages for display in table
  const getPageAccessCount = (user: User): number => {
    if (!user.page_access) return 0
    let parsed: any = user.page_access
    if (typeof parsed === 'string') {
      try { parsed = JSON.parse(parsed) } catch { return 0 }
    }
    if (Array.isArray(parsed)) return parsed.length
    if (parsed && typeof parsed === 'object') return Object.keys(parsed).length
    return 0
  }

  const allPagesSelected = PAGE_ACCESS_OPTIONS.every(isPageEnabled)
  // "Master" is excluded from page-wise view/modify: its access is binary (the checkbox
  // grants access), and per-tab view/modify is controlled in the Accessible Master Tabs section.
  const enabledPages = PAGE_ACCESS_OPTIONS.filter(p => p !== "Master" && isPageEnabled(p))
  const enabledDepotPages = DEPOT_SCOPED_PAGES.filter(isPageEnabled)

  const roleBadgeClass = (role: string) =>
    role === "super_admin"
      ? "border-purple-300 text-purple-700 bg-purple-50"
      : role === "admin"
        ? "border-blue-300 text-blue-700 bg-blue-50"
        : "border-slate-200 text-slate-600 bg-slate-50"

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-[1400px] mx-auto">
      {/* Gradient Header Banner */}
      <div className="bg-gradient-to-br from-blue-100 via-purple-50 to-blue-50 rounded-xl border border-blue-100/60">
        <div className="flex justify-between items-center p-5">
          <div className="flex gap-3 items-center">
            <div className="h-12 w-12 rounded-xl bg-white/70 border border-white flex items-center justify-center shadow-sm">
              <Settings className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-primary">Settings</h1>
              <p className="text-muted-foreground text-sm">Manage system configuration and user access</p>
            </div>
          </div>
          <SidebarTrigger />
        </div>
      </div>

      {/* Toolbar: search + actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="relative w-full sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search by name, email, role..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <Button variant="outline" onClick={() => refetchUsers()} disabled={isUsersLoading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isUsersLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            onClick={openCreateDialog}
            disabled={isReadOnly}
            title={isReadOnly ? "View Only Access" : "Create User"}
          >
            <UserPlus className="mr-2 h-4 w-4" />
            Create User
          </Button>
        </div>
      </div>

      {/* Users Table */}
      <ScrollArea className="rounded-md border bg-white h-[64dvh]">
        <table className="w-full caption-bottom text-sm min-w-[760px]">
          <thead className="[&_tr]:border-b">
            <tr className="border-b bg-slate-50/70">
              <th className="h-11 px-4 text-left align-middle font-semibold text-slate-600 w-[70px]">ID</th>
              <th className="h-11 px-4 text-left align-middle font-semibold text-slate-600">Username</th>
              <th className="h-11 px-4 text-left align-middle font-semibold text-slate-600">Email</th>
              <th className="h-11 px-4 text-left align-middle font-semibold text-slate-600">Role</th>
              <th className="h-11 px-4 text-center align-middle font-semibold text-slate-600">Status</th>
              <th className="h-11 px-4 text-center align-middle font-semibold text-slate-600">Permissions</th>
              <th className="h-11 px-4 text-center align-middle font-semibold text-slate-600 w-[120px]">Actions</th>
            </tr>
          </thead>
          <tbody className="[&_tr:last-child]:border-0">
            {isUsersLoading && users.length === 0 ? (
              [...Array(6)].map((_, i) => (
                <tr key={i} className="border-b">
                  {[...Array(7)].map((_, j) => (
                    <td key={j} className="px-4 py-3">
                      <div className="h-4 w-full bg-slate-100 animate-pulse rounded" />
                    </td>
                  ))}
                </tr>
              ))
            ) : filteredUsers.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-20">
                  <div className="flex flex-col items-center justify-center gap-3 text-muted-foreground">
                    <Users className="h-12 w-12 text-slate-300" />
                    <div>
                      <p className="font-semibold text-slate-600">No users found</p>
                      <p className="text-sm text-slate-400">
                        {searchQuery ? "Try a different keyword." : 'Click "Create User" to add one.'}
                      </p>
                    </div>
                  </div>
                </td>
              </tr>
            ) : (
              filteredUsers.map((user) => (
                <tr key={user.id} className="border-b hover:bg-slate-50/60 transition-colors">
                  <td className="px-4 py-3 align-middle font-medium text-slate-500">{user.id}</td>
                  <td className="px-4 py-3 align-middle font-semibold text-slate-800">{user.username}</td>
                  <td className="px-4 py-3 align-middle text-slate-600 max-w-[220px] truncate">{user.email || "—"}</td>
                  <td className="px-4 py-3 align-middle">
                    <Badge variant="outline" className={`rounded-full ${roleBadgeClass(user.role)}`}>
                      <Shield className="h-3 w-3 mr-1" />
                      {user.role === 'super_admin' ? 'Super Admin' : user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 align-middle text-center">
                    <Badge
                      variant={user.status === "active" ? "default" : "secondary"}
                      className={`rounded-full ${user.status === "active" ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100" : ""}`}
                    >
                      {user.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 align-middle">
                    <div className="grid place-items-center">
                      <Button
                        variant="secondary"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => openEditDialog(user)}
                      >
                        <Eye className="w-3 h-3 mr-1.5" />
                        View Permissions
                        <span className="ml-1.5 text-[10px] text-slate-500">({getPageAccessCount(user)})</span>
                      </Button>
                    </div>
                  </td>
                  <td className="px-4 py-3 align-middle">
                    <div className="flex items-center justify-center gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 px-2"
                        onClick={() => openEditDialog(user)}
                        disabled={isReadOnly}
                        title={isReadOnly ? "View Only Access" : "Edit User"}
                      >
                        <Pencil className="h-3.5 w-3.5 sm:mr-1" />
                        <span className="hidden sm:inline">Edit</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => openDeleteDialog(user)}
                        disabled={isReadOnly}
                        title={isReadOnly ? "View Only Access" : "Delete User"}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        <div ref={loadMoreRef} className="py-4 flex justify-center">
          {isFetchingNextPage && (
            <div className="flex items-center gap-2 text-primary text-xs font-semibold">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Loading more users…</span>
            </div>
          )}
          {!hasNextPage && users.length > 0 && (
            <span className="text-xs text-muted-foreground">All {users.length} users loaded</span>
          )}
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="flex items-center justify-center pt-6">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.3em]">
          Powered by Botivate
        </p>
      </div>

      {/* Create / Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={(open) => {
        setIsDialogOpen(open)
        if (!open) {
          resetForm()
          setSelectedUser(null)
        }
      }}>
        <DialogContent className="w-full max-w-[95vw] sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg">
              {selectedUser ? "Edit" : "Create"} User Access
            </DialogTitle>
            <DialogDescription>
              {selectedUser
                ? `Update details and permissions for ${selectedUser.username}.`
                : "Create a new user account with role and page access permissions."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-7 py-2">
            {/* Basic details */}
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="user-username">Username *</Label>
                <Input
                  id="user-username"
                  value={formData.username}
                  onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))}
                  placeholder="Enter username"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="user-email">Email</Label>
                <Input
                  id="user-email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="Enter email"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="user-password">Password {selectedUser ? "" : "*"}</Label>
                <div className="relative">
                  <Input
                    id="user-password"
                    type={showPassword ? "text" : "password"}
                    value={formData.password}
                    onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                    placeholder={selectedUser ? "Leave blank to keep current" : "Enter password"}
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
                <Label htmlFor="user-phone">Phone Number</Label>
                <Input
                  id="user-phone"
                  value={formData.phone_no}
                  onChange={(e) => setFormData(prev => ({ ...prev, phone_no: e.target.value }))}
                  placeholder="Enter phone number"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="user-role">Role *</Label>
                <Select
                  value={formData.role}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, role: value }))}
                >
                  <SelectTrigger id="user-role">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableRoles.map((role) => (
                      <SelectItem key={role} value={role}>
                        {role === 'super_admin' ? 'Super Admin' : role.charAt(0).toUpperCase() + role.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="user-status">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, status: value }))}
                >
                  <SelectTrigger id="user-status">
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

            {/* Page Access */}
            <div className="space-y-2">
              <div className="flex justify-between items-end">
                <Label className="text-md">Page Access</Label>
                <div className="flex items-center gap-2 pb-1">
                  <Checkbox
                    id="select-all-pages"
                    checked={allPagesSelected}
                    onCheckedChange={(checked) => (checked ? selectAllPages() : deselectAllPages())}
                  />
                  <label htmlFor="select-all-pages" className="text-sm font-bold cursor-pointer">
                    Select All
                  </label>
                </div>
              </div>
              <div className="grid md:grid-cols-3 gap-3 p-4 border rounded-md max-h-[260px] overflow-y-auto">
                {PAGE_ACCESS_OPTIONS.map((page) => (
                  <div key={page} className="flex items-center gap-2">
                    <Checkbox
                      id={`page-${page}`}
                      checked={isPageEnabled(page)}
                      onCheckedChange={() => togglePageAccess(page)}
                    />
                    <Label htmlFor={`page-${page}`} className="font-normal cursor-pointer text-sm">
                      {page}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            {/* Page-wise Access Level (View / Modify) */}
            {enabledPages.length > 0 && (
              <div className="space-y-2">
                <Label className="text-md">Page-wise Access Level</Label>
                <div className="grid md:grid-cols-2 gap-3 p-4 border rounded-md max-h-[240px] overflow-y-auto">
                  {enabledPages.map((page) => (
                    <div key={page} className="flex items-center justify-between gap-2">
                      <span className="text-sm font-light truncate">{page}</span>
                      <Select
                        value={getPageLevel(page)}
                        onValueChange={(val) => setPageAccessLevel(page, val as AccessLevel)}
                      >
                        <SelectTrigger className="w-28 h-7 text-xs shrink-0">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="modify">Modify</SelectItem>
                          <SelectItem value="view_only">View Only</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Location (Depot) Access */}
            {enabledDepotPages.length > 0 && (
              <div className="space-y-2">
                <Label className="text-md">Location Access</Label>
                <div className="space-y-4 p-4 border rounded-md max-h-[280px] overflow-y-auto">
                  {enabledDepotPages.map((page) => (
                    <div key={page} className="space-y-2">
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{page}</p>
                      {isDepotsLoading ? (
                        <div className="flex items-center gap-1 text-xs text-slate-400">
                          <Loader2 className="h-3 w-3 animate-spin" /> Fetching depots…
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                          {Array.isArray(depots) && depots.map((depo, idx) => (
                            <div key={`${depo.depot_id || idx}-${page}`} className="flex items-center gap-2">
                              <Checkbox
                                id={`depo-${page}-${depo.depot_id}`}
                                checked={(formData.depo_access[page] || []).some(d => d.toLowerCase() === depo.depot_name.toLowerCase())}
                                onCheckedChange={() => toggleDepoAccess(page, depo.depot_name)}
                              />
                              <Label htmlFor={`depo-${page}-${depo.depot_id}`} className="text-xs font-normal cursor-pointer uppercase">
                                {depo.depot_name}
                              </Label>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Order Punch Field Access (Is This Order Through / Broker Name) */}
            {isPageEnabled('Order Punch') && (
              <div className="space-y-2">
                <Label className="text-md">Order Punch Field Access</Label>
                <div className="space-y-4 p-4 border rounded-md max-h-[320px] overflow-y-auto">
                  <div className="space-y-2">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Order Category</p>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {ORDER_CATEGORY_OPTIONS.map(opt => (
                        <div key={opt.value} className="flex items-center gap-2">
                          <Checkbox
                            id={`order-category-${opt.value}`}
                            checked={formData.order_punch_access.order_category.includes(opt.value)}
                            onCheckedChange={() => toggleOrderCategoryAccess(opt.value)}
                          />
                          <Label htmlFor={`order-category-${opt.value}`} className="text-xs font-normal cursor-pointer">
                            {opt.label}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Order Type</p>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {ORDER_TYPE_OPTIONS.map(opt => (
                        <div key={opt.value} className="flex items-center gap-2">
                          <Checkbox
                            id={`order-type-${opt.value}`}
                            checked={formData.order_punch_access.order_type.includes(opt.value)}
                            onCheckedChange={() => toggleOrderTypeAccess(opt.value)}
                          />
                          <Label htmlFor={`order-type-${opt.value}`} className="text-xs font-normal cursor-pointer">
                            {opt.label}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Is This Order Through</p>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {ORDER_THROUGH_OPTIONS.map(opt => (
                        <div key={opt} className="flex items-center gap-2">
                          <Checkbox
                            id={`order-through-${opt}`}
                            checked={formData.order_punch_access.is_order_through.includes(opt)}
                            onCheckedChange={() => toggleOrderThroughAccess(opt)}
                          />
                          <Label htmlFor={`order-through-${opt}`} className="text-xs font-normal cursor-pointer">
                            {opt}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                  {formData.order_punch_access.is_order_through.includes("Broker") && (
                    <div className="space-y-2">
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Broker Name</p>
                      {isBrokersLoading ? (
                        <div className="flex items-center gap-1 text-xs text-slate-400">
                          <Loader2 className="h-3 w-3 animate-spin" /> Fetching brokers…
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                          {brokers.map((b, idx) => (
                            <div key={b.id || idx} className="flex items-center gap-2">
                              <Checkbox
                                id={`broker-access-${b.id || idx}`}
                                checked={formData.order_punch_access.broker_name.some(n => n.toLowerCase() === (b.salesman_name || "").toLowerCase())}
                                onCheckedChange={() => toggleBrokerNameAccess(b.salesman_name)}
                              />
                              <Label htmlFor={`broker-access-${b.id || idx}`} className="text-xs font-normal cursor-pointer truncate">
                                {b.salesman_name}
                              </Label>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  {formData.order_punch_access.is_order_through.includes("Salesperson") && (
                    <div className="space-y-2">
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Salesperson Name</p>
                      {isSalespersonsLoading ? (
                        <div className="flex items-center gap-1 text-xs text-slate-400">
                          <Loader2 className="h-3 w-3 animate-spin" /> Fetching salespersons…
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                          {salespersons.map((s, idx) => (
                            <div key={s.id || idx} className="flex items-center gap-2">
                              <Checkbox
                                id={`salesperson-access-${s.id || idx}`}
                                checked={formData.order_punch_access.salesperson_name.some(n => n.toLowerCase() === (s.salesman_name || "").toLowerCase())}
                                onCheckedChange={() => toggleSalespersonNameAccess(s.salesman_name)}
                              />
                              <Label htmlFor={`salesperson-access-${s.id || idx}`} className="text-xs font-normal cursor-pointer truncate">
                                {s.salesman_name}
                              </Label>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Master Tabs */}
            {isPageEnabled('Master') && (
              <div className="space-y-2">
                <div className="flex justify-between items-end">
                  <Label className="text-md">Accessible Master Tabs</Label>
                  <div className="flex gap-2 pb-1">
                    <button type="button" onClick={selectAllMasterTabs} className="text-xs text-primary hover:underline">All</button>
                    <span className="text-xs text-slate-300">|</span>
                    <button type="button" onClick={deselectAllMasterTabs} className="text-xs text-primary hover:underline">None</button>
                  </div>
                </div>
                <div className="grid md:grid-cols-2 gap-3 p-4 border rounded-md max-h-[260px] overflow-y-auto">
                  {MASTER_TABS.map(tab => {
                    const tabEnabled = !!formData.master_tab_access[tab.key]
                    const tabLevel = (formData.master_tab_access as MasterTabAccessMap)[tab.key] || 'modify'
                    return (
                      <div key={tab.key} className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <Checkbox
                            id={`master-${tab.key}`}
                            checked={tabEnabled}
                            onCheckedChange={() => toggleMasterTab(tab.key)}
                          />
                          <Label htmlFor={`master-${tab.key}`} className="text-sm font-normal cursor-pointer truncate">{tab.label}</Label>
                        </div>
                        {tabEnabled && (
                          <Select
                            value={tabLevel}
                            onValueChange={(val) => setMasterTabLevel(tab.key, val as AccessLevel)}
                          >
                            <SelectTrigger className="w-28 h-7 text-xs shrink-0">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="modify">Modify</SelectItem>
                              <SelectItem value="view_only">View Only</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Features */}
            <div className="space-y-2">
              <Label className="text-md">Features</Label>
              <div className="grid md:grid-cols-2 gap-3 p-4 border rounded-md">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="feature-can_reorder_columns"
                    checked={!!formData.features.can_reorder_columns}
                    onCheckedChange={(checked) =>
                      setFormData(prev => ({ ...prev, features: { ...prev.features, can_reorder_columns: !!checked } }))
                    }
                  />
                  <Label htmlFor="feature-can_reorder_columns" className="text-sm cursor-pointer font-normal">
                    Can reorder columns
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="feature-can_toggle_columns"
                    checked={!!formData.features.can_toggle_columns}
                    onCheckedChange={(checked) =>
                      setFormData(prev => ({ ...prev, features: { ...prev.features, can_toggle_columns: !!checked } }))
                    }
                  />
                  <Label htmlFor="feature-can_toggle_columns" className="text-sm cursor-pointer font-normal">
                    Can toggle columns
                  </Label>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Close
            </Button>
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {selectedUser ? "Save Changes" : "Create User"}
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
