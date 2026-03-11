"use client"

import { useState, useEffect } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { customerApi, depotApi, brokerApi, skuDetailsApi, commonApi, skuSellingPriceApi, varCalcApi } from "@/lib/api-service"

import { useAuth } from "@/hooks/use-auth"
import { Plus, Pencil, Trash2, Loader2, RefreshCw, Users, Warehouse, Briefcase, Search, Download, Package, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react"
import { PageHeader } from "@/components/page-header"
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

// --- Types ---

interface Customer {
  id: number
  customer_id: string
  customer_name: string
  status: string
  contact_person: string
  contact: string
  email: string
  address_line_1: string
  address_line_2: string
  state: string
  pincode: string
  pan: string
  gstin: string
  gst_registered: string
}

interface Depot {
  depot_id: string
  status: string
  depot_name: string
  depot_address: string
  state: string
  salesman_broker_name: string
}

interface Broker {
  broker_id: string
  status: string
  salesman_name: string
  email_id: string
  mobile_no: string
  depot_name: string
  depot_id: string
}

interface SkuDetail {
  id: number
  status: string
  sku_code: string
  sku_name: string
  main_uom: string
  alternate_uom: string
  nos_per_main_uom: number | string
  units: string
  oil_filling_per_unit: number | string
  filling_units: string
  converted_kg: number | string
  packing_weight_per_main_unit: number | string
  weight_difference: number | string
  sku_weight: number | string
  packing_weight: number | string
  gross_weight: number | string
}

interface SkuSellingPrice {
  id: number
  packing_material: string
  sku_weight: number | string
  sku_unit: string
  conversion_formula: number | string
  sku_weight_in_gm: number | string
  packing_material_weight_in_gm: number | string
  net_oil_in_gm: number | string
  packing_cost: number | string
  var: string
  landing_cost: number | string
  selling_cost: number | string
  margin: string
  actual_margin: number | string
}

// --- Constants ---

const STATUS_OPTIONS = ["Active", "Inactive"]

export default function MasterPage() {
  const { toast } = useToast()
  const { isReadOnly } = useAuth()
  const [activeTab, setActiveTab] = useState("customers")
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")

  // Data states
  const [customers, setCustomers] = useState<Customer[]>([])
  const [depots, setDepots] = useState<Depot[]>([])
  const [brokers, setBrokers] = useState<Broker[]>([])
  const [skuDetails, setSkuDetails] = useState<SkuDetail[]>([])
  const [skuSellingPrices, setSkuSellingPrices] = useState<SkuSellingPrice[]>([])
  const [latestVarCalc, setLatestVarCalc] = useState<any>(null)


  // Sort states
  const [customerSort, setCustomerSort] = useState<{ col: string; dir: 'asc' | 'desc' }>({ col: 'customer_id', dir: 'asc' })
  const [depotSort, setDepotSort] = useState<{ col: string; dir: 'asc' | 'desc' }>({ col: 'depot_id', dir: 'asc' })
  const [brokerSort, setBrokerSort] = useState<{ col: string; dir: 'asc' | 'desc' }>({ col: 'broker_id', dir: 'asc' })
  const [skuSort, setSkuSort] = useState<{ col: string; dir: 'asc' | 'desc' }>({ col: 'sku_code', dir: 'asc' })
  const [skuSellingPriceSort, setSkuSellingPriceSort] = useState<{ col: string; dir: 'asc' | 'desc' }>({ col: 'packing_material', dir: 'asc' })

  // Dialog states
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<any | null>(null)
  const [deletingItem, setDeletingItem] = useState<any | null>(null)

  // Form states
  const [customerForm, setCustomerForm] = useState<Partial<Customer>>({
    customer_id: "",
    customer_name: "",
    status: "Active",
    contact_person: "",
    contact: "",
    email: "",
    address_line_1: "",
    address_line_2: "",
    state: "",
    pincode: "",
    pan: "",
    gstin: "",
    gst_registered: "Yes"
  })

  const [depotForm, setDepotForm] = useState<Partial<Depot>>({
    depot_id: "",
    status: "Active",
    depot_name: "",
    depot_address: "",
    state: "",
    salesman_broker_name: ""
  })

  const [brokerForm, setBrokerForm] = useState<Partial<Broker>>({
    broker_id: "",
    status: "Active",
    salesman_name: "",
    email_id: "",
    mobile_no: "",
    depot_name: "",
    depot_id: ""
  })

  const [skuDetailsForm, setSkuDetailsForm] = useState<Partial<SkuDetail>>({
    status: "Active",
    sku_code: "",
    sku_name: "",
    main_uom: "",
    alternate_uom: "",
    nos_per_main_uom: "",
    units: "",
    oil_filling_per_unit: "",
    filling_units: "",
    converted_kg: "",
    packing_weight_per_main_unit: "",
    weight_difference: "",
    sku_weight: "",
    packing_weight: "",
    gross_weight: ""
  })

  const [SkuSellingPriceForm, setSkuSellingPrice] = useState<Partial<SkuSellingPrice>>({
    id: 0,
    packing_material: "",
    sku_weight: 0,
    sku_unit: "",
    conversion_formula: 0,
    sku_weight_in_gm: 0,
    packing_material_weight_in_gm: 0,
    net_oil_in_gm: 0,
    packing_cost: 0,
    var: "",
    landing_cost: 0,
    selling_cost: 0,
    margin: "",
    actual_margin: 0
  })

  // --- Data Fetching ---

  const fetchData = async () => {
    setIsLoading(true)
    try {
      const params = { all: 'true' }
      if (activeTab === "customers") {
        const res = await customerApi.getAll(params)
        if (res.success) setCustomers(res.data)
      } else if (activeTab === "depots") {
        const res = await depotApi.getAll(params)
        if (res.success) setDepots(res.data)
      } else if (activeTab === "brokers") {
        const res = await brokerApi.getAll(params)
        if (res.success) setBrokers(res.data)
      } else if (activeTab === "sku_details") {
        const res = await skuDetailsApi.getAll(params)
        if (res.success) setSkuDetails(res.data)
      } else if (activeTab === "sku_selling_price") {
        const res = await skuSellingPriceApi.getAll()
        if (res.success) setSkuSellingPrices(res.data)
        
        // Also fetch latest var calc for landing cost recalculation
        const varRes = await varCalcApi.getLatest()
        if (varRes.success) setLatestVarCalc(varRes.data)
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to fetch data",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [activeTab])

  // --- Handlers ---

  const resetForms = () => {
    setCustomerForm({
      customer_id: "",
      customer_name: "",
      status: "Active",
      contact_person: "",
      contact: "",
      email: "",
      address_line_1: "",
      address_line_2: "",
      state: "",
      pincode: "",
      pan: "",
      gstin: "",
      gst_registered: "Yes"
    })
    setDepotForm({
      depot_id: "",
      status: "Active",
      depot_name: "",
      depot_address: "",
      state: "",
      salesman_broker_name: ""
    })
    setBrokerForm({
      broker_id: "",
      status: "Active",
      salesman_name: "",
      email_id: "",
      mobile_no: "",
      depot_name: "",
      depot_id: ""
    })
    setSkuDetailsForm({
      status: "Active",
      sku_code: "",
      sku_name: "",
      main_uom: "",
      alternate_uom: "",
      nos_per_main_uom: "",
      units: "",
      oil_filling_per_unit: "",
      filling_units: "",
      converted_kg: "",
      packing_weight_per_main_unit: "",
      weight_difference: "",
      sku_weight: "",
      packing_weight: "",
      gross_weight: ""
    })
    setEditingItem(null)
  }

  const handleCreateOrUpdate = async () => {
    setIsSubmitting(true)
    try {
      let res
      if (activeTab === "customers") {
        if (editingItem) {
          res = await customerApi.update(editingItem.id, customerForm)
        } else {
          res = await customerApi.create(customerForm)
        }
      } else if (activeTab === "depots") {
        if (editingItem) {
          res = await depotApi.update(editingItem.depot_id, depotForm)
        } else {
          res = await depotApi.create(depotForm)
        }
      } else if (activeTab === "brokers") {
        if (editingItem) {
          res = await brokerApi.update(editingItem.broker_id, brokerForm)
        } else {
          res = await brokerApi.create(brokerForm)
        }
      } else if (activeTab === "sku_details") {
        if (editingItem) {
          res = await skuDetailsApi.update(editingItem.id, skuDetailsForm)
        } else {
          res = await skuDetailsApi.create(skuDetailsForm)
        }
      } else if (activeTab === "sku_selling_price") {
        if (editingItem) {
          res = await skuSellingPriceApi.update(editingItem.id, SkuSellingPriceForm)
        } else {
          res = await skuSellingPriceApi.create(SkuSellingPriceForm)
        }
      }

      if (res?.success) {
        toast({ title: "Success", description: editingItem ? "Updated successfully" : "Created successfully" })
        setIsDialogOpen(false)
        resetForms()
        fetchData()
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to save data",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!deletingItem) return
    setIsSubmitting(true)
    try {
      let res
      if (activeTab === "customers") {
        res = await customerApi.delete(deletingItem.id)
      } else if (activeTab === "depots") {
        res = await depotApi.delete(deletingItem.depot_id)
      } else if (activeTab === "brokers") {
        res = await brokerApi.delete(deletingItem.broker_id)
      } else if (activeTab === "sku_details") {
        res = await skuDetailsApi.delete(deletingItem.id)
      } else if (activeTab === "sku_selling_price") {
        res = await skuSellingPriceApi.delete(deletingItem.id)
      }

      if (res?.success) {
        toast({ title: "Success", description: "Deleted successfully" })
        setIsDeleteDialogOpen(false)
        setDeletingItem(null)
        fetchData()
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete item",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const fetchNextId = async (type: 'customer' | 'depot' | 'broker' | 'sku') => {
    try {
      const res = await commonApi.getNextId(type)
      if (res.success) {
        return res.data.nextId
      }
    } catch (error) {
      console.error("Failed to fetch next ID", error)
    }
    return ""
  }

  const handleOpenAddDialog = async () => {
    resetForms()
    setIsDialogOpen(true)
    
    // Fetch next ID based on active tab
    let nextId = ""
    if (activeTab === "customers") {
      nextId = await fetchNextId('customer')
      setCustomerForm(prev => ({ ...prev, customer_id: nextId }))
    } else if (activeTab === "depots") {
      nextId = await fetchNextId('depot')
      setDepotForm(prev => ({ ...prev, depot_id: nextId }))
    } else if (activeTab === "brokers") {
      nextId = await fetchNextId('broker')
      setBrokerForm(prev => ({ ...prev, broker_id: nextId }))
    } else if (activeTab === "sku_details") {
      nextId = await fetchNextId('sku')
      setSkuDetailsForm(prev => ({ ...prev, sku_code: nextId }))
    } else if (activeTab === "sku_selling_price") {
      // No ID fetching for selling price as it usually depends on existing SKUs or is auto-id
      setSkuSellingPrice({
        id: 0,
        packing_material: "",
        sku_weight: 0,
        sku_unit: "",
        conversion_formula: 0,
        sku_weight_in_gm: 0,
        packing_material_weight_in_gm: 0,
        net_oil_in_gm: 0,
        packing_cost: 0,
        var: "",
        landing_cost: 0,
        selling_cost: 0,
        margin: "",
        actual_margin: 0
      })
    }
  }

  const openEditDialog = (item: any) => {
    setEditingItem(item)
    if (activeTab === "customers") {
      setCustomerForm({ ...item })
    } else if (activeTab === "depots") {
      setDepotForm({ ...item })
    } else if (activeTab === "brokers") {
      setBrokerForm({ ...item })
    } else if (activeTab === "sku_details") {
      setSkuDetailsForm({ ...item })
    } else if (activeTab === "sku_selling_price") {
      setSkuSellingPrice({ ...item })
    }
    setIsDialogOpen(true)
  }

  // --- Filter Logic ---

  const filteredCustomers = customers.filter(c => 
    c.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.customer_id?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const filteredDepots = depots.filter(d => 
    d.depot_name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    d.depot_id?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const filteredBrokers = brokers.filter(b => 
    b.salesman_name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    b.broker_id?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const filteredSkuDetails = skuDetails.filter(s => 
    s.sku_name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    s.sku_code?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const filteredSkuSellingPrices = skuSellingPrices.filter(s =>
    s.packing_material?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // --- Sort helpers ---
  type SortDir = 'asc' | 'desc'

  const sortData = <T extends Record<string, any>>(data: T[], col: string, dir: SortDir): T[] => {
    return [...data].sort((a, b) => {
      const av = a[col] ?? ''
      const bv = b[col] ?? ''
      return dir === 'asc'
        ? String(av).localeCompare(String(bv), undefined, { numeric: true, sensitivity: 'base' })
        : String(bv).localeCompare(String(av), undefined, { numeric: true, sensitivity: 'base' })
    })
  }

  const toggleSort = (
    col: string,
    current: { col: string; dir: SortDir },
    setter: React.Dispatch<React.SetStateAction<{ col: string; dir: SortDir }>>
  ) => {
    setter(current.col === col ? { col, dir: current.dir === 'asc' ? 'desc' : 'asc' } : { col, dir: 'asc' })
  }

  const SortIcon = ({ col, sort }: { col: string; sort: { col: string; dir: SortDir } }) => {
    if (sort.col !== col) return <ArrowUpDown className="ml-1 h-3 w-3 opacity-40 inline" />
    return sort.dir === 'asc'
      ? <ArrowUp className="ml-1 h-3 w-3 text-blue-600 inline" />
      : <ArrowDown className="ml-1 h-3 w-3 text-blue-600 inline" />
  }

  const sortedCustomers = sortData(filteredCustomers, customerSort.col, customerSort.dir)
  const sortedDepots = sortData(filteredDepots, depotSort.col, depotSort.dir)
  const sortedBrokers = sortData(filteredBrokers, brokerSort.col, brokerSort.dir)
  const sortedSkuDetails = sortData(filteredSkuDetails, skuSort.col, skuSort.dir)
  const sortedSkuSellingPrices = sortData(filteredSkuSellingPrices, skuSellingPriceSort.col, skuSellingPriceSort.dir)

  // --- Render Helpers ---


  const renderCustomerForm = () => (
    <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto px-1">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="customer_id">Customer ID *</Label>
          <Input id="customer_id" value={customerForm.customer_id} readOnly className="bg-slate-100" placeholder="Auto-generated" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="customer_name">Customer Name *</Label>
          <Input id="customer_name" value={customerForm.customer_name} onChange={e => setCustomerForm({...customerForm, customer_name: e.target.value})} placeholder="Enter name" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="status">Status</Label>
          <Select value={customerForm.status} onValueChange={val => setCustomerForm({...customerForm, status: val})}>
            <SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" value={customerForm.email} onChange={e => setCustomerForm({...customerForm, email: e.target.value})} placeholder="email@example.com" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="contact_person">Contact Person</Label>
          <Input id="contact_person" value={customerForm.contact_person} onChange={e => setCustomerForm({...customerForm, contact_person: e.target.value})} placeholder="Enter name" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="contact">Contact Number</Label>
          <Input id="contact" value={customerForm.contact} onChange={e => setCustomerForm({...customerForm, contact: e.target.value})} placeholder="Enter number" />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="address_line_1">Address Line 1</Label>
        <Input id="address_line_1" value={customerForm.address_line_1} onChange={e => setCustomerForm({...customerForm, address_line_1: e.target.value})} placeholder="Street address" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="state">State</Label>
          <Input id="state" value={customerForm.state} onChange={e => setCustomerForm({...customerForm, state: e.target.value})} placeholder="Enter state" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="pincode">Pincode</Label>
          <Input id="pincode" value={customerForm.pincode} onChange={e => setCustomerForm({...customerForm, pincode: e.target.value})} placeholder="e.g. 492001" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="pan">PAN</Label>
          <Input id="pan" value={customerForm.pan} onChange={e => setCustomerForm({...customerForm, pan: e.target.value})} placeholder="Enter PAN" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="gstin">GSTIN</Label>
          <Input id="gstin" value={customerForm.gstin} onChange={e => setCustomerForm({...customerForm, gstin: e.target.value})} placeholder="Enter GSTIN" />
        </div>
      </div>
    </div>
  )

  const renderDepotForm = () => (
    <div className="grid gap-4 py-4 px-1">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="depot_id">Depot ID *</Label>
          <Input id="depot_id" value={depotForm.depot_id} readOnly className="bg-slate-100" placeholder="Auto-generated" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="depot_name">Depot Name *</Label>
          <Input id="depot_name" value={depotForm.depot_name} onChange={e => setDepotForm({...depotForm, depot_name: e.target.value})} placeholder="Enter name" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="status">Status</Label>
          <Select value={depotForm.status} onValueChange={val => setDepotForm({...depotForm, status: val})}>
            <SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="state">State</Label>
          <Input id="state" value={depotForm.state} onChange={e => setDepotForm({...depotForm, state: e.target.value})} placeholder="Enter state" />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="depot_address">Depot Address</Label>
        <Input id="depot_address" value={depotForm.depot_address} onChange={e => setDepotForm({...depotForm, depot_address: e.target.value})} placeholder="Full address" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="salesman_ref">Salesman/Broker Name</Label>
        <Input id="salesman_ref" value={depotForm.salesman_broker_name} onChange={e => setDepotForm({...depotForm, salesman_broker_name: e.target.value})} placeholder="Enter name" />
      </div>
    </div>
  )

  const renderBrokerForm = () => (
    <div className="grid gap-4 py-4 px-1">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="broker_id">Broker ID *</Label>
          <Input id="broker_id" value={brokerForm.broker_id} readOnly className="bg-slate-100" placeholder="Auto-generated" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="salesman_name">Salesman Name *</Label>
          <Input id="salesman_name" value={brokerForm.salesman_name} onChange={e => setBrokerForm({...brokerForm, salesman_name: e.target.value})} placeholder="Enter name" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="status">Status</Label>
          <Select value={brokerForm.status} onValueChange={val => setBrokerForm({...brokerForm, status: val})}>
            <SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="mobile_no">Mobile Number</Label>
          <Input id="mobile_no" value={brokerForm.mobile_no} onChange={e => setBrokerForm({...brokerForm, mobile_no: e.target.value})} placeholder="Enter number" />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="email_id">Email ID</Label>
        <Input id="email_id" value={brokerForm.email_id} onChange={e => setBrokerForm({...brokerForm, email_id: e.target.value})} placeholder="email@example.com" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="depot_name_ref">Depot Name</Label>
          <Input id="depot_name_ref" value={brokerForm.depot_name} onChange={e => setBrokerForm({...brokerForm, depot_name: e.target.value})} placeholder="Enter depot name" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="depot_id_ref">Depot ID</Label>
          <Input id="depot_id_ref" value={brokerForm.depot_id} onChange={e => setBrokerForm({...brokerForm, depot_id: e.target.value})} placeholder="e.g. D-001" />
        </div>
      </div>
    </div>
  )

  const renderSkuDetailsForm = () => (
    <div className="grid gap-4 py-4 px-1 max-h-[70vh] overflow-y-auto">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="sku_code">SKU Code *</Label>
          <Input id="sku_code" value={skuDetailsForm.sku_code} readOnly className="bg-slate-100" placeholder="Auto-generated" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="sku_name">SKU Name *</Label>
          <Input id="sku_name" value={skuDetailsForm.sku_name} onChange={e => setSkuDetailsForm({...skuDetailsForm, sku_name: e.target.value})} placeholder="Enter name" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="status">Status</Label>
          <Select value={skuDetailsForm.status} onValueChange={val => setSkuDetailsForm({...skuDetailsForm, status: val})}>
            <SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="main_uom">Main UOM</Label>
          <Input id="main_uom" value={skuDetailsForm.main_uom} onChange={e => setSkuDetailsForm({...skuDetailsForm, main_uom: e.target.value})} placeholder="e.g. Box" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="alternate_uom">Alternate UOM</Label>
          <Input id="alternate_uom" value={skuDetailsForm.alternate_uom} onChange={e => setSkuDetailsForm({...skuDetailsForm, alternate_uom: e.target.value})} placeholder="e.g. Pcs" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="nos_per_main_uom">Nos per Main UOM</Label>
          <Input id="nos_per_main_uom" type="number" value={skuDetailsForm.nos_per_main_uom} onChange={e => setSkuDetailsForm({...skuDetailsForm, nos_per_main_uom: e.target.value})} placeholder="0" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="units">Units</Label>
          <Input id="units" value={skuDetailsForm.units} onChange={e => setSkuDetailsForm({...skuDetailsForm, units: e.target.value})} placeholder="e.g. Kg" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="oil_filling_per_unit">Oil Filling per Unit</Label>
          <Input id="oil_filling_per_unit" type="number" value={skuDetailsForm.oil_filling_per_unit} onChange={e => setSkuDetailsForm({...skuDetailsForm, oil_filling_per_unit: e.target.value})} placeholder="0.00" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="filling_units">Filling Units</Label>
          <Input id="filling_units" value={skuDetailsForm.filling_units} onChange={e => setSkuDetailsForm({...skuDetailsForm, filling_units: e.target.value})} placeholder="e.g. Ltr" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="converted_kg">Converted Kg</Label>
          <Input id="converted_kg" type="number" value={skuDetailsForm.converted_kg} onChange={e => setSkuDetailsForm({...skuDetailsForm, converted_kg: e.target.value})} placeholder="0.00" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="packing_weight_per_main_unit">Packing Weight/Main Unit</Label>
          <Input id="packing_weight_per_main_unit" type="number" value={skuDetailsForm.packing_weight_per_main_unit} onChange={e => setSkuDetailsForm({...skuDetailsForm, packing_weight_per_main_unit: e.target.value})} placeholder="0.00" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="weight_difference">Weight Difference</Label>
          <Input id="weight_difference" type="number" value={skuDetailsForm.weight_difference} onChange={e => setSkuDetailsForm({...skuDetailsForm, weight_difference: e.target.value})} placeholder="0.00" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="sku_weight">SKU Weight</Label>
          <Input id="sku_weight" type="number" value={skuDetailsForm.sku_weight} onChange={e => setSkuDetailsForm({...skuDetailsForm, sku_weight: e.target.value})} placeholder="0.00" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="packing_weight">Packing Weight</Label>
          <Input id="packing_weight" type="number" value={skuDetailsForm.packing_weight} onChange={e => setSkuDetailsForm({...skuDetailsForm, packing_weight: e.target.value})} placeholder="0.00" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="gross_weight">Gross Weight</Label>
          <Input id="gross_weight" type="number" value={skuDetailsForm.gross_weight} onChange={e => setSkuDetailsForm({...skuDetailsForm, gross_weight: e.target.value})} placeholder="0.00" />
        </div>
      </div>
    </div>
  )

  const renderSkuSellingPriceForm = () => (
    <div className="grid gap-4 py-4 px-1 max-h-[70vh] overflow-y-auto">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="packing_material">Packing Material *</Label>
          <Input id="packing_material" value={SkuSellingPriceForm.packing_material} onChange={e => setSkuSellingPrice({...SkuSellingPriceForm, packing_material: e.target.value})} placeholder="Enter material name" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="sku_unit">SKU Unit</Label>
          <Input id="sku_unit" value={SkuSellingPriceForm.sku_unit} readOnly className="bg-slate-100" placeholder="e.g. Ltr" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="sku_weight_sp">SKU Weight</Label>
          <Input id="sku_weight_sp" type="number" value={SkuSellingPriceForm.sku_weight} onChange={e => setSkuSellingPrice({...SkuSellingPriceForm, sku_weight: e.target.value})} placeholder="0.00" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="conversion_formula">Conversion Formula</Label>
          <Input id="conversion_formula" type="number" value={SkuSellingPriceForm.conversion_formula} onChange={e => setSkuSellingPrice({...SkuSellingPriceForm, conversion_formula: e.target.value})} placeholder="0.00" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="sku_weight_in_gm">SKU Weight (gm)</Label>
          <Input id="sku_weight_in_gm" type="number" value={SkuSellingPriceForm.sku_weight_in_gm} onChange={e => {
            const rawVal = e.target.value;
            const val = parseFloat(rawVal) || 0;
            const pmWeight = parseFloat(SkuSellingPriceForm.packing_material_weight_in_gm?.toString() || "0");
            const netOilInGm = val - pmWeight;
            
            // Recalculate landing cost: (GT / 1000) * netOilInGm + packingCost
            let newLandingCost = SkuSellingPriceForm.landing_cost || 0;
            if (latestVarCalc?.gt) {
              const gt = parseFloat(latestVarCalc.gt) || 0;
              const pCost = parseFloat(SkuSellingPriceForm.packing_cost?.toString() || "0");
              newLandingCost = ((gt / 1000) * netOilInGm + pCost).toFixed(2);
            }

            setSkuSellingPrice({
              ...SkuSellingPriceForm, 
              sku_weight_in_gm: rawVal,
              net_oil_in_gm: netOilInGm.toFixed(2),
              landing_cost: newLandingCost
            });
          }} placeholder="0.00" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="packing_material_weight_in_gm">Packing Mat. Wt (gm)</Label>
          <Input id="packing_material_weight_in_gm" type="number" value={SkuSellingPriceForm.packing_material_weight_in_gm} onChange={e => {
            const rawVal = e.target.value;
            const val = parseFloat(rawVal) || 0;
            const skuWt = parseFloat(SkuSellingPriceForm.sku_weight_in_gm?.toString() || "0");
            const netOilInGm = skuWt - val;

            // Recalculate landing cost: (GT / 1000) * netOilInGm + packingCost
            let newLandingCost = SkuSellingPriceForm.landing_cost || 0;
            if (latestVarCalc?.gt) {
              const gt = parseFloat(latestVarCalc.gt) || 0;
              const pCost = parseFloat(SkuSellingPriceForm.packing_cost?.toString() || "0");
              newLandingCost = ((gt / 1000) * netOilInGm + pCost).toFixed(2);
            }

            setSkuSellingPrice({
              ...SkuSellingPriceForm, 
              packing_material_weight_in_gm: rawVal,
              net_oil_in_gm: netOilInGm.toFixed(2),
              landing_cost: newLandingCost
            });
          }} placeholder="0.00" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="net_oil_in_gm">Net Oil (gm)</Label>
          <Input id="net_oil_in_gm" type="number" value={SkuSellingPriceForm.net_oil_in_gm} readOnly className="bg-slate-100" placeholder="Auto-calculated" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="packing_cost">Packing Cost</Label>
          <Input id="packing_cost" type="number" value={SkuSellingPriceForm.packing_cost} onChange={e => {
            const rawVal = e.target.value;
            const val = parseFloat(rawVal) || 0;
            
            // Recalculate landing cost when packing cost changes as well
            let newLandingCost = SkuSellingPriceForm.landing_cost || 0;
            if (latestVarCalc?.gt) {
              const gt = parseFloat(latestVarCalc.gt) || 0;
              const netOilInGm = parseFloat(SkuSellingPriceForm.net_oil_in_gm?.toString() || "0");
              newLandingCost = ((gt / 1000) * netOilInGm + val).toFixed(2);
            }

            setSkuSellingPrice({
              ...SkuSellingPriceForm, 
              packing_cost: rawVal,
              landing_cost: newLandingCost
            });
          }} placeholder="0.00" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="landing_cost">Landing Cost</Label>
          <Input id="landing_cost" type="number" value={SkuSellingPriceForm.landing_cost} readOnly className="bg-slate-100" placeholder="Auto-calculated" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="var">Var</Label>
          <Input id="var" value={SkuSellingPriceForm.var} onChange={e => setSkuSellingPrice({...SkuSellingPriceForm, var: e.target.value})} placeholder="e.g. 1" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="margin">Margin</Label>
          <Input id="margin" value={SkuSellingPriceForm.margin} onChange={e => setSkuSellingPrice({...SkuSellingPriceForm, margin: e.target.value})} placeholder="e.g. 10%" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="landing_cost">Landing Cost</Label>
          <Input id="landing_cost" type="number" value={SkuSellingPriceForm.landing_cost} readOnly className="bg-slate-100" placeholder="Auto" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="actual_margin">Actual Margin</Label>
          <Input id="actual_margin" type="number" value={SkuSellingPriceForm.actual_margin} readOnly className="bg-slate-100" placeholder="Auto" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="selling_cost">Selling Cost</Label>
          <Input id="selling_cost" type="number" value={SkuSellingPriceForm.selling_cost} readOnly className="bg-slate-100" placeholder="Auto" />
        </div>
      </div>
    </div>
  )

  return (
    <div className="p-8 max-w-7xl mx-auto min-h-screen space-y-8 animate-in fade-in duration-700">
      <PageHeader 
        title="Master Data" 
        description="Manage customers, depots, and brokers details"
      >
        <div className="flex items-center gap-4">
          <div className="relative w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input 
              placeholder={`Search ${activeTab}...`} 
              className="pl-10" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Button variant="outline" onClick={fetchData} disabled={isLoading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open)
            if (!open) resetForms()
          }}>
            <DialogTrigger asChild>
              <Button className="bg-primary hover:bg-primary/90 shadow-lg" disabled={isReadOnly} onClick={handleOpenAddDialog} title={isReadOnly ? "View Only Access" : `Add New ${activeTab.replace('_', ' ')}`}>
                <Plus className="mr-2 h-4 w-4" />
                Add New {activeTab === "customers" ? "Customer" : activeTab === "depots" ? "Depot" : activeTab === "sku_details" ? "SKU" : activeTab === "sku_selling_price" ? "SKU Price" : "Broker"}
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-xl">
              <DialogHeader>
                <DialogTitle>{editingItem ? "Edit" : "Add New"} {activeTab === "sku_details" ? "SKU" : activeTab === "sku_selling_price" ? "SKU Selling Price" : activeTab.slice(0, -1)}</DialogTitle>
                <DialogDescription>
                  Enter the details for the {activeTab === "sku_details" ? "SKU" : activeTab === "sku_selling_price" ? "SKU Selling Price" : activeTab.slice(0, -1)} record.
                </DialogDescription>
              </DialogHeader>
              {activeTab === "customers" ? renderCustomerForm() : activeTab === "depots" ? renderDepotForm() : activeTab === "sku_details" ? renderSkuDetailsForm() : activeTab === "sku_selling_price" ? renderSkuSellingPriceForm() : renderBrokerForm()}
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleCreateOrUpdate} disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {editingItem ? "Update" : "Save"} Details
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </PageHeader>

      <Tabs defaultValue="customers" className="w-full" onValueChange={setActiveTab}>
        <TabsList className="bg-slate-100 p-1 rounded-xl mb-6">
          <TabsTrigger value="customers" className="flex items-center gap-2 px-6 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm transition-all duration-300">
            <Users className="h-4 w-4" />
            Customer Details
          </TabsTrigger>
          <TabsTrigger value="depots" className="flex items-center gap-2 px-6 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm transition-all duration-300">
            <Warehouse className="h-4 w-4" />
            Depot Details
          </TabsTrigger>
          <TabsTrigger value="brokers" className="flex items-center gap-2 px-6 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm transition-all duration-300">
            <Briefcase className="h-4 w-4" />
            Broker Details
          </TabsTrigger>
          <TabsTrigger value="sku_details" className="flex items-center gap-2 px-6 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm transition-all duration-300">
            <Package className="h-4 w-4" />
            SKU Details
          </TabsTrigger>
          <TabsTrigger value="sku_selling_price" className="flex items-center gap-2 px-6 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm transition-all duration-300">
            <Package className="h-4 w-4" />
            SKU Selling Price
          </TabsTrigger>
        </TabsList>

        <TabsContent value="customers">
          <Card className="shadow-xl border-none rounded-2xl bg-white">
            <CardHeader className="bg-slate-50/50 border-b p-6">
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="text-xl font-bold flex items-center gap-2">
                    <Users className="h-5 w-5 text-primary" />
                    Customers List
                  </CardTitle>
                  <CardDescription className="mt-1">Manage your customer database</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-auto rounded-b-2xl" style={{ maxHeight: 600 }}>
              <table className="w-full caption-bottom text-sm">
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6 cursor-pointer select-none hover:bg-slate-100 sticky top-0 z-10 bg-slate-50" onClick={() => toggleSort('customer_id', customerSort, setCustomerSort)}>ID <SortIcon col="customer_id" sort={customerSort} /></TableHead>
                    <TableHead className="cursor-pointer select-none hover:bg-slate-100 sticky top-0 z-10 bg-slate-50" onClick={() => toggleSort('customer_name', customerSort, setCustomerSort)}>Customer Name <SortIcon col="customer_name" sort={customerSort} /></TableHead>
                    <TableHead className="cursor-pointer select-none hover:bg-slate-100 sticky top-0 z-10 bg-slate-50" onClick={() => toggleSort('contact_person', customerSort, setCustomerSort)}>Contact Person <SortIcon col="contact_person" sort={customerSort} /></TableHead>
                    <TableHead className="cursor-pointer select-none hover:bg-slate-100 sticky top-0 z-10 bg-slate-50" onClick={() => toggleSort('email', customerSort, setCustomerSort)}>Email/Contact <SortIcon col="email" sort={customerSort} /></TableHead>
                    <TableHead className="cursor-pointer select-none hover:bg-slate-100 sticky top-0 z-10 bg-slate-50" onClick={() => toggleSort('state', customerSort, setCustomerSort)}>Location <SortIcon col="state" sort={customerSort} /></TableHead>
                    <TableHead className="cursor-pointer select-none hover:bg-slate-100 sticky top-0 z-10 bg-slate-50" onClick={() => toggleSort('status', customerSort, setCustomerSort)}>Status <SortIcon col="status" sort={customerSort} /></TableHead>
                    <TableHead className="text-right pr-6 sticky top-0 z-10 bg-slate-50">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-20"><Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" /></TableCell></TableRow>
                  ) : sortedCustomers.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-20 text-slate-400">No customers found</TableCell></TableRow>
                  ) : sortedCustomers.map(item => (
                    <TableRow key={item.id} className="hover:bg-slate-50/30 transition-colors">
                      <TableCell className="font-medium pl-6">{item.customer_id}</TableCell>
                      <TableCell className="font-semibold text-slate-900">{item.customer_name}</TableCell>
                      <TableCell>{item.contact_person || "—"}</TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <p className="text-slate-600">{item.email || "—"}</p>
                          <p className="text-slate-400">{item.contact || "—"}</p>
                        </div>
                      </TableCell>
                      <TableCell>{item.state ? `${item.state} (${item.pincode})` : "—"}</TableCell>
                      <TableCell>
                        <Badge variant={item.status === 'Active' ? 'default' : 'secondary'} className={item.status === 'Active' ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border-none' : ''}>
                          {item.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right pr-6">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="icon" onClick={() => openEditDialog(item)} className="h-8 w-8 text-blue-600 hover:bg-blue-50" disabled={isReadOnly} title={isReadOnly ? "View Only Access" : "Edit Customer"}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => { setDeletingItem(item); setIsDeleteDialogOpen(true); }} className="h-8 w-8 text-destructive hover:bg-red-50" disabled={isReadOnly} title={isReadOnly ? "View Only Access" : "Delete Customer"}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="depots">
          <Card className="shadow-xl border-none rounded-2xl bg-white">
            <CardHeader className="bg-slate-50/50 border-b p-6">
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="text-xl font-bold flex items-center gap-2">
                    <Warehouse className="h-5 w-5 text-primary" />
                    Depots List
                  </CardTitle>
                  <CardDescription className="mt-1">Manage your warehouse and depots</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-auto rounded-b-2xl" style={{ maxHeight: 600 }}>
              <table className="w-full caption-bottom text-sm">
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6 cursor-pointer select-none hover:bg-slate-100 sticky top-0 z-10 bg-slate-50" onClick={() => toggleSort('depot_id', depotSort, setDepotSort)}>ID <SortIcon col="depot_id" sort={depotSort} /></TableHead>
                    <TableHead className="cursor-pointer select-none hover:bg-slate-100 sticky top-0 z-10 bg-slate-50" onClick={() => toggleSort('depot_name', depotSort, setDepotSort)}>Depot Name <SortIcon col="depot_name" sort={depotSort} /></TableHead>
                    <TableHead className="cursor-pointer select-none hover:bg-slate-100 sticky top-0 z-10 bg-slate-50" onClick={() => toggleSort('depot_address', depotSort, setDepotSort)}>Address <SortIcon col="depot_address" sort={depotSort} /></TableHead>
                    <TableHead className="cursor-pointer select-none hover:bg-slate-100 sticky top-0 z-10 bg-slate-50" onClick={() => toggleSort('state', depotSort, setDepotSort)}>State <SortIcon col="state" sort={depotSort} /></TableHead>
                    <TableHead className="cursor-pointer select-none hover:bg-slate-100 sticky top-0 z-10 bg-slate-50" onClick={() => toggleSort('salesman_broker_name', depotSort, setDepotSort)}>Salesman/Broker <SortIcon col="salesman_broker_name" sort={depotSort} /></TableHead>
                    <TableHead className="cursor-pointer select-none hover:bg-slate-100 sticky top-0 z-10 bg-slate-50" onClick={() => toggleSort('status', depotSort, setDepotSort)}>Status <SortIcon col="status" sort={depotSort} /></TableHead>
                    <TableHead className="text-right pr-6 sticky top-0 z-10 bg-slate-50">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-20"><Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" /></TableCell></TableRow>
                  ) : sortedDepots.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-20 text-slate-400">No depots found</TableCell></TableRow>
                  ) : sortedDepots.map(item => (
                    <TableRow key={item.depot_id} className="hover:bg-slate-50/30 transition-colors">
                      <TableCell className="font-medium pl-6">{item.depot_id}</TableCell>
                      <TableCell className="font-semibold text-slate-900">{item.depot_name}</TableCell>
                      <TableCell className="max-w-xs truncate">{item.depot_address || "—"}</TableCell>
                      <TableCell>{item.state || "—"}</TableCell>
                      <TableCell>{item.salesman_broker_name || "—"}</TableCell>
                      <TableCell>
                        <Badge variant={item.status === 'Active' ? 'default' : 'secondary'} className={item.status === 'Active' ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border-none' : ''}>
                          {item.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right pr-6">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="icon" onClick={() => openEditDialog(item)} className="h-8 w-8 text-blue-600 hover:bg-blue-50" disabled={isReadOnly} title={isReadOnly ? "View Only Access" : "Edit Depot"}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => { setDeletingItem(item); setIsDeleteDialogOpen(true); }} className="h-8 w-8 text-destructive hover:bg-red-50" disabled={isReadOnly} title={isReadOnly ? "View Only Access" : "Delete Depot"}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="brokers">
          <Card className="shadow-xl border-none rounded-2xl bg-white">
            <CardHeader className="bg-slate-50/50 border-b p-6">
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="text-xl font-bold flex items-center gap-2">
                    <Briefcase className="h-5 w-5 text-primary" />
                    Brokers List
                  </CardTitle>
                  <CardDescription className="mt-1">Manage your broker database</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-auto rounded-b-2xl" style={{ maxHeight: 600 }}>
              <table className="w-full caption-bottom text-sm">
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6 cursor-pointer select-none hover:bg-slate-100 sticky top-0 z-10 bg-slate-50" onClick={() => toggleSort('broker_id', brokerSort, setBrokerSort)}>ID <SortIcon col="broker_id" sort={brokerSort} /></TableHead>
                    <TableHead className="cursor-pointer select-none hover:bg-slate-100 sticky top-0 z-10 bg-slate-50" onClick={() => toggleSort('salesman_name', brokerSort, setBrokerSort)}>Salesman Name <SortIcon col="salesman_name" sort={brokerSort} /></TableHead>
                    <TableHead className="cursor-pointer select-none hover:bg-slate-100 sticky top-0 z-10 bg-slate-50" onClick={() => toggleSort('mobile_no', brokerSort, setBrokerSort)}>Contact (Mobile/Email) <SortIcon col="mobile_no" sort={brokerSort} /></TableHead>
                    <TableHead className="cursor-pointer select-none hover:bg-slate-100 sticky top-0 z-10 bg-slate-50" onClick={() => toggleSort('depot_name', brokerSort, setBrokerSort)}>Depot Name <SortIcon col="depot_name" sort={brokerSort} /></TableHead>
                    <TableHead className="cursor-pointer select-none hover:bg-slate-100 sticky top-0 z-10 bg-slate-50" onClick={() => toggleSort('depot_id', brokerSort, setBrokerSort)}>Depot ID <SortIcon col="depot_id" sort={brokerSort} /></TableHead>
                    <TableHead className="cursor-pointer select-none hover:bg-slate-100 sticky top-0 z-10 bg-slate-50" onClick={() => toggleSort('status', brokerSort, setBrokerSort)}>Status <SortIcon col="status" sort={brokerSort} /></TableHead>
                    <TableHead className="text-right pr-6 sticky top-0 z-10 bg-slate-50">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-20"><Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" /></TableCell></TableRow>
                  ) : sortedBrokers.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-20 text-slate-400">No brokers found</TableCell></TableRow>
                  ) : sortedBrokers.map(item => (
                    <TableRow key={item.broker_id} className="hover:bg-slate-50/30 transition-colors">
                      <TableCell className="font-medium pl-6">{item.broker_id}</TableCell>
                      <TableCell className="font-semibold text-slate-900">{item.salesman_name}</TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <p className="text-slate-600">{item.mobile_no || "—"}</p>
                          <p className="text-slate-400">{item.email_id || "—"}</p>
                        </div>
                      </TableCell>
                      <TableCell>{item.depot_name || "—"}</TableCell>
                      <TableCell>{item.depot_id || "—"}</TableCell>
                      <TableCell>
                        <Badge variant={item.status === 'Active' ? 'default' : 'secondary'} className={item.status === 'Active' ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border-none' : ''}>
                          {item.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right pr-6">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="icon" onClick={() => openEditDialog(item)} className="h-8 w-8 text-blue-600 hover:bg-blue-50" disabled={isReadOnly} title={isReadOnly ? "View Only Access" : "Edit Broker"}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => { setDeletingItem(item); setIsDeleteDialogOpen(true); }} className="h-8 w-8 text-destructive hover:bg-red-50" disabled={isReadOnly} title={isReadOnly ? "View Only Access" : "Delete Broker"}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sku_details">
          <Card className="shadow-xl border-none rounded-2xl bg-white">
            <CardHeader className="bg-slate-50/50 border-b p-6">
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="text-xl font-bold flex items-center gap-2">
                    <Package className="h-5 w-5 text-primary" />
                    SKU Details List
                  </CardTitle>
                  <CardDescription className="mt-1">Manage your SKU database</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-auto rounded-b-2xl" style={{ maxHeight: 600 }}>
              <table className="w-full caption-bottom text-sm">
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6 cursor-pointer select-none hover:bg-slate-100 sticky top-0 z-10 bg-slate-50" onClick={() => toggleSort('sku_code', skuSort, setSkuSort)}>ID <SortIcon col="sku_code" sort={skuSort} /></TableHead>
                    <TableHead className="cursor-pointer select-none hover:bg-slate-100 sticky top-0 z-10 bg-slate-50" onClick={() => toggleSort('sku_name', skuSort, setSkuSort)}>SKU Name <SortIcon col="sku_name" sort={skuSort} /></TableHead>
                    <TableHead className="cursor-pointer select-none hover:bg-slate-100 sticky top-0 z-10 bg-slate-50" onClick={() => toggleSort('main_uom', skuSort, setSkuSort)}>Main UOM <SortIcon col="main_uom" sort={skuSort} /></TableHead>
                    <TableHead className="cursor-pointer select-none hover:bg-slate-100 sticky top-0 z-10 bg-slate-50" onClick={() => toggleSort('alternate_uom', skuSort, setSkuSort)}>Alt. UOM <SortIcon col="alternate_uom" sort={skuSort} /></TableHead>
                    <TableHead className="cursor-pointer select-none hover:bg-slate-100 sticky top-0 z-10 bg-slate-50" onClick={() => toggleSort('packing_weight', skuSort, setSkuSort)}>Packing Wt <SortIcon col="packing_weight" sort={skuSort} /></TableHead>
                    <TableHead className="cursor-pointer select-none hover:bg-slate-100 sticky top-0 z-10 bg-slate-50" onClick={() => toggleSort('gross_weight', skuSort, setSkuSort)}>Gross Wt <SortIcon col="gross_weight" sort={skuSort} /></TableHead>
                    <TableHead className="cursor-pointer select-none hover:bg-slate-100 sticky top-0 z-10 bg-slate-50" onClick={() => toggleSort('status', skuSort, setSkuSort)}>Status <SortIcon col="status" sort={skuSort} /></TableHead>
                    <TableHead className="text-right pr-6 sticky top-0 z-10 bg-slate-50">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow><TableCell colSpan={9} className="text-center py-20"><Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" /></TableCell></TableRow>
                  ) : sortedSkuDetails.length === 0 ? (
                    <TableRow><TableCell colSpan={9} className="text-center py-20 text-slate-400">No SKUs found</TableCell></TableRow>
                  ) : sortedSkuDetails.map(item => (
                    <TableRow key={item.id} className="hover:bg-slate-50/30 transition-colors">
                      <TableCell className="font-semibold text-slate-900 pl-6">{item.sku_code}</TableCell>
                      <TableCell>{item.sku_name}</TableCell>
                      <TableCell>{item.main_uom}</TableCell>
                      <TableCell>{item.alternate_uom}</TableCell>
                      <TableCell>{item.packing_weight}</TableCell>
                      <TableCell>{item.gross_weight}</TableCell>
                      <TableCell>
                        <Badge variant={item.status === 'Active' ? 'default' : 'secondary'} className={item.status === 'Active' ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border-none' : ''}>
                          {item.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right pr-6">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="icon" onClick={() => openEditDialog(item)} className="h-8 w-8 text-blue-600 hover:bg-blue-50" disabled={isReadOnly} title={isReadOnly ? "View Only Access" : "Edit SKU"}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => { setDeletingItem(item); setIsDeleteDialogOpen(true); }} className="h-8 w-8 text-destructive hover:bg-red-50" disabled={isReadOnly} title={isReadOnly ? "View Only Access" : "Delete SKU"}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sku_selling_price">
          <Card className="shadow-xl border-none rounded-2xl bg-white">
            <CardHeader className="bg-slate-50/50 border-b p-6">
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="text-xl font-bold flex items-center gap-2">
                    <Package className="h-5 w-5 text-primary" />
                    SKU Selling Price List
                  </CardTitle>
                  <CardDescription className="mt-1">Manage your SKU prices</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-auto rounded-b-2xl" style={{ maxHeight: 600 }}>
              <table className="w-full caption-bottom text-sm">
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6 cursor-pointer select-none hover:bg-slate-100 sticky top-0 z-10 bg-slate-50" onClick={() => toggleSort('packing_material', skuSellingPriceSort, setSkuSellingPriceSort)}>Packing Material <SortIcon col="packing_material" sort={skuSellingPriceSort} /></TableHead>
                    <TableHead className="cursor-pointer select-none hover:bg-slate-100 sticky top-0 z-10 bg-slate-50" onClick={() => toggleSort('sku_weight', skuSellingPriceSort, setSkuSellingPriceSort)}>Weight <SortIcon col="sku_weight" sort={skuSellingPriceSort} /></TableHead>
                    <TableHead className="cursor-pointer select-none hover:bg-slate-100 sticky top-0 z-10 bg-slate-50" onClick={() => toggleSort('sku_unit', skuSellingPriceSort, setSkuSellingPriceSort)}>Unit <SortIcon col="sku_unit" sort={skuSellingPriceSort} /></TableHead>
                    <TableHead className="cursor-pointer select-none hover:bg-slate-100 sticky top-0 z-10 bg-slate-50" onClick={() => toggleSort('conversion_formula', skuSellingPriceSort, setSkuSellingPriceSort)}>Conv. Form <SortIcon col="conversion_formula" sort={skuSellingPriceSort} /></TableHead>
                    <TableHead className="cursor-pointer select-none hover:bg-slate-100 sticky top-0 z-10 bg-slate-50" onClick={() => toggleSort('sku_weight_in_gm', skuSellingPriceSort, setSkuSellingPriceSort)}>SKU Wght(gm) <SortIcon col="sku_weight_in_gm" sort={skuSellingPriceSort} /></TableHead>
                    <TableHead className="cursor-pointer select-none hover:bg-slate-100 sticky top-0 z-10 bg-slate-50" onClick={() => toggleSort('packing_material_weight_in_gm', skuSellingPriceSort, setSkuSellingPriceSort)}>Pack Mat. Wght <SortIcon col="packing_material_weight_in_gm" sort={skuSellingPriceSort} /></TableHead>
                    <TableHead className="cursor-pointer select-none hover:bg-slate-100 sticky top-0 z-10 bg-slate-50" onClick={() => toggleSort('net_oil_in_gm', skuSellingPriceSort, setSkuSellingPriceSort)}>Net Oil(gm) <SortIcon col="net_oil_in_gm" sort={skuSellingPriceSort} /></TableHead>
                    <TableHead className="cursor-pointer select-none hover:bg-slate-100 sticky top-0 z-10 bg-slate-50" onClick={() => toggleSort('packing_cost', skuSellingPriceSort, setSkuSellingPriceSort)}>Pack Cost <SortIcon col="packing_cost" sort={skuSellingPriceSort} /></TableHead>
                    <TableHead className="cursor-pointer select-none hover:bg-slate-100 sticky top-0 z-10 bg-slate-50" onClick={() => toggleSort('var', skuSellingPriceSort, setSkuSellingPriceSort)}>VAR <SortIcon col="var" sort={skuSellingPriceSort} /></TableHead>
                    <TableHead className="cursor-pointer select-none hover:bg-slate-100 sticky top-0 z-10 bg-slate-50" onClick={() => toggleSort('landing_cost', skuSellingPriceSort, setSkuSellingPriceSort)}>Landing Cost <SortIcon col="landing_cost" sort={skuSellingPriceSort} /></TableHead>
                    <TableHead className="cursor-pointer select-none hover:bg-slate-100 sticky top-0 z-10 bg-slate-50" onClick={() => toggleSort('margin', skuSellingPriceSort, setSkuSellingPriceSort)}>Margin <SortIcon col="margin" sort={skuSellingPriceSort} /></TableHead>
                    <TableHead className="cursor-pointer select-none hover:bg-slate-100 sticky top-0 z-10 bg-slate-50" onClick={() => toggleSort('actual_margin', skuSellingPriceSort, setSkuSellingPriceSort)}>Actual Margin <SortIcon col="actual_margin" sort={skuSellingPriceSort} /></TableHead>
                    <TableHead className="cursor-pointer select-none hover:bg-slate-100 sticky top-0 z-10 bg-slate-50" onClick={() => toggleSort('selling_cost', skuSellingPriceSort, setSkuSellingPriceSort)}>Selling Cost <SortIcon col="selling_cost" sort={skuSellingPriceSort} /></TableHead>
                    <TableHead className="text-right pr-6 sticky top-0 z-10 bg-slate-50">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow><TableCell colSpan={14} className="text-center py-20"><Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" /></TableCell></TableRow>
                  ) : sortedSkuSellingPrices.length === 0 ? (
                    <TableRow><TableCell colSpan={14} className="text-center py-20 text-slate-400">No SKU Prices found</TableCell></TableRow>
                  ) : sortedSkuSellingPrices.map(item => (
                    <TableRow key={item.id} className="hover:bg-slate-50/30 transition-colors">
                      <TableCell className="font-semibold text-slate-900 pl-6">{item.packing_material}</TableCell>
                      <TableCell>{item.sku_weight}</TableCell>
                      <TableCell>{item.sku_unit}</TableCell>
                      <TableCell>{item.conversion_formula}</TableCell>
                      <TableCell>{item.sku_weight_in_gm}</TableCell>
                      <TableCell>{item.packing_material_weight_in_gm}</TableCell>
                      <TableCell>{item.net_oil_in_gm}</TableCell>
                      <TableCell>{item.packing_cost}</TableCell>
                      <TableCell>{item.var}</TableCell>
                      <TableCell className="font-medium text-slate-700">{item.landing_cost}</TableCell>
                      <TableCell>{item.margin}</TableCell>
                      <TableCell>{item.actual_margin}</TableCell>
                      <TableCell className="font-medium text-emerald-600">{item.selling_cost}</TableCell>
                      <TableCell className="text-right pr-6">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="icon" onClick={() => openEditDialog(item)} className="h-8 w-8 text-blue-600 hover:bg-blue-50" disabled={isReadOnly} title={isReadOnly ? "View Only Access" : "Edit SKU Price"}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => { setDeletingItem(item); setIsDeleteDialogOpen(true); }} className="h-8 w-8 text-destructive hover:bg-red-50" disabled={isReadOnly} title={isReadOnly ? "View Only Access" : "Delete SKU Price"}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will mark the record as Inactive and it will no longer appear in active lists.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setIsDeleteDialogOpen(false); setDeletingItem(null); }}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-white hover:bg-destructive/90 transition-all shadow-md">
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete Record
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Footer */}
      <div className="flex items-center justify-center pt-12 border-t border-slate-100 opacity-100">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.5em] hover:text-primary transition-colors cursor-default">
          Powered by Botivate
        </p>
      </div>
    </div>
  )
}
