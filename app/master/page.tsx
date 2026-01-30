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
import { customerApi, depotApi, brokerApi } from "@/lib/api-service"
import { Plus, Pencil, Trash2, Loader2, RefreshCw, Users, Warehouse, Briefcase, Search, Download } from "lucide-react"
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

// --- Constants ---

const STATUS_OPTIONS = ["Active", "Inactive"]

export default function MasterPage() {
  const { toast } = useToast()
  const [activeTab, setActiveTab] = useState("customers")
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")

  // Data states
  const [customers, setCustomers] = useState<Customer[]>([])
  const [depots, setDepots] = useState<Depot[]>([])
  const [brokers, setBrokers] = useState<Broker[]>([])

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

  const openEditDialog = (item: any) => {
    setEditingItem(item)
    if (activeTab === "customers") {
      setCustomerForm({ ...item })
    } else if (activeTab === "depots") {
      setDepotForm({ ...item })
    } else if (activeTab === "brokers") {
      setBrokerForm({ ...item })
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

  // --- Render Helpers ---

  const renderCustomerForm = () => (
    <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto px-1">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="customer_id">Customer ID *</Label>
          <Input id="customer_id" value={customerForm.customer_id} onChange={e => setCustomerForm({...customerForm, customer_id: e.target.value})} placeholder="e.g. C-001" />
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
          <Input id="depot_id" value={depotForm.depot_id} onChange={e => setDepotForm({...depotForm, depot_id: e.target.value})} placeholder="e.g. D-001" />
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
          <Input id="broker_id" value={brokerForm.broker_id} onChange={e => setBrokerForm({...brokerForm, broker_id: e.target.value})} placeholder="e.g. B-001" />
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
              <Button className="bg-primary hover:bg-primary/90 shadow-lg">
                <Plus className="mr-2 h-4 w-4" />
                Add New {activeTab === "customers" ? "Customer" : activeTab === "depots" ? "Depot" : "Broker"}
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-xl">
              <DialogHeader>
                <DialogTitle>{editingItem ? "Edit" : "Add New"} {activeTab.slice(0, -1)}</DialogTitle>
                <DialogDescription>
                  Enter the details for the {activeTab.slice(0, -1)} record.
                </DialogDescription>
              </DialogHeader>
              {activeTab === "customers" ? renderCustomerForm() : activeTab === "depots" ? renderDepotForm() : renderBrokerForm()}
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
        </TabsList>

        <TabsContent value="customers">
          <Card className="shadow-xl border-none rounded-2xl overflow-hidden bg-white">
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
              <Table>
                <TableHeader className="bg-slate-50/50">
                  <TableRow>
                    <TableHead className="pl-6">ID</TableHead>
                    <TableHead>Customer Name</TableHead>
                    <TableHead>Contact Person</TableHead>
                    <TableHead>Email/Contact</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right pr-6">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-20"><Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" /></TableCell></TableRow>
                  ) : filteredCustomers.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-20 text-slate-400">No customers found</TableCell></TableRow>
                  ) : filteredCustomers.map(item => (
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
                          <Button variant="ghost" size="icon" onClick={() => openEditDialog(item)} className="h-8 w-8 text-blue-600 hover:bg-blue-50">
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => { setDeletingItem(item); setIsDeleteDialogOpen(true); }} className="h-8 w-8 text-destructive hover:bg-red-50">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="depots">
          <Card className="shadow-xl border-none rounded-2xl overflow-hidden bg-white">
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
              <Table>
                <TableHeader className="bg-slate-50/50">
                  <TableRow>
                    <TableHead className="pl-6">ID</TableHead>
                    <TableHead>Depot Name</TableHead>
                    <TableHead>Address</TableHead>
                    <TableHead>State</TableHead>
                    <TableHead>Salesman/Broker</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right pr-6">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-20"><Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" /></TableCell></TableRow>
                  ) : filteredDepots.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-20 text-slate-400">No depots found</TableCell></TableRow>
                  ) : filteredDepots.map(item => (
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
                          <Button variant="ghost" size="icon" onClick={() => openEditDialog(item)} className="h-8 w-8 text-blue-600 hover:bg-blue-50">
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => { setDeletingItem(item); setIsDeleteDialogOpen(true); }} className="h-8 w-8 text-destructive hover:bg-red-50">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="brokers">
          <Card className="shadow-xl border-none rounded-2xl overflow-hidden bg-white">
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
              <Table>
                <TableHeader className="bg-slate-50/50">
                  <TableRow>
                    <TableHead className="pl-6">ID</TableHead>
                    <TableHead>Salesman Name</TableHead>
                    <TableHead>Contact (Mobile/Email)</TableHead>
                    <TableHead>Depot Name</TableHead>
                    <TableHead>Depot ID</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right pr-6">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-20"><Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" /></TableCell></TableRow>
                  ) : filteredBrokers.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-20 text-slate-400">No brokers found</TableCell></TableRow>
                  ) : filteredBrokers.map(item => (
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
                          <Button variant="ghost" size="icon" onClick={() => openEditDialog(item)} className="h-8 w-8 text-blue-600 hover:bg-blue-50">
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => { setDeletingItem(item); setIsDeleteDialogOpen(true); }} className="h-8 w-8 text-destructive hover:bg-red-50">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
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
