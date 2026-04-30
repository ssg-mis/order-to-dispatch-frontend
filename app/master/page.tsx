"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { customerApi, depotApi, brokerApi, skuDetailsApi, commonApi, skuSellingPriceApi, varCalcApi, salespersonApi, vehicleMasterApi, driverMasterApi, transportMasterApi, orderApi } from "@/lib/api-service"
import { useInfiniteQuery } from "@tanstack/react-query"
import { useInView } from "react-intersection-observer"

import { useAuth } from "@/hooks/use-auth"
import {   UserPlus, UserMinus, Search, RefreshCw, FileText, Download, Filter, ArrowUpDown, ArrowUp, ArrowDown, Package, Warehouse, Briefcase, Plus, Loader2, Save, Trash2, Edit2, AlertCircle, CheckCircle2, MoreVertical, X, Settings, Layers, Calendar, Clock, MapPin, Phone, Mail, User, Users, Info, Check, Eye, Trash, LayoutGrid, ChevronRight, ChevronDown, List, Upload, EyeOff, Layout, Truck, Pencil, UserCircle,
} from 'lucide-react'
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

interface Salesperson {
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

interface Vehicle {
  id: number
  vehicle_master_id: string
  status: string
  registration_no: string
  vehicle_type: string
  transporter: string
  rto: string
  road_tax?: string
  road_tax_image?: string
  pollution?: string
  pollution_image?: string
  insurance?: string
  insurance_image?: string
  fitness?: string
  fitness_image?: string
  state_permit?: string
  state_permit_image?: string
  gvw?: number
  ulw?: number
  passing?: number
}

interface Driver {
  id: number
  driver_master_id: string
  status: string
  driver_name: string
  mobile_no: string
  email_id: string
  driving_licence_no: string
  driving_licence_type: string
  valid_upto: string
  rto: string
  address_line1: string
  state: string
  pincode: string
  aadhaar_no: string
  pan_no: string
  aadhaar_upload: string
}

interface Transport {
  id: number
  transport_master_id: string
  status: string
  transporter_name: string
  contact_person: string
  contact_number: string
  email_id: string
  address_line1: string
  state: string
  pincode: string
  pan: string
  gstin: string
}

// --- Constants ---

const STATUS_OPTIONS = ["Active", "Inactive"]

export default function MasterPage() {
  const { toast } = useToast()
  const { isReadOnly } = useAuth()
  const [activeTab, setActiveTab] = useState("customers")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")

  const { ref: customerEndRef, inView: customerInView } = useInView()
  const { ref: depotEndRef, inView: depotInView } = useInView()
  const { ref: brokerEndRef, inView: brokerInView } = useInView()
  const { ref: salespersonEndRef, inView: salespersonInView } = useInView()
  const { ref: vehicleEndRef, inView: vehicleInView } = useInView()
  const { ref: driverEndRef, inView: driverInView } = useInView()
  const { ref: skuEndRef, inView: skuInView } = useInView()
  const { ref: skuSellingPriceEndRef, inView: skuSellingPriceInView } = useInView()

  // --- Queries ---

  // Customers
  const {
    data: customerData,
    fetchNextPage: fetchNextCustomer,
    hasNextPage: hasNextCustomer,
    isFetchingNextPage: isFetchingNextCustomer,
    isLoading: isCustomerLoading,
    refetch: refetchCustomer,
  } = useInfiniteQuery({
    queryKey: ["master-customers", searchTerm],
    queryFn: async ({ pageParam = 1 }) => {
      const res = await customerApi.getAll({ page: pageParam, limit: 20, search: searchTerm, all: "true" })
      return res.success ? res.data : { customers: [], pagination: { total: 0 } }
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      const currentCount = allPages.reduce((sum, page) => sum + (page.customers?.length || 0), 0)
      return currentCount < (lastPage.pagination?.total || 0) ? allPages.length + 1 : undefined
    }
  })

  // Depots
  const {
    data: depotData,
    fetchNextPage: fetchNextDepot,
    hasNextPage: hasNextDepot,
    isFetchingNextPage: isFetchingNextDepot,
    isLoading: isDepotLoading,
    refetch: refetchDepot,
  } = useInfiniteQuery({
    queryKey: ["master-depots", searchTerm],
    queryFn: async ({ pageParam = 1 }) => {
      const res = await depotApi.getAll({ page: pageParam, limit: 20, search: searchTerm, all: "true" })
      return res.success ? res.data : { depots: [], pagination: { total: 0 } }
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      const currentCount = allPages.reduce((sum, page) => sum + (page.depots?.length || 0), 0)
      return currentCount < (lastPage.pagination?.total || 0) ? allPages.length + 1 : undefined
    }
  })

  // Brokers
  const {
    data: brokerData,
    fetchNextPage: fetchNextBroker,
    hasNextPage: hasNextBroker,
    isFetchingNextPage: isFetchingNextBroker,
    isLoading: isBrokerLoading,
    refetch: refetchBroker,
  } = useInfiniteQuery({
    queryKey: ["master-brokers", searchTerm],
    queryFn: async ({ pageParam = 1 }) => {
      const res = await brokerApi.getAll({ page: pageParam, limit: 20, search: searchTerm, all: "true" })
      return res.success ? res.data : { brokers: [], pagination: { total: 0 } }
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      const currentCount = allPages.reduce((sum, page) => sum + (page.brokers?.length || 0), 0)
      return currentCount < (lastPage.pagination?.total || 0) ? allPages.length + 1 : undefined
    }
  })

  // Salespersons
  const {
    data: salespersonData,
    fetchNextPage: fetchNextSalesperson,
    hasNextPage: hasNextSalesperson,
    isFetchingNextPage: isFetchingNextSalesperson,
    isLoading: isSalespersonLoading,
    refetch: refetchSalesperson,
  } = useInfiniteQuery({
    queryKey: ["master-salespersons", searchTerm],
    queryFn: async ({ pageParam = 1 }) => {
      const res = await salespersonApi.getAll({ page: pageParam, limit: 20, search: searchTerm, all: "true" })
      return res.success ? res.data : { salespersons: [], pagination: { total: 0 } }
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      const currentCount = allPages.reduce((sum, page) => sum + (page.salespersons?.length || 0), 0)
      return currentCount < (lastPage.pagination?.total || 0) ? allPages.length + 1 : undefined
    }
  })

  // SKU Details
  const {
    data: skuData,
    fetchNextPage: fetchNextSku,
    hasNextPage: hasNextSku,
    isFetchingNextPage: isFetchingNextSku,
    isLoading: isSkuLoading,
    refetch: refetchSku,
  } = useInfiniteQuery({
    queryKey: ["master-sku-details", searchTerm],
    queryFn: async ({ pageParam = 1 }) => {
      const res = await skuDetailsApi.getAll({ page: pageParam, limit: 20, search: searchTerm, all: "true" })
      return res.success ? res.data : { skuDetails: [], pagination: { total: 0 } }
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      const currentCount = allPages.reduce((sum, page) => sum + (page.skuDetails?.length || 0), 0)
      return currentCount < (lastPage.pagination?.total || 0) ? allPages.length + 1 : undefined
    }
  })

  // SKU Selling Price
  const {
    data: skuSellingPriceData,
    fetchNextPage: fetchNextSkuSellingPrice,
    hasNextPage: hasNextSkuSellingPrice,
    isFetchingNextPage: isFetchingNextSkuSellingPrice,
    isLoading: isSkuSellingPriceLoading,
    refetch: refetchSkuSellingPrice,
  } = useInfiniteQuery({
    queryKey: ["master-sku-selling-price", searchTerm],
    queryFn: async ({ pageParam = 1 }) => {
      const res = await skuSellingPriceApi.getAll({ page: pageParam, limit: 20, search: searchTerm })
      return res.success ? res.data : { skus: [], pagination: { total: 0 } }
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      const currentCount = allPages.reduce((sum, page) => sum + (page.skus?.length || 0), 0)
      return currentCount < (lastPage.pagination?.total || 0) ? allPages.length + 1 : undefined
    }
  })

  // 7. Driver Data (Infinite Query)
  const {
    data: driverData,
    fetchNextPage: fetchNextDriver,
    hasNextPage: hasNextDriver,
    isFetchingNextPage: isFetchingNextDriver,
    isLoading: isDriverLoading,
    refetch: refetchDriver,
  } = useInfiniteQuery({
    queryKey: ["master-drivers", searchTerm],
    queryFn: async ({ pageParam = 1 }) => {
      const res = await driverMasterApi.getAll({ page: pageParam, limit: 20, search: searchTerm, all: "true" })
      return res.success ? res.data : { drivers: [], pagination: { total: 0 } }
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      const currentCount = allPages.reduce((sum, page) => sum + (page.drivers?.length || 0), 0)
      return currentCount < (lastPage.pagination?.total || 0) ? allPages.length + 1 : undefined
    }
  })

  // 8. Transport Data (Infinite Query)
  const {
    data: transportData,
    fetchNextPage: fetchNextTransport,
    hasNextPage: hasNextTransport,
    isFetchingNextPage: isFetchingNextTransport,
    isLoading: isTransportLoading,
    refetch: refetchTransport,
  } = useInfiniteQuery({
    queryKey: ["master-transporters", searchTerm],
    queryFn: async ({ pageParam = 1 }) => {
      const res = await transportMasterApi.getAll({ page: pageParam, limit: 20, search: searchTerm, all: "true" })
      return res.success ? res.data : { transporters: [], pagination: { total: 0 } }
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      const currentCount = allPages.reduce((sum, page) => sum + (page.transporters?.length || 0), 0)
      return currentCount < (lastPage.pagination?.total || 0) ? allPages.length + 1 : undefined
    }
  })

  const [latestVarCalc, setLatestVarCalc] = useState<any>(null)

  // Memoized data lists
  const customers = useMemo(() => customerData?.pages.flatMap(p => p?.customers || []) || [], [customerData])
  const depots = useMemo(() => depotData?.pages.flatMap(p => p?.depots || []) || [], [depotData])
  const brokers = useMemo(() => brokerData?.pages.flatMap(p => p?.brokers || []) || [], [brokerData])
  const salespersons = useMemo(() => salespersonData?.pages.flatMap(p => p?.salespersons || []) || [], [salespersonData])
  const transporters = useMemo(() => transportData?.pages.flatMap(p => p?.transporters || []) || [], [transportData])
  const skuDetails = useMemo(() => skuData?.pages.flatMap(p => p?.skuDetails || []) || [], [skuData])
  const skuSellingPrices = useMemo(() => skuSellingPriceData?.pages.flatMap(p => p?.skus || []) || [], [skuSellingPriceData])
  const drivers = useMemo(() => driverData?.pages.flatMap(p => p?.drivers || []) || [], [driverData])

  // Infinite Scroll Observers
  useEffect(() => { if (customerInView && hasNextCustomer) fetchNextCustomer() }, [customerInView, hasNextCustomer, fetchNextCustomer])
  useEffect(() => { if (depotInView && hasNextDepot) fetchNextDepot() }, [depotInView, hasNextDepot, fetchNextDepot])
  useEffect(() => { if (brokerInView && hasNextBroker) fetchNextBroker() }, [brokerInView, hasNextBroker, fetchNextBroker])
  useEffect(() => { if (salespersonInView && hasNextSalesperson) fetchNextSalesperson() }, [salespersonInView, hasNextSalesperson, fetchNextSalesperson])
  useEffect(() => { if (skuInView && hasNextSku) fetchNextSku() }, [skuInView, hasNextSku, fetchNextSku])
  useEffect(() => { if (skuSellingPriceInView && hasNextSkuSellingPrice) fetchNextSkuSellingPrice() }, [skuSellingPriceInView, hasNextSkuSellingPrice, fetchNextSkuSellingPrice])
  useEffect(() => { if (driverInView && hasNextDriver) fetchNextDriver() }, [driverInView, hasNextDriver, fetchNextDriver])

  // 7. Vehicle Data (Infinite Query)
  const {
    data: vehicleData,
    fetchNextPage: fetchNextVehicle,
    hasNextPage: hasNextVehicle,
    isFetchingNextPage: isFetchingNextVehicle,
    isLoading: isVehicleLoading,
    refetch: refetchVehicle,
  } = useInfiniteQuery({
    queryKey: ["vehicle_master", searchTerm],
    queryFn: ({ pageParam = 1 }) => vehicleMasterApi.getAll({ page: pageParam, limit: 20, search: searchTerm, all: true }),
    getNextPageParam: (lastPage) => {
      const { page, limit, total } = lastPage.data.pagination;
      return page * limit < total ? page + 1 : undefined;
    },
    initialPageParam: 1,
  })

  const vehicles = useMemo(() => vehicleData?.pages.flatMap(p => p.data.vehicles) || [], [vehicleData])

  useEffect(() => {
    if (vehicleInView && hasNextVehicle && !isFetchingNextVehicle) fetchNextVehicle()
  }, [vehicleInView, hasNextVehicle, isFetchingNextVehicle, fetchNextVehicle])

  useEffect(() => {
    if (driverInView && hasNextDriver && !isFetchingNextDriver) fetchNextDriver()
  }, [driverInView, hasNextDriver, isFetchingNextDriver, fetchNextDriver])

  const isLoading = isCustomerLoading || isDepotLoading || isBrokerLoading || isSalespersonLoading || isSkuLoading || isSkuSellingPriceLoading || isVehicleLoading || isDriverLoading || isTransportLoading


  // Sort states
  const [customerSort, setCustomerSort] = useState<{ col: string; dir: 'asc' | 'desc' }>({ col: 'customer_id', dir: 'asc' })
  const [depotSort, setDepotSort] = useState<{ col: string; dir: 'asc' | 'desc' }>({ col: 'depot_id', dir: 'asc' })
  const [brokerSort, setBrokerSort] = useState<{ col: string; dir: 'asc' | 'desc' }>({ col: 'broker_id', dir: 'asc' })
  const [salespersonSort, setSalespersonSort] = useState<{ col: string; dir: 'asc' | 'desc' }>({ col: 'broker_id', dir: 'asc' })
  const [vehicleSort, setVehicleSort] = useState<{ col: string; dir: 'asc' | 'desc' }>({ col: 'registration_no', dir: 'asc' })
  const [skuSort, setSkuSort] = useState<{ col: string; dir: 'asc' | 'desc' }>({ col: 'sku_code', dir: 'asc' })
  const [skuSellingPriceSort, setSkuSellingPriceSort] = useState<{ col: string; dir: 'asc' | 'desc' }>({ col: 'packing_material', dir: 'asc' })
  const [driverSort, setDriverSort] = useState<{ col: string; dir: 'asc' | 'desc' }>({ col: 'driver_name', dir: 'asc' })
  const [transportSort, setTransportSort] = useState<{ col: string; dir: 'asc' | 'desc' }>({ col: 'transporter_name', dir: 'asc' })

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

  const [salespersonForm, setSalespersonForm] = useState<any>({
    broker_id: '',
    salesman_name: '',
    status: 'Active',
    mobile_no: '',
    email_id: ''
  })

  const [vehicleForm, setVehicleForm] = useState<any>({
    vehicle_master_id: '',
    registration_no: '',
    vehicle_type: '',
    transporter: '',
    rto: '',
    status: 'Active',
    road_tax: '',
    road_tax_image: '',
    pollution: '',
    pollution_image: '',
    insurance: '',
    insurance_image: '',
    fitness: '',
    fitness_image: '',
    state_permit: '',
    state_permit_image: '',
    gvw: '',
    ulw: '',
    passing: ''
  })

  const [driverForm, setDriverForm] = useState<Partial<Driver>>({
    driver_master_id: "",
    status: "Active",
    driving_licence_no: "",
    driving_licence_type: "",
    valid_upto: "",
    rto: "",
    driver_name: "",
    mobile_no: "",
    email_id: "",
    address_line1: "",
    state: "",
    pincode: "",
    aadhaar_no: "",
    pan_no: "",
    aadhaar_upload: ""
  })

  const [transportForm, setTransportForm] = useState<Partial<Transport>>({
    transport_master_id: "",
    status: "Active",
    transporter_name: "",
    contact_person: "",
    contact_number: "",
    email_id: "",
    address_line1: "",
    state: "",
    pincode: "",
    pan: "",
    gstin: ""
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

  const [skuSellingPriceForm, setSkuSellingPrice] = useState<Partial<SkuSellingPrice>>({
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

  const fetchVarCalc = useCallback(async () => {
    try {
      const varRes = await varCalcApi.getLatest()
      if (varRes.success) setLatestVarCalc(varRes.data)
    } catch (e) { console.error("Var calc fetch failed") }
  }, [])

  useEffect(() => {
    if (activeTab === "sku_selling_price") fetchVarCalc()
  }, [activeTab, fetchVarCalc])

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
    setSalespersonForm({
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
    setVehicleForm({
      vehicle_master_id: '',
      registration_no: '',
      vehicle_type: '',
      transporter: '',
      rto: '',
      status: 'Active',
      road_tax: '',
      road_tax_image: '',
      pollution: '',
      pollution_image: '',
      insurance: '',
      insurance_image: '',
      fitness: '',
      fitness_image: '',
      state_permit: '',
      state_permit_image: '',
      gvw: '',
      ulw: '',
      passing: ''
    })
    setDriverForm({
      driver_master_id: "",
      status: "Active",
      driving_licence_no: "",
      driving_licence_type: "",
      valid_upto: "",
      rto: "",
      driver_name: "",
      mobile_no: "",
      email_id: "",
      address_line1: "",
      state: "",
      pincode: "",
      aadhaar_no: "",
      pan_no: "",
      aadhaar_upload: ""
    })
    setTransportForm({
      transport_master_id: "",
      status: "Active",
      transporter_name: "",
      contact_person: "",
      contact_number: "",
      email_id: "",
      address_line1: "",
      state: "",
      pincode: "",
      pan: "",
      gstin: ""
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
      } else if (activeTab === "salespersons") {
        if (editingItem) {
          res = await salespersonApi.update(editingItem.broker_id, salespersonForm)
        } else {
          res = await salespersonApi.create(salespersonForm)
        }
      } else if (activeTab === "sku_details") {
        if (editingItem) {
          res = await skuDetailsApi.update(editingItem.id, skuDetailsForm)
        } else {
          res = await skuDetailsApi.create(skuDetailsForm)
        }
      } else if (activeTab === "sku_selling_price") {
        if (editingItem) {
          res = await skuSellingPriceApi.update(editingItem.id, skuSellingPriceForm)
        } else {
          res = await skuSellingPriceApi.create(skuSellingPriceForm)
        }
      } else if (activeTab === "vehicle_master") {
        if (editingItem) {
          res = await vehicleMasterApi.update(editingItem.id, vehicleForm)
        } else {
          res = await vehicleMasterApi.create(vehicleForm)
        }
      } else if (activeTab === "driver_master") {
        if (editingItem) {
          res = await driverMasterApi.update(editingItem.id, driverForm)
        } else {
          res = await driverMasterApi.create(driverForm)
        }
      } else if (activeTab === "transport_master") {
        if (editingItem) {
          res = await transportMasterApi.update(editingItem.id, transportForm)
        } else {
          res = await transportMasterApi.create(transportForm)
        }
      }

      if (res?.success) {
        toast({ title: "Success", description: editingItem ? "Updated successfully" : "Created successfully" })
        setIsDialogOpen(false)
        resetForms()
        // Refetch appropriate query
        if (activeTab === "customers") refetchCustomer()
        else if (activeTab === "depots") refetchDepot()
        else if (activeTab === "brokers") refetchBroker()
        else if (activeTab === "salespersons") refetchSalesperson()
        else if (activeTab === "sku_details") refetchSku()
        else if (activeTab === "sku_selling_price") refetchSkuSellingPrice()
        else if (activeTab === "vehicle_master") refetchVehicle()
        else if (activeTab === "driver_master") refetchDriver()
        else if (activeTab === "transport_master") refetchTransport()
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
      } else if (activeTab === "salespersons") {
        res = await salespersonApi.delete(deletingItem.broker_id)
      } else if (activeTab === "sku_details") {
        res = await skuDetailsApi.delete(deletingItem.id)
      } else if (activeTab === "sku_selling_price") {
        res = await skuSellingPriceApi.delete(deletingItem.id)
      } else if (activeTab === "vehicle_master") {
        res = await vehicleMasterApi.delete(deletingItem.id)
      } else if (activeTab === "driver_master") {
        res = await driverMasterApi.delete(deletingItem.id)
      } else if (activeTab === "transport_master") {
        res = await transportMasterApi.delete(deletingItem.id)
      }

      if (res?.success) {
        toast({ title: "Success", description: "Deleted successfully" })
        setIsDeleteDialogOpen(false)
        setDeletingItem(null)
        // Refetch appropriate query
        if (activeTab === "customers") refetchCustomer()
        else if (activeTab === "depots") refetchDepot()
        else if (activeTab === "brokers") refetchBroker()
        else if (activeTab === "salespersons") refetchSalesperson()
        else if (activeTab === "sku_details") refetchSku()
        else if (activeTab === "sku_selling_price") refetchSkuSellingPrice()
        else if (activeTab === "vehicle_master") refetchVehicle()
        else if (activeTab === "driver_master") refetchDriver()
        else if (activeTab === "transport_master") refetchTransport()
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

  const fetchNextId = async (type: 'customer' | 'depot' | 'broker' | 'sku' | 'salesperson' | 'vehicle' | 'driver' | 'transport') => {
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
      setCustomerForm((prev: any) => ({ ...prev, customer_id: nextId }))
    } else if (activeTab === "depots") {
      nextId = await fetchNextId('depot')
      setDepotForm((prev: any) => ({ ...prev, depot_id: nextId }))
    } else if (activeTab === "brokers") {
      nextId = await fetchNextId('broker')
      setBrokerForm((prev: any) => ({ ...prev, broker_id: nextId }))
    } else if (activeTab === "salespersons") {
      nextId = await fetchNextId('salesperson')
      setSalespersonForm((prev: any) => ({ ...prev, broker_id: nextId }))
    } else if (activeTab === "sku_details") {
      nextId = await fetchNextId('sku')
      setSkuDetailsForm((prev: any) => ({ ...prev, sku_code: nextId }))
    } else if (activeTab === "vehicle_master") {
      nextId = await fetchNextId('vehicle')
      setVehicleForm((prev: any) => ({ ...prev, vehicle_master_id: nextId }))
    } else if (activeTab === "driver_master") {
      nextId = await fetchNextId('driver')
      setDriverForm((prev: any) => ({ ...prev, driver_master_id: nextId }))
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
    } else if (activeTab === "transport_master") {
      nextId = await fetchNextId('transport')
      setTransportForm((prev: any) => ({ ...prev, transport_master_id: nextId }))
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
    } else if (activeTab === "salespersons") {
      setSalespersonForm({ ...item })
    } else if (activeTab === "sku_details") {
      setSkuDetailsForm({ ...item })
    } else if (activeTab === "sku_selling_price") {
      setSkuSellingPrice({ ...item })
    } else if (activeTab === "vehicle_master") {
      setVehicleForm({ ...item })
    } else if (activeTab === "driver_master") {
      setDriverForm({ ...item })
    } else if (activeTab === "transport_master") {
      setTransportForm({ ...item })
    }
    setIsDialogOpen(true)
  }

  // --- Filter Logic ---

  const filteredCustomers = customers.filter(c => 
    c?.customer_name?.toLowerCase()?.includes(searchTerm.toLowerCase()) || 
    c?.customer_id?.toLowerCase()?.includes(searchTerm.toLowerCase())
  )

  const filteredDepots = depots.filter(d => 
    d?.depot_name?.toLowerCase()?.includes(searchTerm.toLowerCase()) || 
    d?.depot_id?.toLowerCase()?.includes(searchTerm.toLowerCase())
  )

  const filteredBrokers = brokers.filter(b => 
    b?.salesman_name?.toLowerCase()?.includes(searchTerm.toLowerCase()) || 
    b?.broker_id?.toLowerCase()?.includes(searchTerm.toLowerCase())
  )

  const filteredSkuDetails = skuDetails.filter(s => 
    s?.sku_name?.toLowerCase()?.includes(searchTerm.toLowerCase()) || 
    s?.sku_code?.toLowerCase()?.includes(searchTerm.toLowerCase())
  )

  const filteredSalespersons = salespersons.filter(s => 
    s?.salesman_name?.toLowerCase()?.includes(searchTerm.toLowerCase()) || 
    s?.broker_id?.toLowerCase()?.includes(searchTerm.toLowerCase())
  )

  const filteredSkuSellingPrices = skuSellingPrices.filter(s =>
    s?.packing_material?.toLowerCase()?.includes(searchTerm.toLowerCase())
  )
  const filteredVehicles = vehicles.filter(v =>
    v?.registration_no?.toLowerCase()?.includes(searchTerm.toLowerCase()) ||
    v?.vehicle_master_id?.toLowerCase()?.includes(searchTerm.toLowerCase()) ||
    v?.transporter?.toLowerCase()?.includes(searchTerm.toLowerCase())
  )

  const filteredDrivers = drivers.filter(dr =>
    dr?.driver_name?.toLowerCase()?.includes(searchTerm.toLowerCase()) ||
    dr?.driver_master_id?.toLowerCase()?.includes(searchTerm.toLowerCase()) ||
    dr?.mobile_no?.toLowerCase()?.includes(searchTerm.toLowerCase()) ||
    dr?.driving_licence_no?.toLowerCase()?.includes(searchTerm.toLowerCase())
  )

  const filteredTransporters = transporters.filter(t =>
    t?.transporter_name?.toLowerCase()?.includes(searchTerm.toLowerCase()) ||
    t?.transport_master_id?.toLowerCase()?.includes(searchTerm.toLowerCase()) ||
    t?.contact_person?.toLowerCase()?.includes(searchTerm.toLowerCase()) ||
    t?.contact_number?.toLowerCase()?.includes(searchTerm.toLowerCase())
  )

  // --- Sort helpers ---
  type SortDir = 'asc' | 'desc'

  const sortData = <T extends Record<string, any>>(data: T[], col: string, dir: SortDir): T[] => {
    return [...data].sort((a, b) => {
      const av = (a && a[col]) ?? ''
      const bv = (b && b[col]) ?? ''
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
  const sortedSalespersons = sortData(filteredSalespersons, salespersonSort.col, salespersonSort.dir)
  const sortedSkuDetails = sortData(filteredSkuDetails, skuSort.col, skuSort.dir)
  const sortedSkuSellingPrices = sortData(filteredSkuSellingPrices, skuSellingPriceSort.col, skuSellingPriceSort.dir)
  const sortedVehicles = sortData(filteredVehicles, vehicleSort.col, vehicleSort.dir)
  const sortedDrivers = sortData(filteredDrivers, driverSort.col, driverSort.dir)
  const sortedTransporters = sortData(filteredTransporters, transportSort.col, transportSort.dir)

  // --- Shared Helpers ---
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, field: string) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    try {
      const res = await orderApi.uploadFile(file)
      if (res.success) {
        if (activeTab === 'vehicle_master') {
          setVehicleForm((prev: any) => ({ ...prev, [field]: res.data.url }))
        } else if (activeTab === 'driver_master') {
          setDriverForm((prev: any) => ({ ...prev, [field]: res.data.url }))
        }
        toast({ title: "Success", description: "Image uploaded successfully" })
      }
    } catch (err) {
      toast({ title: "Error", description: "Failed to upload image", variant: "destructive" })
    }
  }

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
          <Label htmlFor="salesman_name">Broker Name *</Label>
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
    </div>
  )

  const renderSalespersonForm = () => (
    <div className="grid gap-4 py-4 px-1">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="broker_id">Salesperson ID *</Label>
          <Input id="broker_id" value={salespersonForm.broker_id} readOnly className="bg-slate-100" placeholder="Auto-generated" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="salesman_name">Salesman Name *</Label>
          <Input id="salesman_name" value={salespersonForm.salesman_name} onChange={e => setSalespersonForm({...salespersonForm, salesman_name: e.target.value})} placeholder="Enter name" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="status">Status</Label>
          <Select value={salespersonForm.status} onValueChange={val => setSalespersonForm({...salespersonForm, status: val})}>
            <SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="mobile_no">Mobile Number</Label>
          <Input id="mobile_no" value={salespersonForm.mobile_no} onChange={e => setSalespersonForm({...salespersonForm, mobile_no: e.target.value})} placeholder="Enter number" />
        </div>
      </div>
        <div className="space-y-2">
          <Label htmlFor="email_id">Email ID</Label>
          <Input id="email_id" value={salespersonForm.email_id} onChange={e => setSalespersonForm({...salespersonForm, email_id: e.target.value})} placeholder="email@example.com" />
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
          <Input id="packing_material" value={skuSellingPriceForm.packing_material} onChange={e => setSkuSellingPrice({...skuSellingPriceForm, packing_material: e.target.value})} placeholder="Enter material name" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="sku_unit">SKU Unit</Label>
          <Input id="sku_unit" value={skuSellingPriceForm.sku_unit} readOnly className="bg-slate-100" placeholder="e.g. Ltr" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="sku_weight_sp">SKU Weight</Label>
          <Input id="sku_weight_sp" type="number" value={skuSellingPriceForm.sku_weight} onChange={e => setSkuSellingPrice({...skuSellingPriceForm, sku_weight: e.target.value})} placeholder="0.00" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="conversion_formula">Conversion Formula</Label>
          <Input id="conversion_formula" type="number" value={skuSellingPriceForm.conversion_formula} onChange={e => setSkuSellingPrice({...skuSellingPriceForm, conversion_formula: e.target.value})} placeholder="0.00" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="sku_weight_in_gm">SKU Weight (gm)</Label>
          <Input id="sku_weight_in_gm" type="number" value={skuSellingPriceForm.sku_weight_in_gm} onChange={e => {
            const rawVal = e.target.value;
            const val = parseFloat(rawVal) || 0;
            const pmWeight = parseFloat(skuSellingPriceForm.packing_material_weight_in_gm?.toString() || "0");
            const netOilInGm = val - pmWeight;
            
            // Recalculate landing cost: (GT / 1000) * netOilInGm + packingCost
            let newLandingCost = skuSellingPriceForm.landing_cost || 0;
            if (latestVarCalc?.gt) {
              const gt = parseFloat(latestVarCalc.gt) || 0;
              const pCost = parseFloat(skuSellingPriceForm.packing_cost?.toString() || "0");
              newLandingCost = ((gt / 1000) * netOilInGm + pCost).toFixed(2);
            }

            setSkuSellingPrice({
              ...skuSellingPriceForm, 
              sku_weight_in_gm: rawVal,
              net_oil_in_gm: netOilInGm.toFixed(2),
              landing_cost: newLandingCost
            });
          }} placeholder="0.00" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="packing_material_weight_in_gm">Packing Mat. Wt (gm)</Label>
          <Input id="packing_material_weight_in_gm" type="number" value={skuSellingPriceForm.packing_material_weight_in_gm} onChange={e => {
            const rawVal = e.target.value;
            const val = parseFloat(rawVal) || 0;
            const skuWt = parseFloat(skuSellingPriceForm.sku_weight_in_gm?.toString() || "0");
            const netOilInGm = skuWt - val;

            // Recalculate landing cost: (GT / 1000) * netOilInGm + packingCost
            let newLandingCost = skuSellingPriceForm.landing_cost || 0;
            if (latestVarCalc?.gt) {
              const gt = parseFloat(latestVarCalc.gt) || 0;
              const pCost = parseFloat(skuSellingPriceForm.packing_cost?.toString() || "0");
              newLandingCost = ((gt / 1000) * netOilInGm + pCost).toFixed(2);
            }

            setSkuSellingPrice({
              ...skuSellingPriceForm, 
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
          <Input id="net_oil_in_gm" type="number" value={skuSellingPriceForm.net_oil_in_gm} readOnly className="bg-slate-100" placeholder="Auto-calculated" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="packing_cost">Packing Cost</Label>
          <Input id="packing_cost" type="number" value={skuSellingPriceForm.packing_cost} onChange={e => {
            const rawVal = e.target.value;
            const val = parseFloat(rawVal) || 0;
            
            // Recalculate landing cost when packing cost changes as well
            let newLandingCost = skuSellingPriceForm.landing_cost || 0;
            if (latestVarCalc?.gt) {
              const gt = parseFloat(latestVarCalc.gt) || 0;
              const netOilInGm = parseFloat(skuSellingPriceForm.net_oil_in_gm?.toString() || "0");
              newLandingCost = ((gt / 1000) * netOilInGm + val).toFixed(2);
            }

            setSkuSellingPrice({
              ...skuSellingPriceForm, 
              packing_cost: rawVal,
              landing_cost: newLandingCost
            });
          }} placeholder="0.00" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="landing_cost">Landing Cost</Label>
          <Input id="landing_cost" type="number" value={skuSellingPriceForm.landing_cost} readOnly className="bg-slate-100" placeholder="Auto-calculated" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="var">Var</Label>
          <Input id="var" value={skuSellingPriceForm.var} onChange={e => setSkuSellingPrice({...skuSellingPriceForm, var: e.target.value})} placeholder="e.g. 1" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="margin">Margin</Label>
          <Input id="margin" value={skuSellingPriceForm.margin} onChange={e => setSkuSellingPrice({...skuSellingPriceForm, margin: e.target.value})} placeholder="e.g. 10%" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="landing_cost">Landing Cost</Label>
          <Input id="landing_cost" type="number" value={skuSellingPriceForm.landing_cost} readOnly className="bg-slate-100" placeholder="Auto" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="actual_margin">Actual Margin</Label>
          <Input id="actual_margin" type="number" value={skuSellingPriceForm.actual_margin} readOnly className="bg-slate-100" placeholder="Auto" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="selling_cost">Selling Cost</Label>
          <Input id="selling_cost" type="number" value={skuSellingPriceForm.selling_cost} readOnly className="bg-slate-100" placeholder="Auto" />
        </div>
      </div>
    </div>
  )

  const renderVehicleForm = () => {
    return (
      <div className="grid gap-4 py-4 px-1 max-h-[70vh] overflow-y-auto">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Vehicle ID *</Label>
            <Input value={vehicleForm.vehicle_master_id} readOnly className="bg-slate-100" />
          </div>
          <div className="space-y-2">
            <Label>Registration No *</Label>
            <Input value={vehicleForm.registration_no} onChange={e => setVehicleForm({...vehicleForm, registration_no: e.target.value})} placeholder="e.g. CG04JD1234" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Vehicle Type</Label>
            <Input value={vehicleForm.vehicle_type} onChange={e => setVehicleForm({...vehicleForm, vehicle_type: e.target.value})} placeholder="e.g. Truck" />
          </div>
          <div className="space-y-2">
            <Label>Transporter</Label>
            <Select value={vehicleForm.transporter} onValueChange={val => setVehicleForm({...vehicleForm, transporter: val})}>
              <SelectTrigger><SelectValue placeholder="Select transporter" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Company Vehicle">Company Vehicle</SelectItem>
                <SelectItem value="Party Vehicle">Party Vehicle</SelectItem>
                {transporters.map((t: any) => (
                  <SelectItem key={t.transporter_master_id || t.transporter_name} value={t.transporter_name}>{t.transporter_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={vehicleForm.status} onValueChange={val => setVehicleForm({...vehicleForm, status: val})}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>RTO</Label>
            <Input value={vehicleForm.rto} onChange={e => setVehicleForm({...vehicleForm, rto: e.target.value})} placeholder="e.g. Raipur" />
          </div>
        </div>

        <Separator className="my-2" />
        <h3 className="text-sm font-semibold text-slate-500">Document Details & Images</h3>
        
        <div className="grid grid-cols-2 gap-4 border p-3 rounded-lg bg-slate-50/50">
          <div className="space-y-2">
            <Label>Road Tax Expiry</Label>
            <Input type="date" value={vehicleForm.road_tax?.split('T')[0] || ''} onChange={e => setVehicleForm({...vehicleForm, road_tax: e.target.value})} />
          </div>
          <div className="space-y-2">
            <Label>Road Tax Image</Label>
            <div className="flex gap-2 items-center">
              <Input type="file" onChange={e => handleFileUpload(e, 'road_tax_image')} className="flex-1" />
              {vehicleForm.road_tax_image && <Badge variant="outline" className="bg-green-50">Uploaded</Badge>}
            </div>
            <p className="text-[10px] text-slate-400">Max file size: 10 MB</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 border p-3 rounded-lg bg-slate-50/50">
          <div className="space-y-2">
            <Label>Pollution Expiry</Label>
            <Input type="date" value={vehicleForm.pollution?.split('T')[0] || ''} onChange={e => setVehicleForm({...vehicleForm, pollution: e.target.value})} />
          </div>
          <div className="space-y-2">
            <Label>Pollution Image</Label>
            <div className="flex gap-2 items-center">
              <Input type="file" onChange={e => handleFileUpload(e, 'pollution_image')} className="flex-1" />
              {vehicleForm.pollution_image && <Badge variant="outline" className="bg-green-50">Uploaded</Badge>}
            </div>
            <p className="text-[10px] text-slate-400">Max file size: 10 MB</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 border p-3 rounded-lg bg-slate-50/50">
          <div className="space-y-2">
            <Label>Insurance Expiry</Label>
            <Input type="date" value={vehicleForm.insurance?.split('T')[0] || ''} onChange={e => setVehicleForm({...vehicleForm, insurance: e.target.value})} />
          </div>
          <div className="space-y-2">
            <Label>Insurance Image</Label>
            <div className="flex gap-2 items-center">
              <Input type="file" onChange={e => handleFileUpload(e, 'insurance_image')} className="flex-1" />
              {vehicleForm.insurance_image && <Badge variant="outline" className="bg-green-50">Uploaded</Badge>}
            </div>
            <p className="text-[10px] text-slate-400">Max file size: 10 MB</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 border p-3 rounded-lg bg-slate-50/50">
          <div className="space-y-2">
            <Label>Fitness Expiry</Label>
            <Input type="date" value={vehicleForm.fitness?.split('T')[0] || ''} onChange={e => setVehicleForm({...vehicleForm, fitness: e.target.value})} />
          </div>
          <div className="space-y-2">
            <Label>Fitness Image</Label>
            <div className="flex gap-2 items-center">
              <Input type="file" onChange={e => handleFileUpload(e, 'fitness_image')} className="flex-1" />
              {vehicleForm.fitness_image && <Badge variant="outline" className="bg-green-50">Uploaded</Badge>}
            </div>
            <p className="text-[10px] text-slate-400">Max file size: 10 MB</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 border p-3 rounded-lg bg-slate-50/50">
          <div className="space-y-2">
            <Label>State Permit Expiry</Label>
            <Input type="date" value={vehicleForm.state_permit?.split('T')[0] || ''} onChange={e => setVehicleForm({...vehicleForm, state_permit: e.target.value})} />
          </div>
          <div className="space-y-2">
            <Label>State Permit Image</Label>
            <div className="flex gap-2 items-center">
              <Input type="file" onChange={e => handleFileUpload(e, 'state_permit_image')} className="flex-1" />
              {vehicleForm.state_permit_image && <Badge variant="outline" className="bg-green-50">Uploaded</Badge>}
            </div>
            <p className="text-[10px] text-slate-400">Max file size: 10 MB</p>
          </div>
        </div>

        <Separator className="my-2" />
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>GVW (KGS)</Label>
            <Input type="number" value={vehicleForm.gvw} onChange={e => {
              const gvw = e.target.value
              const ulw = vehicleForm.ulw
              const passing = gvw !== '' && ulw !== '' ? String(Number(gvw) - Number(ulw)) : ''
              setVehicleForm({...vehicleForm, gvw, passing})
            }} />
          </div>
          <div className="space-y-2">
            <Label>ULW (KGS)</Label>
            <Input type="number" value={vehicleForm.ulw} onChange={e => {
              const ulw = e.target.value
              const gvw = vehicleForm.gvw
              const passing = gvw !== '' && ulw !== '' ? String(Number(gvw) - Number(ulw)) : ''
              setVehicleForm({...vehicleForm, ulw, passing})
            }} />
          </div>
          <div className="space-y-2">
            <Label>Passing (KGS)</Label>
            <Input type="number" value={vehicleForm.passing} readOnly className="bg-slate-100" />
          </div>
        </div>
      </div>
    )
  }

  const renderDriverForm = () => (
    <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto px-1">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Driver ID *</Label>
          <Input value={driverForm.driver_master_id} readOnly className="bg-slate-100" />
        </div>
        <div className="space-y-2">
          <Label>Status</Label>
          <Select value={driverForm.status} onValueChange={val => setDriverForm({...driverForm, status: val})}>
            <SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Driver Name *</Label>
          <Input value={driverForm.driver_name} onChange={e => setDriverForm({...driverForm, driver_name: e.target.value})} placeholder="Full Name" />
        </div>
        <div className="space-y-2">
          <Label>Mobile No *</Label>
          <Input value={driverForm.mobile_no} onChange={e => setDriverForm({...driverForm, mobile_no: e.target.value})} placeholder="10-digit number" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Email ID</Label>
          <Input type="email" value={driverForm.email_id} onChange={e => setDriverForm({...driverForm, email_id: e.target.value})} placeholder="email@example.com" />
        </div>
        <div className="space-y-2">
          <Label>PAN No</Label>
          <Input value={driverForm.pan_no} onChange={e => setDriverForm({...driverForm, pan_no: e.target.value})} placeholder="Permanent Account Number" />
        </div>
      </div>

      <Separator className="my-2" />

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Driving Licence No *</Label>
          <Input value={driverForm.driving_licence_no} onChange={e => setDriverForm({...driverForm, driving_licence_no: e.target.value})} placeholder="DL Number" />
        </div>
        <div className="space-y-2">
          <Label>DL Type</Label>
          <Input value={driverForm.driving_licence_type} onChange={e => setDriverForm({...driverForm, driving_licence_type: e.target.value})} placeholder="e.g. LMV/HMV" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>DL Valid Upto</Label>
          <Input type="date" value={driverForm.valid_upto?.split('T')[0] || ''} onChange={e => setDriverForm({...driverForm, valid_upto: e.target.value})} />
        </div>
        <div className="space-y-2">
          <Label>RTO</Label>
          <Input value={driverForm.rto} onChange={e => setDriverForm({...driverForm, rto: e.target.value})} placeholder="RTO Office" />
        </div>
      </div>

      <Separator className="my-2" />

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Aadhaar No</Label>
          <Input value={driverForm.aadhaar_no} onChange={e => setDriverForm({...driverForm, aadhaar_no: e.target.value})} placeholder="12-digit number" />
        </div>
        <div className="space-y-2">
          <Label>Aadhaar Upload</Label>
          <div className="flex gap-2 items-center">
            <Input type="file" onChange={e => handleFileUpload(e, 'aadhaar_upload')} className="flex-1" />
            {driverForm.aadhaar_upload && <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Uploaded</Badge>}
          </div>
          <p className="text-[10px] text-slate-400">Max file size: 10 MB</p>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Address</Label>
        <Input value={driverForm.address_line1} onChange={e => setDriverForm({...driverForm, address_line1: e.target.value})} placeholder="Full address" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>State</Label>
          <Input value={driverForm.state} onChange={e => setDriverForm({...driverForm, state: e.target.value})} placeholder="State" />
        </div>
        <div className="space-y-2">
          <Label>Pincode</Label>
          <Input value={driverForm.pincode} onChange={e => setDriverForm({...driverForm, pincode: e.target.value})} placeholder="Pincode" />
        </div>
      </div>
    </div>
  )

  const renderTransportForm = () => (
    <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto px-1">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Transport ID *</Label>
          <Input value={transportForm.transport_master_id} readOnly className="bg-slate-100" />
        </div>
        <div className="space-y-2">
          <Label>Status</Label>
          <Select value={transportForm.status} onValueChange={val => setTransportForm({...transportForm, status: val})}>
            <SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        <div className="space-y-2">
          <Label>Transporter Name *</Label>
          <Input value={transportForm.transporter_name} onChange={e => setTransportForm({...transportForm, transporter_name: e.target.value})} placeholder="Company Name" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Contact Person *</Label>
          <Input value={transportForm.contact_person} onChange={e => setTransportForm({...transportForm, contact_person: e.target.value})} placeholder="Full Name" />
        </div>
        <div className="space-y-2">
          <Label>Contact Number *</Label>
          <Input value={transportForm.contact_number} onChange={e => setTransportForm({...transportForm, contact_number: e.target.value})} placeholder="Mobile/Phone" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Email ID</Label>
          <Input type="email" value={transportForm.email_id} onChange={e => setTransportForm({...transportForm, email_id: e.target.value})} placeholder="email@example.com" />
        </div>
        <div className="space-y-2">
          <Label>Address</Label>
          <Input value={transportForm.address_line1} onChange={e => setTransportForm({...transportForm, address_line1: e.target.value})} placeholder="Office address" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>State</Label>
          <Input value={transportForm.state} onChange={e => setTransportForm({...transportForm, state: e.target.value})} placeholder="State" />
        </div>
        <div className="space-y-2">
          <Label>Pincode</Label>
          <Input value={transportForm.pincode} onChange={e => setTransportForm({...transportForm, pincode: e.target.value})} placeholder="6-digit PIN" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>PAN</Label>
          <Input value={transportForm.pan} onChange={e => setTransportForm({...transportForm, pan: e.target.value})} placeholder="Business PAN" />
        </div>
        <div className="space-y-2">
          <Label>GSTIN</Label>
          <Input value={transportForm.gstin} onChange={e => setTransportForm({...transportForm, gstin: e.target.value})} placeholder="GST Number" />
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
        <div className="flex flex-wrap items-center gap-2 md:gap-4 w-full lg:w-auto">
          <div className="relative flex-1 min-w-[140px] max-w-full md:max-w-xs transition-all duration-300 focus-within:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input 
              placeholder={`Search...`} 
              className="pl-10 h-9 md:h-10 border-slate-200 focus:border-primary/30 focus:ring-primary/10 transition-all rounded-xl" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Button 
            variant="outline" 
            size="sm"
            className="h-9 md:h-10 rounded-xl px-3 md:px-4 border-slate-200 hover:bg-slate-50 transition-all"
            onClick={() => {
              if (activeTab === "customers") refetchCustomer()
              else if (activeTab === "depots") refetchDepot()
              else if (activeTab === "brokers") refetchBroker()
              else if (activeTab === "salespersons") refetchSalesperson()
              else if (activeTab === "sku_details") refetchSku()
              else if (activeTab === "sku_selling_price") refetchSkuSellingPrice()
              else if (activeTab === "vehicle_master") refetchVehicle()
              else if (activeTab === "driver_master") refetchDriver()
            }} 
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''} md:mr-2`} />
            <span className="hidden md:inline">Refresh</span>
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open)
            if (!open) resetForms()
          }}>
            <DialogTrigger asChild>
              <Button size="sm" className="h-9 md:h-10 bg-primary hover:bg-primary/90 shadow-lg px-3 md:px-4 rounded-xl transition-all" disabled={isReadOnly} onClick={handleOpenAddDialog} title={isReadOnly ? "View Only Access" : `Add New ${activeTab.replace('_', ' ')}`}>
                <Plus className="h-4 w-4 md:mr-2" />
                <span className="hidden md:inline">Add {activeTab.split('_')[0].charAt(0).toUpperCase() + activeTab.split('_')[0].slice(1)}</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-xl">
              <DialogHeader>
                <DialogTitle>{editingItem ? "Edit" : "Add New"} {activeTab === "sku_details" ? "SKU" : activeTab === "sku_selling_price" ? "SKU Selling Price" : activeTab === "salespersons" ? "Salesperson" : activeTab === "vehicle_master" ? "Vehicle" : activeTab === "driver_master" ? "Driver" : activeTab === "transport_master" ? "Transporter" : activeTab.slice(0, -1)}</DialogTitle>
                <DialogDescription>
                  Enter the details for the {activeTab === "sku_details" ? "SKU" : activeTab === "sku_selling_price" ? "SKU Selling Price" : activeTab === "salespersons" ? "Salesperson" : activeTab === "vehicle_master" ? "Vehicle" : activeTab === "driver_master" ? "Driver" : activeTab === "transport_master" ? "Transporter" : activeTab.slice(0, -1)} record.
                </DialogDescription>
              </DialogHeader>
              {activeTab === "customers" ? renderCustomerForm() : activeTab === "depots" ? renderDepotForm() : activeTab === "sku_details" ? renderSkuDetailsForm() : activeTab === "sku_selling_price" ? renderSkuSellingPriceForm() : activeTab === "salespersons" ? renderSalespersonForm() : activeTab === "vehicle_master" ? renderVehicleForm() : activeTab === "driver_master" ? renderDriverForm() : activeTab === "transport_master" ? renderTransportForm() : renderBrokerForm()}
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

      <Tabs defaultValue="customers" className="w-full space-y-6" onValueChange={setActiveTab}>
        <div className="relative group/tabs flex items-center">
          <TabsList className="flex w-full items-center justify-start gap-1 bg-transparent p-0 overflow-x-auto no-scrollbar scroll-smooth">
            <TabsTrigger value="customers" className="flex items-center gap-2 px-5 py-2.5 rounded-xl whitespace-nowrap data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-lg transition-all duration-300">
              <Users className="h-3.5 w-3.5" />
              Customer
            </TabsTrigger>
            <TabsTrigger value="depots" className="flex items-center gap-2 px-5 py-2.5 rounded-xl whitespace-nowrap data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-lg transition-all duration-300">
              <Warehouse className="h-3.5 w-3.5" />
              Depots
            </TabsTrigger>
            <TabsTrigger value="brokers" className="flex items-center gap-2 px-5 py-2.5 rounded-xl whitespace-nowrap data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-lg transition-all duration-300">
              <Briefcase className="h-3.5 w-3.5" />
              Brokers
            </TabsTrigger>
            <TabsTrigger value="salespersons" className="flex items-center gap-2 px-5 py-2.5 rounded-xl whitespace-nowrap data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-lg transition-all duration-300">
              <Users className="h-3.5 w-3.5" />
              Salesperson
            </TabsTrigger>
            <TabsTrigger value="sku_details" className="flex items-center gap-2 px-5 py-2.5 rounded-xl whitespace-nowrap data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-lg transition-all duration-300">
              <Package className="h-3.5 w-3.5" />
              SKU List
            </TabsTrigger>
            <TabsTrigger value="sku_selling_price" className="flex items-center gap-2 px-5 py-2.5 rounded-xl whitespace-nowrap data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-lg transition-all duration-300">
              <Package className="h-3.5 w-3.5" />
              Pricing
            </TabsTrigger>
            <TabsTrigger value="vehicle_master" className="flex items-center gap-2 px-5 py-2.5 rounded-xl whitespace-nowrap data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-lg transition-all duration-300">
              <Truck className="h-3.5 w-3.5" />
              Vehicles
            </TabsTrigger>
            <TabsTrigger value="driver_master" className="flex items-center gap-2 px-5 py-2.5 rounded-xl whitespace-nowrap data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-lg transition-all duration-300">
              <User className="h-3.5 w-3.5" />
              Drivers
            </TabsTrigger>
            <TabsTrigger value="transport_master" className="flex items-center gap-2 px-5 py-2.5 rounded-xl whitespace-nowrap data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-lg transition-all duration-300">
              <Truck className="h-3.5 w-3.5" />
              Transporters
            </TabsTrigger>
          </TabsList>
        </div>

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
              <div className="flex flex-col h-[600px]">
                <div className="flex-1 overflow-auto rounded-b-2xl">
                  <table className="w-full caption-bottom text-sm">
                    <TableHeader className="sticky top-0 z-20 bg-slate-50 shadow-sm">
                      <TableRow className="hover:bg-transparent border-b">
                        <TableHead className="pl-6 cursor-pointer select-none hover:bg-slate-100 transition-colors" onClick={() => toggleSort('customer_id', customerSort, setCustomerSort)}>ID <SortIcon col="customer_id" sort={customerSort} /></TableHead>
                        <TableHead className="cursor-pointer select-none hover:bg-slate-100 transition-colors" onClick={() => toggleSort('customer_name', customerSort, setCustomerSort)}>Customer Name <SortIcon col="customer_name" sort={customerSort} /></TableHead>
                        <TableHead className="cursor-pointer select-none hover:bg-slate-100 transition-colors" onClick={() => toggleSort('contact_person', customerSort, setCustomerSort)}>Contact Person <SortIcon col="contact_person" sort={customerSort} /></TableHead>
                        <TableHead className="cursor-pointer select-none hover:bg-slate-100 transition-colors" onClick={() => toggleSort('email', customerSort, setCustomerSort)}>Email/Contact <SortIcon col="email" sort={customerSort} /></TableHead>
                        <TableHead className="cursor-pointer select-none hover:bg-slate-100 transition-colors" onClick={() => toggleSort('state', customerSort, setCustomerSort)}>Location <SortIcon col="state" sort={customerSort} /></TableHead>
                        <TableHead className="cursor-pointer select-none hover:bg-slate-100 transition-colors" onClick={() => toggleSort('status', customerSort, setCustomerSort)}>Status <SortIcon col="status" sort={customerSort} /></TableHead>
                        <TableHead className="text-right pr-6">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isCustomerLoading && customers.length === 0 ? (
                        [...Array(8)].map((_, i) => (
                          <TableRow key={i} className="opacity-40 border-b border-slate-50 h-16">
                            <TableCell className="pl-6"><div className="h-4 w-16 bg-slate-200 animate-pulse rounded" /></TableCell>
                            <TableCell><div className="h-4 w-32 bg-slate-200 animate-pulse rounded" /></TableCell>
                            <TableCell><div className="h-4 w-24 bg-slate-200 animate-pulse rounded" /></TableCell>
                            <TableCell><div className="h-8 w-40 bg-slate-200 animate-pulse rounded" /></TableCell>
                            <TableCell><div className="h-4 w-28 bg-slate-200 animate-pulse rounded" /></TableCell>
                            <TableCell><div className="h-6 w-20 bg-slate-200 animate-pulse rounded-full" /></TableCell>
                            <TableCell className="pr-6"><div className="h-8 w-16 bg-slate-100 animate-pulse rounded ml-auto" /></TableCell>
                          </TableRow>
                        ))
                      ) : customers.length === 0 ? (
                        <TableRow><TableCell colSpan={7} className="text-center py-20 text-slate-400">No customers found</TableCell></TableRow>
                      ) : (
                        <>
                          {sortedCustomers.map(item => (
                            <TableRow key={item.id} className="hover:bg-slate-50/30 transition-colors border-b border-slate-50 h-16">
                              <TableCell className="font-medium pl-6">{item.customer_id}</TableCell>
                              <TableCell className="font-semibold text-slate-900">{item.customer_name}</TableCell>
                              <TableCell>{item.contact_person || "—"}</TableCell>
                              <TableCell>
                                <div className="text-sm">
                                  <p className="text-slate-600 font-medium">{item.email || "—"}</p>
                                  <p className="text-slate-400 text-xs">{item.contact || "—"}</p>
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
                          {/* Infinite Scroll Sentinel */}
                          <TableRow ref={customerEndRef}>
                            <TableCell colSpan={7} className="p-0 h-12 border-none">
                              {isFetchingNextCustomer && (
                                <div className="flex items-center justify-center py-4 text-slate-400 bg-slate-50/20">
                                  <div className="flex gap-1.5 items-center bg-white px-4 py-1.5 rounded-full shadow-sm border border-slate-100">
                                    <div className="h-1.5 w-1.5 bg-primary animate-bounce [animation-delay:-0.3s]"></div>
                                    <div className="h-1.5 w-1.5 bg-primary animate-bounce [animation-delay:-0.15s]"></div>
                                    <div className="h-1.5 w-1.5 bg-primary animate-bounce"></div>
                                    <span className="text-xs font-medium ml-2 text-slate-500">Loading more customers...</span>
                                  </div>
                                </div>
                              )}
                            </TableCell>
                          </TableRow>
                        </>
                      )}
                    </TableBody>
                  </table>
                </div>
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
              <div className="flex flex-col h-[600px]">
                <div className="flex-1 overflow-auto rounded-b-2xl">
                  <table className="w-full caption-bottom text-sm">
                    <TableHeader className="sticky top-0 z-20 bg-slate-50 shadow-sm">
                      <TableRow className="hover:bg-transparent border-b">
                        <TableHead className="pl-6 cursor-pointer select-none hover:bg-slate-100 transition-colors" onClick={() => toggleSort('depot_id', depotSort, setDepotSort)}>ID <SortIcon col="depot_id" sort={depotSort} /></TableHead>
                        <TableHead className="cursor-pointer select-none hover:bg-slate-100 transition-colors" onClick={() => toggleSort('depot_name', depotSort, setDepotSort)}>Depot Name <SortIcon col="depot_name" sort={depotSort} /></TableHead>
                        <TableHead className="cursor-pointer select-none hover:bg-slate-100 transition-colors" onClick={() => toggleSort('depot_address', depotSort, setDepotSort)}>Address <SortIcon col="depot_address" sort={depotSort} /></TableHead>
                        <TableHead className="cursor-pointer select-none hover:bg-slate-100 transition-colors" onClick={() => toggleSort('state', depotSort, setDepotSort)}>State <SortIcon col="state" sort={depotSort} /></TableHead>
                        <TableHead className="cursor-pointer select-none hover:bg-slate-100 transition-colors" onClick={() => toggleSort('salesman_broker_name', depotSort, setDepotSort)}>Salesman/Broker <SortIcon col="salesman_broker_name" sort={depotSort} /></TableHead>
                        <TableHead className="cursor-pointer select-none hover:bg-slate-100 transition-colors" onClick={() => toggleSort('status', depotSort, setDepotSort)}>Status <SortIcon col="status" sort={depotSort} /></TableHead>
                        <TableHead className="text-right pr-6">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isDepotLoading && depots.length === 0 ? (
                        [...Array(8)].map((_, i) => (
                          <TableRow key={i} className="opacity-40 border-b border-slate-50 h-16">
                            <TableCell className="pl-6"><div className="h-4 w-16 bg-slate-200 animate-pulse rounded" /></TableCell>
                            <TableCell><div className="h-4 w-32 bg-slate-200 animate-pulse rounded" /></TableCell>
                            <TableCell><div className="h-4 w-48 bg-slate-200 animate-pulse rounded" /></TableCell>
                            <TableCell><div className="h-4 w-24 bg-slate-200 animate-pulse rounded" /></TableCell>
                            <TableCell><div className="h-4 w-28 bg-slate-200 animate-pulse rounded" /></TableCell>
                            <TableCell><div className="h-6 w-20 bg-slate-200 animate-pulse rounded-full" /></TableCell>
                            <TableCell className="pr-6"><div className="h-8 w-16 bg-slate-100 animate-pulse rounded ml-auto" /></TableCell>
                          </TableRow>
                        ))
                      ) : depots.length === 0 ? (
                        <TableRow><TableCell colSpan={7} className="text-center py-20 text-slate-400">No depots found</TableCell></TableRow>
                      ) : (
                        <>
                          {sortedDepots.map(item => (
                            <TableRow key={item.depot_id} className="hover:bg-slate-50/30 transition-colors border-b border-slate-50 h-16">
                              <TableCell className="font-medium pl-6">{item.depot_id}</TableCell>
                              <TableCell className="font-semibold text-slate-900">{item.depot_name}</TableCell>
                              <TableCell className="max-w-xs truncate text-slate-600">{item.depot_address || "—"}</TableCell>
                              <TableCell className="text-slate-600">{item.state || "—"}</TableCell>
                              <TableCell className="text-slate-600">{item.salesman_broker_name || "—"}</TableCell>
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
                          {/* Infinite Scroll Sentinel */}
                          <TableRow ref={depotEndRef}>
                            <TableCell colSpan={7} className="p-0 h-12 border-none">
                              {isFetchingNextDepot && (
                                <div className="flex items-center justify-center py-4 text-slate-400 bg-slate-50/20">
                                  <div className="flex gap-1.5 items-center bg-white px-4 py-1.5 rounded-full shadow-sm border border-slate-100">
                                    <div className="h-1.5 w-1.5 bg-primary animate-bounce [animation-delay:-0.3s]"></div>
                                    <div className="h-1.5 w-1.5 bg-primary animate-bounce [animation-delay:-0.15s]"></div>
                                    <div className="h-1.5 w-1.5 bg-primary animate-bounce"></div>
                                    <span className="text-xs font-medium ml-2 text-slate-500">Loading more depots...</span>
                                  </div>
                                </div>
                              )}
                            </TableCell>
                          </TableRow>
                        </>
                      )}
                    </TableBody>
                  </table>
                </div>
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
              <div className="flex flex-col h-[600px]">
                <div className="flex-1 overflow-auto rounded-b-2xl">
                  <table className="w-full caption-bottom text-sm">
                    <TableHeader className="sticky top-0 z-20 bg-slate-50 shadow-sm">
                      <TableRow className="hover:bg-transparent border-b">
                        <TableHead className="pl-6 cursor-pointer select-none hover:bg-slate-100 transition-colors" onClick={() => toggleSort('broker_id', brokerSort, setBrokerSort)}>ID <SortIcon col="broker_id" sort={brokerSort} /></TableHead>
                        <TableHead className="cursor-pointer select-none hover:bg-slate-100 transition-colors" onClick={() => toggleSort('salesman_name', brokerSort, setBrokerSort)}>Broker Name <SortIcon col="salesman_name" sort={brokerSort} /></TableHead>
                        <TableHead className="cursor-pointer select-none hover:bg-slate-100 transition-colors" onClick={() => toggleSort('mobile_no', brokerSort, setBrokerSort)}>Contact (Mobile/Email) <SortIcon col="mobile_no" sort={brokerSort} /></TableHead>
                        <TableHead className="cursor-pointer select-none hover:bg-slate-100 transition-colors" onClick={() => toggleSort('status', brokerSort, setBrokerSort)}>Status <SortIcon col="status" sort={brokerSort} /></TableHead>
                        <TableHead className="text-right pr-6">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isBrokerLoading && brokers.length === 0 ? (
                        [...Array(8)].map((_, i) => (
                          <TableRow key={i} className="opacity-40 border-b border-slate-50 h-16">
                            <TableCell className="pl-6"><div className="h-4 w-16 bg-slate-200 animate-pulse rounded" /></TableCell>
                            <TableCell><div className="h-4 w-32 bg-slate-200 animate-pulse rounded" /></TableCell>
                            <TableCell><div className="h-8 w-40 bg-slate-200 animate-pulse rounded" /></TableCell>
                            <TableCell><div className="h-6 w-20 bg-slate-200 animate-pulse rounded-full" /></TableCell>
                            <TableCell className="pr-6"><div className="h-8 w-16 bg-slate-100 animate-pulse rounded ml-auto" /></TableCell>
                          </TableRow>
                        ))
                      ) : brokers.length === 0 ? (
                        <TableRow><TableCell colSpan={5} className="text-center py-20 text-slate-400">No brokers found</TableCell></TableRow>
                      ) : (
                        <>
                          {sortedBrokers.map(item => (
                            <TableRow key={item.broker_id} className="hover:bg-slate-50/30 transition-colors border-b border-slate-50 h-16">
                              <TableCell className="font-medium pl-6">{item.broker_id}</TableCell>
                              <TableCell className="font-semibold text-slate-900">{item.salesman_name}</TableCell>
                              <TableCell>
                                <div className="text-sm">
                                  <p className="text-slate-600 font-medium">{item.mobile_no || "—"}</p>
                                  <p className="text-slate-400 text-xs">{item.email_id || "—"}</p>
                                </div>
                              </TableCell>
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
                          {/* Infinite Scroll Sentinel */}
                          <TableRow ref={brokerEndRef}>
                            <TableCell colSpan={5} className="p-0 h-12 border-none">
                              {isFetchingNextBroker && (
                                <div className="flex items-center justify-center py-4 text-slate-400 bg-slate-50/20">
                                  <div className="flex gap-1.5 items-center bg-white px-4 py-1.5 rounded-full shadow-sm border border-slate-100">
                                    <div className="h-1.5 w-1.5 bg-primary animate-bounce [animation-delay:-0.3s]"></div>
                                    <div className="h-1.5 w-1.5 bg-primary animate-bounce [animation-delay:-0.15s]"></div>
                                    <div className="h-1.5 w-1.5 bg-primary animate-bounce"></div>
                                    <span className="text-xs font-medium ml-2 text-slate-500">Loading more brokers...</span>
                                  </div>
                                </div>
                              )}
                            </TableCell>
                          </TableRow>
                        </>
                      )}
                    </TableBody>
                  </table>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="salespersons">
          <Card className="shadow-xl border-none rounded-2xl bg-white">
            <CardHeader className="bg-slate-50/50 border-b p-6">
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="text-xl font-bold flex items-center gap-2">
                    <Users className="h-5 w-5 text-primary" />
                    Salespersons List
                  </CardTitle>
                  <CardDescription className="mt-1">Manage your salesperson database</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="flex flex-col h-[600px]">
                <div className="flex-1 overflow-auto rounded-b-2xl">
                  <table className="w-full caption-bottom text-sm">
                    <TableHeader className="sticky top-0 z-20 bg-slate-50 shadow-sm">
                      <TableRow className="hover:bg-transparent border-b">
                        <TableHead className="pl-6 cursor-pointer select-none hover:bg-slate-100 transition-colors" onClick={() => toggleSort('broker_id', salespersonSort, setSalespersonSort)}>ID <SortIcon col="broker_id" sort={salespersonSort} /></TableHead>
                        <TableHead className="cursor-pointer select-none hover:bg-slate-100 transition-colors" onClick={() => toggleSort('salesman_name', salespersonSort, setSalespersonSort)}>Salesman Name <SortIcon col="salesman_name" sort={salespersonSort} /></TableHead>
                        <TableHead className="cursor-pointer select-none hover:bg-slate-100 transition-colors" onClick={() => toggleSort('mobile_no', salespersonSort, setSalespersonSort)}>Contact (Mobile/Email) <SortIcon col="mobile_no" sort={salespersonSort} /></TableHead>
                        <TableHead className="cursor-pointer select-none hover:bg-slate-100 transition-colors" onClick={() => toggleSort('status', salespersonSort, setSalespersonSort)}>Status <SortIcon col="status" sort={salespersonSort} /></TableHead>
                        <TableHead className="text-right pr-6">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isSalespersonLoading && salespersons.length === 0 ? (
                        [...Array(8)].map((_, i) => (
                          <TableRow key={i} className="opacity-40 border-b border-slate-50 h-16">
                            <TableCell className="pl-6"><div className="h-4 w-16 bg-slate-200 animate-pulse rounded" /></TableCell>
                            <TableCell><div className="h-4 w-32 bg-slate-200 animate-pulse rounded" /></TableCell>
                            <TableCell><div className="h-8 w-40 bg-slate-200 animate-pulse rounded" /></TableCell>
                            <TableCell><div className="h-6 w-20 bg-slate-200 animate-pulse rounded-full" /></TableCell>
                            <TableCell className="pr-6"><div className="h-8 w-16 bg-slate-100 animate-pulse rounded ml-auto" /></TableCell>
                          </TableRow>
                        ))
                      ) : salespersons.length === 0 ? (
                        <TableRow><TableCell colSpan={5} className="text-center py-20 text-slate-400">No salespersons found</TableCell></TableRow>
                      ) : (
                        <>
                          {sortedSalespersons.map(item => (
                            <TableRow key={item.broker_id} className="hover:bg-slate-50/30 transition-colors border-b border-slate-50 h-16">
                              <TableCell className="font-medium pl-6">{item.broker_id}</TableCell>
                              <TableCell className="font-semibold text-slate-900">{item.salesman_name}</TableCell>
                              <TableCell>
                                <div className="text-sm">
                                  <p className="text-slate-600 font-medium">{item.mobile_no || "—"}</p>
                                  <p className="text-slate-400 text-xs">{item.email_id || "—"}</p>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge variant={item.status === 'Active' ? 'default' : 'secondary'} className={item.status === 'Active' ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border-none' : ''}>
                                  {item.status}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right pr-6">
                                <div className="flex justify-end gap-2">
                                  <Button variant="ghost" size="icon" onClick={() => openEditDialog(item)} className="h-8 w-8 text-blue-600 hover:bg-blue-50" disabled={isReadOnly} title={isReadOnly ? "View Only Access" : "Edit Salesperson"}>
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <Button variant="ghost" size="icon" onClick={() => { setDeletingItem(item); setIsDeleteDialogOpen(true); }} className="h-8 w-8 text-destructive hover:bg-red-50" disabled={isReadOnly} title={isReadOnly ? "View Only Access" : "Delete Salesperson"}>
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                          {/* Infinite Scroll Sentinel */}
                          <TableRow ref={salespersonEndRef}>
                            <TableCell colSpan={5} className="p-0 h-12 border-none">
                              {isFetchingNextSalesperson && (
                                <div className="flex items-center justify-center py-4 text-slate-400 bg-slate-50/20">
                                  <div className="flex gap-1.5 items-center bg-white px-4 py-1.5 rounded-full shadow-sm border border-slate-100">
                                    <div className="h-1.5 w-1.5 bg-primary animate-bounce [animation-delay:-0.3s]"></div>
                                    <div className="h-1.5 w-1.5 bg-primary animate-bounce [animation-delay:-0.15s]"></div>
                                    <div className="h-1.5 w-1.5 bg-primary animate-bounce"></div>
                                    <span className="text-xs font-medium ml-2 text-slate-500">Loading more salespersons...</span>
                                  </div>
                                </div>
                              )}
                            </TableCell>
                          </TableRow>
                        </>
                      )}
                    </TableBody>
                  </table>
                </div>
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
              <div className="flex flex-col h-[600px]">
                <div className="flex-1 overflow-auto rounded-b-2xl">
                  <table className="w-full caption-bottom text-sm">
                    <TableHeader className="sticky top-0 z-20 bg-slate-50 shadow-sm">
                      <TableRow className="hover:bg-transparent border-b">
                        <TableHead className="pl-6 cursor-pointer select-none hover:bg-slate-100 transition-colors" onClick={() => toggleSort('sku_code', skuSort, setSkuSort)}>ID <SortIcon col="sku_code" sort={skuSort} /></TableHead>
                        <TableHead className="cursor-pointer select-none hover:bg-slate-100 transition-colors" onClick={() => toggleSort('sku_name', skuSort, setSkuSort)}>SKU Name <SortIcon col="sku_name" sort={skuSort} /></TableHead>
                        <TableHead className="cursor-pointer select-none hover:bg-slate-100 transition-colors" onClick={() => toggleSort('main_uom', skuSort, setSkuSort)}>Main UOM <SortIcon col="main_uom" sort={skuSort} /></TableHead>
                        <TableHead className="cursor-pointer select-none hover:bg-slate-100 transition-colors" onClick={() => toggleSort('alternate_uom', skuSort, setSkuSort)}>Alt. UOM <SortIcon col="alternate_uom" sort={skuSort} /></TableHead>
                        <TableHead className="cursor-pointer select-none hover:bg-slate-100 transition-colors" onClick={() => toggleSort('packing_weight', skuSort, setSkuSort)}>Packing Wt <SortIcon col="packing_weight" sort={skuSort} /></TableHead>
                        <TableHead className="cursor-pointer select-none hover:bg-slate-100 transition-colors" onClick={() => toggleSort('gross_weight', skuSort, setSkuSort)}>Gross Wt <SortIcon col="gross_weight" sort={skuSort} /></TableHead>
                        <TableHead className="cursor-pointer select-none hover:bg-slate-100 transition-colors" onClick={() => toggleSort('status', skuSort, setSkuSort)}>Status <SortIcon col="status" sort={skuSort} /></TableHead>
                        <TableHead className="text-right pr-6">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isSkuLoading && skuDetails.length === 0 ? (
                        [...Array(8)].map((_, i) => (
                          <TableRow key={i} className="opacity-40 border-b border-slate-50 h-16">
                            <TableCell className="pl-6"><div className="h-4 w-16 bg-slate-200 animate-pulse rounded" /></TableCell>
                            <TableCell><div className="h-4 w-40 bg-slate-200 animate-pulse rounded" /></TableCell>
                            <TableCell><div className="h-4 w-12 bg-slate-200 animate-pulse rounded" /></TableCell>
                            <TableCell><div className="h-4 w-12 bg-slate-200 animate-pulse rounded" /></TableCell>
                            <TableCell><div className="h-4 w-16 bg-slate-200 animate-pulse rounded" /></TableCell>
                            <TableCell><div className="h-4 w-16 bg-slate-200 animate-pulse rounded" /></TableCell>
                            <TableCell><div className="h-6 w-20 bg-slate-200 animate-pulse rounded-full" /></TableCell>
                            <TableCell className="pr-6"><div className="h-8 w-16 bg-slate-100 animate-pulse rounded ml-auto" /></TableCell>
                          </TableRow>
                        ))
                      ) : skuDetails.length === 0 ? (
                        <TableRow><TableCell colSpan={8} className="text-center py-20 text-slate-400">No SKUs found</TableCell></TableRow>
                      ) : (
                        <>
                          {sortedSkuDetails.map(item => (
                            <TableRow key={item.id} className="hover:bg-slate-50/30 transition-colors border-b border-slate-50 h-16">
                              <TableCell className="font-semibold text-slate-900 pl-6">{item.sku_code}</TableCell>
                              <TableCell className="text-slate-700">{item.sku_name}</TableCell>
                              <TableCell className="text-slate-600">{item.main_uom}</TableCell>
                              <TableCell className="text-slate-600">{item.alternate_uom}</TableCell>
                              <TableCell className="text-slate-600 font-medium">{item.packing_weight}</TableCell>
                              <TableCell className="text-slate-600 font-medium">{item.gross_weight}</TableCell>
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
                          {/* Infinite Scroll Sentinel */}
                          <TableRow ref={skuEndRef}>
                            <TableCell colSpan={8} className="p-0 h-12 border-none">
                              {isFetchingNextSku && (
                                <div className="flex items-center justify-center py-4 text-slate-400 bg-slate-50/20">
                                  <div className="flex gap-1.5 items-center bg-white px-4 py-1.5 rounded-full shadow-sm border border-slate-100">
                                    <div className="h-1.5 w-1.5 bg-primary animate-bounce [animation-delay:-0.3s]"></div>
                                    <div className="h-1.5 w-1.5 bg-primary animate-bounce [animation-delay:-0.15s]"></div>
                                    <div className="h-1.5 w-1.5 bg-primary animate-bounce"></div>
                                    <span className="text-xs font-medium ml-2 text-slate-500">Loading more SKUs...</span>
                                  </div>
                                </div>
                              )}
                            </TableCell>
                          </TableRow>
                        </>
                      )}
                    </TableBody>
                  </table>
                </div>
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
              <div className="flex flex-col h-[600px]">
                <div className="flex-1 overflow-auto rounded-b-2xl">
                  <table className="w-full caption-bottom text-sm">
                    <TableHeader className="sticky top-0 z-20 bg-slate-50 shadow-sm">
                      <TableRow className="hover:bg-transparent border-b">
                        <TableHead className="pl-6 cursor-pointer select-none hover:bg-slate-100 transition-colors" onClick={() => toggleSort('packing_material', skuSellingPriceSort, setSkuSellingPriceSort)}>Packing Material <SortIcon col="packing_material" sort={skuSellingPriceSort} /></TableHead>
                        <TableHead className="cursor-pointer select-none hover:bg-slate-100 transition-colors" onClick={() => toggleSort('sku_weight', skuSellingPriceSort, setSkuSellingPriceSort)}>Weight <SortIcon col="sku_weight" sort={skuSellingPriceSort} /></TableHead>
                        <TableHead className="cursor-pointer select-none hover:bg-slate-100 transition-colors" onClick={() => toggleSort('sku_unit', skuSellingPriceSort, setSkuSellingPriceSort)}>Unit <SortIcon col="sku_unit" sort={skuSellingPriceSort} /></TableHead>
                        <TableHead className="cursor-pointer select-none hover:bg-slate-100 transition-colors" onClick={() => toggleSort('conversion_formula', skuSellingPriceSort, setSkuSellingPriceSort)}>Conv. Form <SortIcon col="conversion_formula" sort={skuSellingPriceSort} /></TableHead>
                        <TableHead className="cursor-pointer select-none hover:bg-slate-100 transition-colors" onClick={() => toggleSort('sku_weight_in_gm', skuSellingPriceSort, setSkuSellingPriceSort)}>SKU Wght(gm) <SortIcon col="sku_weight_in_gm" sort={skuSellingPriceSort} /></TableHead>
                        <TableHead className="cursor-pointer select-none hover:bg-slate-100 transition-colors" onClick={() => toggleSort('packing_material_weight_in_gm', skuSellingPriceSort, setSkuSellingPriceSort)}>Pack Mat. Wght <SortIcon col="packing_material_weight_in_gm" sort={skuSellingPriceSort} /></TableHead>
                        <TableHead className="cursor-pointer select-none hover:bg-slate-100 transition-colors" onClick={() => toggleSort('net_oil_in_gm', skuSellingPriceSort, setSkuSellingPriceSort)}>Net Oil(gm) <SortIcon col="net_oil_in_gm" sort={skuSellingPriceSort} /></TableHead>
                        <TableHead className="cursor-pointer select-none hover:bg-slate-100 transition-colors" onClick={() => toggleSort('packing_cost', skuSellingPriceSort, setSkuSellingPriceSort)}>Pack Cost <SortIcon col="packing_cost" sort={skuSellingPriceSort} /></TableHead>
                        <TableHead className="cursor-pointer select-none hover:bg-slate-100 transition-colors" onClick={() => toggleSort('var', skuSellingPriceSort, setSkuSellingPriceSort)}>VAR <SortIcon col="var" sort={skuSellingPriceSort} /></TableHead>
                        <TableHead className="cursor-pointer select-none hover:bg-slate-100 transition-colors" onClick={() => toggleSort('landing_cost', skuSellingPriceSort, setSkuSellingPriceSort)}>Landing Cost <SortIcon col="landing_cost" sort={skuSellingPriceSort} /></TableHead>
                        <TableHead className="cursor-pointer select-none hover:bg-slate-100 transition-colors" onClick={() => toggleSort('margin', skuSellingPriceSort, setSkuSellingPriceSort)}>Margin <SortIcon col="margin" sort={skuSellingPriceSort} /></TableHead>
                        <TableHead className="cursor-pointer select-none hover:bg-slate-100 transition-colors" onClick={() => toggleSort('actual_margin', skuSellingPriceSort, setSkuSellingPriceSort)}>Actual Margin <SortIcon col="actual_margin" sort={skuSellingPriceSort} /></TableHead>
                        <TableHead className="cursor-pointer select-none hover:bg-slate-100 transition-colors" onClick={() => toggleSort('selling_cost', skuSellingPriceSort, setSkuSellingPriceSort)}>Selling Cost <SortIcon col="selling_cost" sort={skuSellingPriceSort} /></TableHead>
                        <TableHead className="text-right pr-6">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isSkuSellingPriceLoading && skuSellingPrices.length === 0 ? (
                        [...Array(8)].map((_, i) => (
                          <TableRow key={i} className="opacity-40 border-b border-slate-50 h-16">
                            <TableCell className="pl-6"><div className="h-4 w-32 bg-slate-200 animate-pulse rounded" /></TableCell>
                            <TableCell><div className="h-4 w-12 bg-slate-200 animate-pulse rounded" /></TableCell>
                            <TableCell><div className="h-4 w-12 bg-slate-200 animate-pulse rounded" /></TableCell>
                            <TableCell><div className="h-4 w-16 bg-slate-200 animate-pulse rounded" /></TableCell>
                            <TableCell><div className="h-4 w-16 bg-slate-200 animate-pulse rounded" /></TableCell>
                            <TableCell><div className="h-4 w-16 bg-slate-200 animate-pulse rounded" /></TableCell>
                            <TableCell><div className="h-4 w-16 bg-slate-200 animate-pulse rounded" /></TableCell>
                            <TableCell><div className="h-4 w-16 bg-slate-200 animate-pulse rounded" /></TableCell>
                            <TableCell><div className="h-4 w-12 bg-slate-200 animate-pulse rounded" /></TableCell>
                            <TableCell><div className="h-4 w-20 bg-slate-200 animate-pulse rounded" /></TableCell>
                            <TableCell><div className="h-4 w-16 bg-slate-200 animate-pulse rounded" /></TableCell>
                            <TableCell><div className="h-4 w-20 bg-slate-200 animate-pulse rounded" /></TableCell>
                            <TableCell><div className="h-4 w-24 bg-slate-200 animate-pulse rounded" /></TableCell>
                            <TableCell className="pr-6"><div className="h-8 w-16 bg-slate-100 animate-pulse rounded ml-auto" /></TableCell>
                          </TableRow>
                        ))
                      ) : skuSellingPrices.length === 0 ? (
                        <TableRow><TableCell colSpan={14} className="text-center py-20 text-slate-400">No SKU Prices found</TableCell></TableRow>
                      ) : (
                        <>
                          {sortedSkuSellingPrices.map(item => (
                            <TableRow key={item.id} className="hover:bg-slate-50/30 transition-colors border-b border-slate-50 h-16">
                              <TableCell className="font-semibold text-slate-900 pl-6">{item.packing_material}</TableCell>
                              <TableCell className="text-slate-600 font-medium">{item.sku_weight}</TableCell>
                              <TableCell className="text-slate-500">{item.sku_unit}</TableCell>
                              <TableCell className="text-slate-500">{item.conversion_formula}</TableCell>
                              <TableCell className="text-slate-500">{item.sku_weight_in_gm}</TableCell>
                              <TableCell className="text-slate-500">{item.packing_material_weight_in_gm}</TableCell>
                              <TableCell className="text-slate-500">{item.net_oil_in_gm}</TableCell>
                              <TableCell className="text-slate-500">{item.packing_cost}</TableCell>
                              <TableCell className="text-slate-500">{item.var}</TableCell>
                              <TableCell className="font-bold text-slate-700 underline decoration-slate-200 decoration-2 underline-offset-4">{item.landing_cost}</TableCell>
                              <TableCell className="text-slate-600">{item.margin}</TableCell>
                              <TableCell className="text-slate-600 font-medium">{item.actual_margin}</TableCell>
                              <TableCell className="font-bold text-emerald-600 bg-emerald-50/50 rounded-lg px-2 py-1 inline-block mt-2 ml-4 mb-2">{item.selling_cost}</TableCell>
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
                          {/* Infinite Scroll Sentinel */}
                          <TableRow ref={skuSellingPriceEndRef}>
                            <TableCell colSpan={14} className="p-0 h-12 border-none">
                              {isFetchingNextSkuSellingPrice && (
                                <div className="flex items-center justify-center py-4 text-slate-400 bg-slate-50/20">
                                  <div className="flex gap-1.5 items-center bg-white px-4 py-1.5 rounded-full shadow-sm border border-slate-100">
                                    <div className="h-1.5 w-1.5 bg-primary animate-bounce [animation-delay:-0.3s]"></div>
                                    <div className="h-1.5 w-1.5 bg-primary animate-bounce [animation-delay:-0.15s]"></div>
                                    <div className="h-1.5 w-1.5 bg-primary animate-bounce"></div>
                                    <span className="text-xs font-medium ml-2 text-slate-500">Loading more prices...</span>
                                  </div>
                                </div>
                              )}
                            </TableCell>
                          </TableRow>
                        </>
                      )}
                    </TableBody>
                  </table>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="vehicle_master">
          <Card className="shadow-xl border-none rounded-2xl bg-white">
            <CardHeader className="bg-slate-50/50 border-b p-6">
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="text-xl font-bold flex items-center gap-2">
                    <Truck className="h-5 w-5 text-primary" />
                    Vehicles List
                  </CardTitle>
                  <CardDescription className="mt-1">Manage your vehicle database and documents</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="flex flex-col h-[600px]">
                <div className="flex-1 overflow-auto rounded-b-2xl">
                  <table className="w-full caption-bottom text-sm">
                    <TableHeader className="sticky top-0 z-20 bg-slate-50 shadow-sm">
                      <TableRow className="hover:bg-transparent border-b">
                        <TableHead className="pl-6 cursor-pointer select-none hover:bg-slate-100 transition-colors" onClick={() => toggleSort('vehicle_master_id', vehicleSort, setVehicleSort)}>ID <SortIcon col="vehicle_master_id" sort={vehicleSort} /></TableHead>
                        <TableHead className="cursor-pointer select-none hover:bg-slate-100 transition-colors" onClick={() => toggleSort('registration_no', vehicleSort, setVehicleSort)}>Reg No <SortIcon col="registration_no" sort={vehicleSort} /></TableHead>
                        <TableHead className="cursor-pointer select-none hover:bg-slate-100 transition-colors" onClick={() => toggleSort('transporter', vehicleSort, setVehicleSort)}>Transporter <SortIcon col="transporter" sort={vehicleSort} /></TableHead>
                        <TableHead>Type/RTO</TableHead>
                        <TableHead>Documents</TableHead>
                        <TableHead className="cursor-pointer select-none hover:bg-slate-100 transition-colors" onClick={() => toggleSort('status', vehicleSort, setVehicleSort)}>Status <SortIcon col="status" sort={vehicleSort} /></TableHead>
                        <TableHead className="text-right pr-6">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isVehicleLoading && vehicles.length === 0 ? (
                        [...Array(8)].map((_, i) => (
                          <TableRow key={i} className="opacity-40 border-b border-slate-50 h-16">
                            <TableCell className="pl-6"><div className="h-4 w-16 bg-slate-200 animate-pulse rounded" /></TableCell>
                            <TableCell><div className="h-4 w-32 bg-slate-200 animate-pulse rounded" /></TableCell>
                            <TableCell><div className="h-4 w-40 bg-slate-200 animate-pulse rounded" /></TableCell>
                            <TableCell><div className="h-4 w-32 bg-slate-200 animate-pulse rounded" /></TableCell>
                            <TableCell><div className="h-4 w-40 bg-slate-200 animate-pulse rounded" /></TableCell>
                            <TableCell><div className="h-6 w-20 bg-slate-200 animate-pulse rounded-full" /></TableCell>
                            <TableCell className="pr-6"><div className="h-8 w-16 bg-slate-100 animate-pulse rounded ml-auto" /></TableCell>
                          </TableRow>
                        ))
                      ) : vehicles.length === 0 ? (
                        <TableRow><TableCell colSpan={7} className="text-center py-20 text-slate-400">No vehicles found</TableCell></TableRow>
                      ) : (
                        <>
                          {sortedVehicles.map(item => (
                            <TableRow key={item.id} className="hover:bg-slate-50/30 transition-colors border-b border-slate-50 h-16">
                              <TableCell className="font-medium pl-6">{item.vehicle_master_id}</TableCell>
                              <TableCell className="font-semibold text-slate-900">{item.registration_no}</TableCell>
                              <TableCell className="text-slate-600">{item.transporter || "—"}</TableCell>
                              <TableCell>
                                <div className="text-xs">
                                  <p className="font-medium text-slate-700">{item.vehicle_type || "—"}</p>
                                  <p className="text-slate-400">{item.rto || "—"}</p>
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex flex-wrap gap-1">
                                  {item.road_tax_image && <Badge variant="outline" className="text-[10px] bg-blue-50 cursor-pointer" onClick={() => window.open(item.road_tax_image, '_blank')}>Tax</Badge>}
                                  {item.pollution_image && <Badge variant="outline" className="text-[10px] bg-blue-50 cursor-pointer" onClick={() => window.open(item.pollution_image, '_blank')}>Poll</Badge>}
                                  {item.insurance_image && <Badge variant="outline" className="text-[10px] bg-blue-50 cursor-pointer" onClick={() => window.open(item.insurance_image, '_blank')}>Ins</Badge>}
                                  {item.fitness_image && <Badge variant="outline" className="text-[10px] bg-blue-50 cursor-pointer" onClick={() => window.open(item.fitness_image, '_blank')}>Fit</Badge>}
                                  {item.state_permit_image && <Badge variant="outline" className="text-[10px] bg-blue-50 cursor-pointer" onClick={() => window.open(item.state_permit_image, '_blank')}>Permit</Badge>}
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge variant={item.status === 'Active' ? 'default' : 'secondary'} className={item.status === 'Active' ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border-none' : ''}>
                                  {item.status}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right pr-6">
                                <div className="flex justify-end gap-2">
                                  <Button variant="ghost" size="icon" onClick={() => openEditDialog(item)} className="h-8 w-8 text-blue-600 hover:bg-blue-50" disabled={isReadOnly} title={isReadOnly ? "View Only Access" : "Edit Vehicle"}>
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <Button variant="ghost" size="icon" onClick={() => { setDeletingItem(item); setIsDeleteDialogOpen(true); }} className="h-8 w-8 text-destructive hover:bg-red-50" disabled={isReadOnly} title={isReadOnly ? "View Only Access" : "Delete Vehicle"}>
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                          {/* Infinite Scroll Sentinel */}
                          <TableRow ref={vehicleEndRef}>
                            <TableCell colSpan={7} className="p-0 h-12 border-none">
                              {isFetchingNextVehicle && (
                                <div className="flex items-center justify-center py-4 text-slate-400 bg-slate-50/20">
                                  <div className="flex gap-1.5 items-center bg-white px-4 py-1.5 rounded-full shadow-sm border border-slate-100">
                                    <div className="h-1.5 w-1.5 bg-primary animate-bounce [animation-delay:-0.3s]"></div>
                                    <div className="h-1.5 w-1.5 bg-primary animate-bounce [animation-delay:-0.15s]"></div>
                                    <div className="h-1.5 w-1.5 bg-primary animate-bounce"></div>
                                    <span className="text-xs font-medium ml-2 text-slate-500">Loading more vehicles...</span>
                                  </div>
                                </div>
                              )}
                            </TableCell>
                          </TableRow>
                        </>
                      )}
                    </TableBody>
                  </table>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="driver_master">
          <Card className="shadow-xl border-none rounded-2xl bg-white">
            <CardHeader className="bg-slate-50/50 border-b p-6">
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="text-xl font-bold flex items-center gap-2">
                    <User className="h-5 w-5 text-primary" />
                    Drivers List
                  </CardTitle>
                  <CardDescription className="mt-1">Manage your driver database and licences</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="flex flex-col h-[600px]">
                <div className="flex-1 overflow-auto rounded-b-2xl">
                  <table className="w-full caption-bottom text-sm">
                    <TableHeader className="sticky top-0 z-20 bg-slate-50 shadow-sm">
                      <TableRow className="hover:bg-transparent border-b">
                        <TableHead className="pl-6 cursor-pointer select-none hover:bg-slate-100 transition-colors" onClick={() => toggleSort('driver_master_id', driverSort, setDriverSort)}>ID <SortIcon col="driver_master_id" sort={driverSort} /></TableHead>
                        <TableHead className="cursor-pointer select-none hover:bg-slate-100 transition-colors" onClick={() => toggleSort('driver_name', driverSort, setDriverSort)}>Driver Name <SortIcon col="driver_name" sort={driverSort} /></TableHead>
                        <TableHead className="cursor-pointer select-none hover:bg-slate-100 transition-colors" onClick={() => toggleSort('mobile_no', driverSort, setDriverSort)}>Mobile <SortIcon col="mobile_no" sort={driverSort} /></TableHead>
                        <TableHead>Licence Info</TableHead>
                        <TableHead>Aadhaar/PAN</TableHead>
                        <TableHead className="cursor-pointer select-none hover:bg-slate-100 transition-colors" onClick={() => toggleSort('status', driverSort, setDriverSort)}>Status <SortIcon col="status" sort={driverSort} /></TableHead>
                        <TableHead className="text-right pr-6">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isDriverLoading && drivers.length === 0 ? (
                        [...Array(8)].map((_, i) => (
                          <TableRow key={i} className="opacity-40 border-b border-slate-50 h-16">
                            <TableCell className="pl-6"><div className="h-4 w-16 bg-slate-200 animate-pulse rounded" /></TableCell>
                            <TableCell><div className="h-4 w-32 bg-slate-200 animate-pulse rounded" /></TableCell>
                            <TableCell><div className="h-4 w-24 bg-slate-200 animate-pulse rounded" /></TableCell>
                            <TableCell><div className="h-4 w-32 bg-slate-200 animate-pulse rounded" /></TableCell>
                            <TableCell><div className="h-4 w-32 bg-slate-200 animate-pulse rounded" /></TableCell>
                            <TableCell><div className="h-6 w-20 bg-slate-200 animate-pulse rounded-full" /></TableCell>
                            <TableCell className="pr-6"><div className="h-8 w-16 bg-slate-100 animate-pulse rounded ml-auto" /></TableCell>
                          </TableRow>
                        ))
                      ) : drivers.length === 0 ? (
                        <TableRow><TableCell colSpan={7} className="text-center py-20 text-slate-400">No drivers found</TableCell></TableRow>
                      ) : (
                        <>
                          {sortedDrivers.map(item => (
                            <TableRow key={item.id} className="hover:bg-slate-50/30 transition-colors border-b border-slate-50 h-16">
                              <TableCell className="font-medium pl-6">{item.driver_master_id}</TableCell>
                              <TableCell className="font-semibold text-slate-900">{item.driver_name}</TableCell>
                              <TableCell className="text-slate-600">{item.mobile_no || "—"}</TableCell>
                              <TableCell>
                                <div className="text-xs">
                                  <p className="font-medium text-slate-700">{item.driving_licence_no || "—"}</p>
                                  <p className="text-slate-400">{item.driving_licence_type || "—"}</p>
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex flex-wrap gap-1">
                                  {item.aadhaar_no && <Badge variant="outline" className="text-[10px] bg-indigo-50 border-indigo-100 text-indigo-700">Aadhaar: {item.aadhaar_no.slice(-4)}</Badge>}
                                  {item.aadhaar_upload && <Badge variant="outline" className="text-[10px] bg-blue-50 cursor-pointer" onClick={() => window.open(item.aadhaar_upload, '_blank')}>View Art</Badge>}
                                  {item.pan_no && <Badge variant="outline" className="text-[10px] bg-slate-100">PAN: {item.pan_no}</Badge>}
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge variant={item.status === 'Active' ? 'default' : 'secondary'} className={item.status === 'Active' ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border-none' : ''}>
                                  {item.status}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right pr-6">
                                <div className="flex justify-end gap-2">
                                  <Button variant="ghost" size="icon" onClick={() => openEditDialog(item)} className="h-8 w-8 text-blue-600 hover:bg-blue-50" disabled={isReadOnly} title={isReadOnly ? "View Only Access" : "Edit Driver"}>
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <Button variant="ghost" size="icon" onClick={() => { setDeletingItem(item); setIsDeleteDialogOpen(true); }} className="h-8 w-8 text-destructive hover:bg-red-50" disabled={isReadOnly} title={isReadOnly ? "View Only Access" : "Delete Driver"}>
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                          {/* Infinite Scroll Sentinel */}
                          <TableRow ref={driverEndRef}>
                            <TableCell colSpan={7} className="p-0 h-12 border-none">
                              {isFetchingNextDriver && (
                                <div className="flex items-center justify-center py-4 text-slate-400 bg-slate-50/20">
                                  <div className="flex gap-1.5 items-center bg-white px-4 py-1.5 rounded-full shadow-sm border border-slate-100">
                                    <div className="h-1.5 w-1.5 bg-primary animate-bounce [animation-delay:-0.3s]"></div>
                                    <div className="h-1.5 w-1.5 bg-primary animate-bounce [animation-delay:-0.15s]"></div>
                                    <div className="h-1.5 w-1.5 bg-primary animate-bounce"></div>
                                    <span className="text-xs font-medium ml-2 text-slate-500">Loading more drivers...</span>
                                  </div>
                                </div>
                              )}
                            </TableCell>
                          </TableRow>
                        </>
                      )}
                    </TableBody>
                  </table>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="transport_master">
          <Card className="shadow-xl border-none rounded-2xl bg-white">
            <CardHeader className="bg-slate-50/50 border-b p-6">
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="text-xl font-bold flex items-center gap-2">
                    <Truck className="h-5 w-5 text-primary" />
                    Transporters List
                  </CardTitle>
                  <CardDescription className="mt-1">Manage your transporter and logistics partners</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="flex flex-col h-[600px]">
                <div className="flex-1 overflow-auto rounded-b-2xl">
                  <table className="w-full caption-bottom text-sm">
                    <TableHeader className="sticky top-0 z-20 bg-slate-50 shadow-sm">
                      <TableRow className="hover:bg-transparent border-b">
                        <TableHead className="pl-6 cursor-pointer select-none hover:bg-slate-100 transition-colors" onClick={() => toggleSort('transport_master_id', transportSort, setTransportSort)}>ID <SortIcon col="transport_master_id" sort={transportSort} /></TableHead>
                        <TableHead className="cursor-pointer select-none hover:bg-slate-100 transition-colors" onClick={() => toggleSort('transporter_name', transportSort, setTransportSort)}>Transporter Name <SortIcon col="transporter_name" sort={transportSort} /></TableHead>
                        <TableHead className="cursor-pointer select-none hover:bg-slate-100 transition-colors" onClick={() => toggleSort('contact_person', transportSort, setTransportSort)}>Contact Person <SortIcon col="contact_person" sort={transportSort} /></TableHead>
                        <TableHead>Contact Details</TableHead>
                        <TableHead>Credentials</TableHead>
                        <TableHead className="cursor-pointer select-none hover:bg-slate-100 transition-colors" onClick={() => toggleSort('status', transportSort, setTransportSort)}>Status <SortIcon col="status" sort={transportSort} /></TableHead>
                        <TableHead className="text-right pr-6">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isTransportLoading && transporters.length === 0 ? (
                        [...Array(8)].map((_, i) => (
                          <TableRow key={i} className="opacity-40 border-b border-slate-50 h-16">
                            <TableCell className="pl-6"><div className="h-4 w-16 bg-slate-200 animate-pulse rounded" /></TableCell>
                            <TableCell><div className="h-4 w-32 bg-slate-200 animate-pulse rounded" /></TableCell>
                            <TableCell><div className="h-4 w-24 bg-slate-200 animate-pulse rounded" /></TableCell>
                            <TableCell><div className="h-8 w-40 bg-slate-200 animate-pulse rounded" /></TableCell>
                            <TableCell><div className="h-8 w-32 bg-slate-200 animate-pulse rounded" /></TableCell>
                            <TableCell><div className="h-6 w-20 bg-slate-200 animate-pulse rounded-full" /></TableCell>
                            <TableCell className="pr-6"><div className="h-8 w-16 bg-slate-100 animate-pulse rounded ml-auto" /></TableCell>
                          </TableRow>
                        ))
                      ) : transporters.length === 0 ? (
                        <TableRow><TableCell colSpan={7} className="text-center py-20 text-slate-400">No transporters found</TableCell></TableRow>
                      ) : (
                        <>
                          {sortedTransporters.map(item => (
                            <TableRow key={item.id} className="hover:bg-slate-50/30 transition-colors border-b border-slate-50 h-16">
                              <TableCell className="font-medium pl-6">{item.transport_master_id}</TableCell>
                              <TableCell className="font-semibold text-slate-900">{item.transporter_name}</TableCell>
                              <TableCell className="text-slate-600">{item.contact_person || "—"}</TableCell>
                              <TableCell>
                                <div className="text-xs">
                                  <p className="font-medium text-slate-700">{item.contact_number || "—"}</p>
                                  <p className="text-slate-400">{item.email_id || "—"}</p>
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="text-[10px] space-y-1">
                                  {item.pan && <div className="flex items-center gap-1"><span className="text-slate-400 uppercase">PAN:</span> <span className="font-bold">{item.pan}</span></div>}
                                  {item.gstin && <div className="flex items-center gap-1"><span className="text-slate-400 uppercase">GST:</span> <span className="font-bold">{item.gstin}</span></div>}
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge variant={item.status === 'Active' ? 'default' : 'secondary'} className={item.status === 'Active' ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border-none' : ''}>
                                  {item.status}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right pr-6">
                                <div className="flex justify-end gap-2">
                                  <Button variant="ghost" size="icon" onClick={() => openEditDialog(item)} className="h-8 w-8 text-blue-600 hover:bg-blue-50" disabled={isReadOnly} title={isReadOnly ? "View Only Access" : "Edit Transporter"}>
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <Button variant="ghost" size="icon" onClick={() => { setDeletingItem(item); setIsDeleteDialogOpen(true); }} className="h-8 w-8 text-destructive hover:bg-red-50" disabled={isReadOnly} title={isReadOnly ? "View Only Access" : "Delete Transporter"}>
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                          {/* Infinite Scroll Sentinel */}
                          <TableRow ref={driverEndRef}>
                            <TableCell colSpan={7} className="p-0 h-12 border-none">
                              {isFetchingNextTransport && (
                                <div className="flex items-center justify-center py-4 text-slate-400 bg-slate-50/20">
                                  <div className="flex gap-1.5 items-center bg-white px-4 py-1.5 rounded-full shadow-sm border border-slate-100">
                                    <div className="h-1.5 w-1.5 bg-primary animate-bounce [animation-delay:-0.3s]"></div>
                                    <div className="h-1.5 w-1.5 bg-primary animate-bounce [animation-delay:-0.15s]"></div>
                                    <div className="h-1.5 w-1.5 bg-primary animate-bounce"></div>
                                    <span className="text-xs font-medium ml-2 text-slate-500">Loading more transporters...</span>
                                  </div>
                                </div>
                              )}
                            </TableCell>
                          </TableRow>
                        </>
                      )}
                    </TableBody>
                  </table>
                </div>
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
