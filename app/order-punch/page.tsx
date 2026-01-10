"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import type React from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Save, FileUp, Plus, Trash2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

type ProductItem = {
  id: string
  productName: string
  uom: string
  orderQty: string
  altUom: string
  altQty: string
}

type PreApprovalProduct = {
  id: string
  oilType: string
  ratePerLtr: string
  rateLtr: string // Used for Rate per 15KG
}

type OrderData = {
  customerType: string
  depoName: string
  isBrokerOrder: string
  orderPurpose: string
  orderType: string
  advancePaymentTaken: string
  soNumber: string
  soDate: string
  customerName: string
  contactPerson: string
  whatsappNo: string
  customerAddress: string
  deliveryAddress: string
  oilType: string
  rateLtr: string
  brokerName: string
  deliveryDate: string
  startDate: string
  endDate: string
  paymentTerms: string
  transportType: string
  advanceAmount: string
  products: ProductItem[]
  preApprovalProducts?: PreApprovalProduct[]
  doNumber?: string
}

// Mock customer data for auto-fill
const MOCK_CUSTOMERS: Record<string, { contactPerson: string; whatsappNo: string; address: string }> = {
  cust1: {
    contactPerson: "Jane Doe",
    whatsappNo: "+91 9876543210",
    address: "123 Industrial Area, Sector 5, Mumbai",
  },
  cust2: {
    contactPerson: "John Smith",
    whatsappNo: "+91 9876543211",
    address: "456 Tech Park, Phase 2, Pune",
  },
  cust3: {
    contactPerson: "Alice Johnson",
    whatsappNo: "+91 9876543212",
    address: "789 Commerce Zone, Hyderabad",
  },
}

export default function OrderPunchPage() {
  const { toast } = useToast()
  const router = useRouter()

  const [products, setProducts] = useState<ProductItem[]>([
    { id: "1", productName: "", uom: "", orderQty: "", altUom: "", altQty: "" },
  ])
  const [customerType, setCustomerType] = useState<string>("")
  const [depoName, setDepoName] = useState<string>("")
  const [isBrokerOrder, setIsBrokerOrder] = useState<string>("NO")
  const [orderPurpose, setOrderPurpose] = useState<string>("")
  const [orderType, setOrderType] = useState<string>("")
  const [advancePaymentTaken, setAdvancePaymentTaken] = useState<string>("NO")
  const [soNumber, setSoNumber] = useState<string>("")
  const [soDate, setSoDate] = useState<string>("")
  const [customerName, setCustomerName] = useState<string>("")
  const [contactPerson, setContactPerson] = useState<string>("")
  const [whatsappNo, setWhatsappNo] = useState<string>("")
  const [customerAddress, setCustomerAddress] = useState<string>("")
  const [deliveryAddress, setDeliveryAddress] = useState<string>("")
  const [sameAsCustomerAddress, setSameAsCustomerAddress] = useState<boolean>(false)
  
  // Pre-Approval Products State
  const [preApprovalProducts, setPreApprovalProducts] = useState<PreApprovalProduct[]>([
    { id: "1", oilType: "", ratePerLtr: "", rateLtr: "" },
  ])

  // Legacy/Single states (kept if needed for compatibility, but mainly using the list now)
  const [oilType, setOilType] = useState<string>("")
  const [rateLtr, setRateLtr] = useState<string>("")
  
  const [brokerName, setBrokerName] = useState<string>("")
  const [deliveryDate, setDeliveryDate] = useState<string>("") // Now acts as Actual Delivery Date
  const [startDate, setStartDate] = useState<string>("")
  const [endDate, setEndDate] = useState<string>("")
  const [paymentTerms, setPaymentTerms] = useState<string>("")
  const [transportType, setTransportType] = useState<string>("")
  const [advanceAmount, setAdvanceAmount] = useState<string>("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Auto-fill SO Number on mount
  useEffect(() => {
    // Basic logic to simulate SO Number generation
    const lastSO = localStorage.getItem("lastSOSequence") || "0"
    const nextSO = parseInt(lastSO) + 1
    // Ideally we won't increment until save, but for display we show next potential
    setSoNumber(`SO-${String(nextSO).padStart(3, "0")}`)
  }, [])

  useEffect(() => {
    const savedData = localStorage.getItem("orderData")
    if (savedData) {
      const data: OrderData = JSON.parse(savedData)
      setCustomerType(data.customerType)
      setDepoName(data.depoName || "")
      setIsBrokerOrder(data.isBrokerOrder)
      setOrderPurpose(data.orderPurpose)
      setOrderType(data.orderType)
      setAdvancePaymentTaken(data.advancePaymentTaken)
      // setSoNumber(data.soNumber) // Keep auto-generated for new punches unless editing logic is added
      setSoDate(data.soDate)
      setCustomerName(data.customerName)
      setContactPerson(data.contactPerson)
      setWhatsappNo(data.whatsappNo)
      setCustomerAddress(data.customerAddress)
      setDeliveryAddress(data.deliveryAddress || "")
      setOilType(data.oilType)
      setRateLtr(data.rateLtr)
      setBrokerName(data.brokerName)
      setDeliveryDate(data.deliveryDate)
      setStartDate(data.startDate || "")
      setEndDate(data.endDate || "")
      setPaymentTerms(data.paymentTerms)
      setTransportType(data.transportType)
      setAdvanceAmount(data.advanceAmount)
       if (data.products.length > 0) {
        setProducts(data.products)
      }
      if (data.preApprovalProducts && data.preApprovalProducts.length > 0) {
        setPreApprovalProducts(data.preApprovalProducts)
      } else if (data.oilType || data.rateLtr) {
        // Fallback for migrated data
         setPreApprovalProducts([{ 
           id: "1", 
           oilType: data.oilType, 
           ratePerLtr: "",
           rateLtr: data.rateLtr, 
          }])
      }
    }
  }, [])

  // Customer Auto-fill Effect
  useEffect(() => {
    if (customerType === "existing" && customerName && MOCK_CUSTOMERS[customerName]) {
      const data = MOCK_CUSTOMERS[customerName]
      setContactPerson(data.contactPerson)
      setWhatsappNo(data.whatsappNo)
      setCustomerAddress(data.address)
    }
  }, [customerName, customerType])

  // Week on Week Date Logic
  useEffect(() => {
    if (orderPurpose === "week-on-week") {
      if (!startDate) {
        setStartDate(new Date().toISOString().split("T")[0])
      }
    } else {
      // clear dates if not week-on-week? or keep them
      // keeping them is fine, but maybe hide fields
    }
  }, [orderPurpose])

  useEffect(() => {
    if (startDate) {
      const start = new Date(startDate)
      const end = new Date(start)
      end.setDate(start.getDate() + 7)
      setEndDate(end.toISOString().split("T")[0])
    }
  }, [startDate])

  // Same as Customer Address Logic
  useEffect(() => {
    if (sameAsCustomerAddress) {
      setDeliveryAddress(customerAddress)
    } else if (deliveryAddress === customerAddress && customerAddress !== "") {
        // Optional: clear if unchecked? No, usually keep it but editable.
    }
  }, [sameAsCustomerAddress, customerAddress])

  const generateDONumber = () => {
    const lastSequence = parseInt(localStorage.getItem("lastODSequence") || "0", 10)
    const newSequence = lastSequence + 1
    const doNumber = `DO-${String(newSequence).padStart(3, "0")}`
    localStorage.setItem("lastODSequence", newSequence.toString())
    return doNumber
  }

  const saveToLocalStorage = () => {
    const doNumber = generateDONumber()
    
    // Update SO Sequence
    const currentSOSeq = parseInt(soNumber.split("-")[1] || "0", 10)
    const lastStored = parseInt(localStorage.getItem("lastSOSequence") || "0", 10)
    if (currentSOSeq > lastStored) {
       localStorage.setItem("lastSOSequence", currentSOSeq.toString())
    }

    const orderData: OrderData = {
      doNumber,
      customerType,
      depoName,
      isBrokerOrder,
      orderPurpose,
      orderType,
      advancePaymentTaken,
      soNumber,
      soDate,
      customerName,
      contactPerson,
      whatsappNo,
      customerAddress,
      deliveryAddress,
      oilType,
      rateLtr,
      brokerName,
      deliveryDate,
      startDate,
      endDate,
      paymentTerms,
      transportType,
      advanceAmount,
      products,
      preApprovalProducts,
    }
    localStorage.setItem("orderData", JSON.stringify(orderData))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validate based on Order Type
    if (orderType === "pre-approval") {
      if (preApprovalProducts.some(p => !p.oilType || !p.rateLtr || !p.ratePerLtr)) {
         toast({
          title: "Validation Error",
          description: "Please fill in all Pre-Approval product details (Oil Type, Rate Per Ltr and Rate Per 15KG).",
          variant: "destructive",
        })
        return
      }
    } else {
      // Regular or default handling
      if (depoName && products.some((p) => !p.productName)) {
        toast({
          title: "Validation Error",
          description: "Please fill in product details for all rows.",
          variant: "destructive",
        })
        return
      }
    }

    if (!orderType) {
      toast({
        title: "Validation Error",
        description: "Please select an order type.",
        variant: "destructive",
      })
      return
    }

    setIsSubmitting(true)

    try {
      // Generate common order object from form state
      const commonOrderData = {
          doNumber: generateDONumber(),
          customerType,
          depoName,
          isBrokerOrder,
          orderPurpose,
          orderType,
          advancePaymentTaken,
          soNumber,
          soDate,
          customerName,
          contactPerson,
          whatsappNo,
          customerAddress,
          deliveryAddress,
          oilType,
          rateLtr,
          brokerName,
          deliveryDate,
          startDate,
          endDate,
          paymentTerms,
          transportType,
          advanceAmount,
          products: products.map(p => ({
             ...p,
             uom: p.uom || "Ltr",
             altUom: p.altUom || "Kg"
          })),
          preApprovalProducts
      }

      // Update SO Sequence logic (moved from saveToLocalStorage to be more explicit here or keep generic helper if prefered, but local function is fine)
      const currentSOSeq = parseInt(soNumber.split("-")[1] || "0", 10)
      const lastStored = parseInt(localStorage.getItem("lastSOSequence") || "0", 10)
      if (currentSOSeq > lastStored) {
          localStorage.setItem("lastSOSequence", currentSOSeq.toString())
      }

      // Save logic based on type
      if (orderType === "regular") {
        const orderData = {
           ...commonOrderData,
           stage: "Approval Of Order",
           status: "Pending",
        }

        // Save History
        const savedHistory = localStorage.getItem("workflowHistory")
        const history = savedHistory ? JSON.parse(savedHistory) : []
        history.push({
           ...orderData,
           timestamp: new Date().toISOString()
        })
        localStorage.setItem("workflowHistory", JSON.stringify(history))
        
        // Save current data and setup for Approval Page (Commitment/Approval)
        localStorage.setItem("orderData", JSON.stringify(orderData))
        
        // Legacy support if Approval Page uses commitmentReviewData
        localStorage.setItem("commitmentReviewData", JSON.stringify({ orderData }))

        toast({
          title: "Order Saved Successfully",
          description: "Order has been created and moved to Approval Of Order stage.",
        })
        resetForm()
        setTimeout(() => {
          router.push("/approval-of-order")
        }, 1500)

      } else if (orderType === "pre-approval") {
        const orderData = {
           ...commonOrderData,
           stage: "Pre-Approval",
           status: "Pending",
        }

        const savedHistory = localStorage.getItem("workflowHistory")
        const history = savedHistory ? JSON.parse(savedHistory) : []
        history.push({
           ...orderData,
           timestamp: new Date().toISOString()
        })
        localStorage.setItem("workflowHistory", JSON.stringify(history))
        localStorage.setItem("orderData", JSON.stringify(orderData))

        toast({
          title: "Order Saved Successfully",
          description: "Order has been created and moved to Pre-Approval stage.",
        })
        resetForm()
        setTimeout(() => {
          router.push("/pre-approval")
        }, 1500)
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const addProduct = () => {
    setProducts([
      ...products,
      { id: Math.random().toString(36).substr(2, 9), productName: "", uom: "", orderQty: "", altUom: "", altQty: "" },
    ])
  }

  const removeProduct = (id: string) => {
    if (products.length > 1) {
      setProducts(products.filter((p) => p.id !== id))
    }
  }

  const updateProduct = (id: string, field: keyof ProductItem, value: string) => {
    setProducts((prevProducts) => 
      prevProducts.map((p) => {
        if (p.id !== id) return p;
        return { ...p, [field]: value };
      })
    );
  }

  // Pre-Approval Product Helpers
  const addPreApprovalProduct = () => {
    setPreApprovalProducts([
      ...preApprovalProducts,
      { 
        id: Math.random().toString(36).substr(2, 9), 
        oilType: "", 
        ratePerLtr: "", 
        rateLtr: "", 
      },
    ])
  }

  const removePreApprovalProduct = (id: string) => {
    if (preApprovalProducts.length > 1) {
      setPreApprovalProducts(preApprovalProducts.filter((p) => p.id !== id))
    }
  }

  const updatePreApprovalProduct = (id: string, field: keyof PreApprovalProduct, value: string) => {
    setPreApprovalProducts((prevProducts) => 
      prevProducts.map((p) => {
        if (p.id !== id) return p;
        return { ...p, [field]: value };
      })
    );
  }

  const resetForm = () => {
    setCustomerType("")
    setDepoName("")
    setIsBrokerOrder("NO")
    setOrderPurpose("")
    setOrderType("")
    setAdvancePaymentTaken("NO")
    setSoDate("")
    setCustomerName("")
    setContactPerson("")
    setWhatsappNo("")
    setCustomerAddress("")
    setDeliveryAddress("")
    setSameAsCustomerAddress(false)
    setOilType("")
    setRateLtr("")
    setBrokerName("")
    setDeliveryDate("")
    setStartDate("")
    setEndDate("")
    setPaymentTerms("")
    setTransportType("")
    setAdvanceAmount("")
    setProducts([{ id: Math.random().toString(36).substr(2, 9), productName: "", uom: "", orderQty: "", altUom: "", altQty: "" }])
    setPreApprovalProducts([{ id: Math.random().toString(36).substr(2, 9), oilType: "", ratePerLtr: "", rateLtr: "" }])
    
    // Simulate next SO Number
    const lastSO = localStorage.getItem("lastSOSequence") || "0"
    const nextSO = parseInt(lastSO) + 1
    setSoNumber(`SO-${String(nextSO).padStart(3, "0")}`)
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Stage 1: Order Punch</h1>
          <p className="text-muted-foreground">Create a new order with customer and product details.</p>
        </div>
        <Button variant="outline" className="gap-2 bg-transparent">
          <FileUp className="h-4 w-4" /> Import
        </Button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Order Information</CardTitle>
            <CardDescription>Enter all order and customer details below.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* SO Number - Reordered to Top */}
              <div className="space-y-2">
                <Label htmlFor="soNumber">SO Number</Label>
                <Input
                  id="soNumber"
                  placeholder="SO Number"
                  value={soNumber}
                  readOnly // Auto-filled
                  className="bg-muted"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="soDate">SO Date</Label>
                <Input id="soDate" type="date" value={soDate} onChange={(e) => setSoDate(e.target.value)} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="orderPurpose">ORDER TYPE (DELIVERY PURPOSE)</Label>
                <Select value={orderPurpose} onValueChange={setOrderPurpose}>
                  <SelectTrigger id="orderPurpose">
                    <SelectValue placeholder="Select purpose" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="week-on-week">Week On Week</SelectItem>
                    <SelectItem value="future-period">Future Period</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="orderType">ORDER TYPE</Label>
                <Select value={orderType} onValueChange={setOrderType}>
                  <SelectTrigger id="orderType">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="regular">Regular</SelectItem>
                    <SelectItem value="pre-approval">Pre-Approval</SelectItem>
                  </SelectContent>
                </Select>
                {orderType === "regular" && (
                  <p className="text-xs text-blue-600 mt-1">
                    ℹ️ Regular orders will skip Pre-Approval and go directly to Approval Of Order
                  </p>
                )}
              </div>

              {/* Week On Week Fields */}
              {orderPurpose === "week-on-week" && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="startDate">Start Date</Label>
                    <Input
                      id="startDate"
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="endDate">End Date</Label>
                    <Input
                      id="endDate"
                      type="date"
                      value={endDate}
                      readOnly
                      className="bg-muted"
                    />
                  </div>
                  {/* Moved Actual Delivery Date Here */}
                  <div className="space-y-2">
                    <Label htmlFor="deliveryDate">Actual Delivery Date</Label>
                     <Input
                      id="deliveryDate"
                      type="date"
                      value={deliveryDate}
                      onChange={(e) => setDeliveryDate(e.target.value)}
                    />
                  </div>
                   {/* Spacer if needed for grid alignment */}
                   <div className="hidden md:block"></div> 
                </>
              )}

              <div className="space-y-2">
                <Label htmlFor="customerType">Customer Type</Label>
                <Select value={customerType} onValueChange={setCustomerType}>
                  <SelectTrigger id="customerType">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new">New Customer</SelectItem>
                    <SelectItem value="existing">Existing Customer</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="customerName">Customer Name</Label>
                {customerType === "existing" ? (
                  <Select value={customerName} onValueChange={setCustomerName}>
                    <SelectTrigger id="customerName">
                      <SelectValue placeholder="Select existing customer" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cust1">Acme Corp</SelectItem>
                      <SelectItem value="cust2">Global Industries</SelectItem>
                      <SelectItem value="cust3">Zenith Supply</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    id="customerName"
                    placeholder="Enter customer name"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                  />
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="contactPerson">Customer Contact Person Name</Label>
                <Input
                  id="contactPerson"
                  placeholder="Enter name"
                  value={contactPerson}
                  onChange={(e) => setContactPerson(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="whatsappNo">Customer Contact Person WhatsApp No.</Label>
                <Input
                  id="whatsappNo"
                  placeholder="Enter WhatsApp number"
                  value={whatsappNo}
                  onChange={(e) => setWhatsappNo(e.target.value)}
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="customerAddress">Customer Address</Label>
                <Input
                  id="customerAddress"
                  placeholder="Enter full address"
                  value={customerAddress}
                  onChange={(e) => setCustomerAddress(e.target.value)}
                />
              </div>

              {/* Delivery Address Section */}
              <div className="space-y-2 md:col-span-2">
                <div className="flex items-center space-x-2 mb-2">
                   <Checkbox 
                      id="sameAsCustomer" 
                      checked={sameAsCustomerAddress}
                      onCheckedChange={(checked) => setSameAsCustomerAddress(checked as boolean)}
                   />
                   <Label htmlFor="sameAsCustomer" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                      Same as Customer Address
                   </Label>
                </div>
                <Label htmlFor="deliveryAddress">Delivery Address</Label>
                <Input
                  id="deliveryAddress"
                  placeholder="Enter delivery address"
                  value={deliveryAddress}
                  onChange={(e) => setDeliveryAddress(e.target.value)}
                  readOnly={sameAsCustomerAddress}
                  className={sameAsCustomerAddress ? "bg-muted" : ""}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="depoName">Depo Name</Label>
                <Select value={depoName} onValueChange={setDepoName}>
                  <SelectTrigger id="depoName">
                    <SelectValue placeholder="Select Depo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Depo A">Depo A</SelectItem>
                    <SelectItem value="Depo B">Depo B</SelectItem>
                    <SelectItem value="Depo C">Depo C</SelectItem>
                    <SelectItem value="Depo D">Depo D</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="advancePayment">Advance Payment to Be Taken</Label>
                <Select value={advancePaymentTaken} onValueChange={setAdvancePaymentTaken}>
                  <SelectTrigger id="advancePayment">
                    <SelectValue placeholder="Select YES/NO" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NO">NO</SelectItem>
                    <SelectItem value="YES">YES</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {advancePaymentTaken === "YES" && (
                <div className="space-y-2">
                  <Label htmlFor="advanceAmount">Advance Amount</Label>
                  <Input
                    id="advanceAmount"
                    type="number"
                    placeholder="0.00"
                    value={advanceAmount}
                    onChange={(e) => setAdvanceAmount(e.target.value)}
                  />
                </div>
              )}

              {/* Product List Logic - Conditional Rendering */}
              {orderType === "pre-approval" && (
                <div className="md:col-span-2 space-y-4 p-4 bg-muted/50 rounded-lg border">
                 <div className="flex justify-between items-center">
                    <Label className="text-lg font-semibold">Pre-Approval Products</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addPreApprovalProduct}
                      className="gap-2 bg-transparent"
                    >
                      <Plus className="h-4 w-4" /> Add Product
                    </Button>
                  </div>
                  
                  <div className="space-y-4">
                    {preApprovalProducts.map((item) => (
                      <div key={item.id} className="flex gap-4 items-center p-4 border rounded-lg bg-card">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 flex-1">
                          
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Oil Type</Label>
                            <Select 
                              value={item.oilType} 
                              onValueChange={(val) => updatePreApprovalProduct(item.id, "oilType", val)}
                            >
                              <SelectTrigger className="bg-background h-9">
                                <SelectValue placeholder="Select Type" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Rice Bran Oil">Rice Bran Oil</SelectItem>
                                <SelectItem value="Soyabeen Oil">Soyabeen Oil</SelectItem>
                                <SelectItem value="Palm Oil">Palm Oil</SelectItem>
                                <SelectItem value="Mustard Oil">Mustard Oil</SelectItem>
                                <SelectItem value="Sunflower Oil">Sunflower Oil</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-1">
                             <Label className="text-xs text-muted-foreground">Rate Per Ltr</Label>
                             <Input
                              type="number"
                              placeholder="0.00"
                              value={item.ratePerLtr}
                              onChange={(e) => updatePreApprovalProduct(item.id, "ratePerLtr", e.target.value)}
                              className="bg-background h-9"
                            />
                          </div>

                          <div className="space-y-1">
                             <Label className="text-xs text-muted-foreground">Rate Per 15KG</Label>
                             <Input
                              type="number"
                              placeholder="0.00"
                              value={item.rateLtr}
                              onChange={(e) => updatePreApprovalProduct(item.id, "rateLtr", e.target.value)}
                              className="bg-background h-9"
                            />
                          </div>

                        </div>

                        {/* Action - Delete */}
                        <div className="flex-none">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removePreApprovalProduct(item.id)}
                            disabled={preApprovalProducts.length === 1}
                            className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8 w-8"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>

                      </div>
                    ))}
                  </div>
                </div>
              )}
              {orderType === "regular" && (
                  <div className="md:col-span-2 space-y-4 p-4 bg-muted/50 rounded-lg border">
                    <div className="flex justify-between items-center">
                      <Label className="text-lg font-semibold">Product List</Label>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={addProduct}
                        className="gap-2 bg-transparent"
                      >
                        <Plus className="h-4 w-4" /> Add Product
                      </Button>
                    </div>
                  <div className="space-y-4">
                    {products.map((product) => (
                      <div key={product.id} className="flex gap-4 items-center p-4 border rounded-lg bg-card">
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 flex-1">
                          
                          <div className="space-y-1">
                             <Label className="text-xs text-muted-foreground">Product Name</Label>
                             <Input
                              value={product.productName}
                              onChange={(e) => updateProduct(product.id, "productName", e.target.value)}
                              placeholder="Product name"
                              className="bg-background h-9"
                            />
                          </div>

                          <div className="space-y-1">
                             <Label className="text-xs text-muted-foreground">UOM</Label>
                             <Input
                              value={product.uom}
                              onChange={(e) => updateProduct(product.id, "uom", e.target.value)}
                              placeholder="UOM"
                              className="bg-background h-9"
                            />
                          </div>

                          <div className="space-y-1">
                             <Label className="text-xs text-muted-foreground">Order Qty</Label>
                             <Input
                              type="number"
                              value={product.orderQty}
                              onChange={(e) => updateProduct(product.id, "orderQty", e.target.value)}
                              placeholder="0"
                              className="bg-background h-9"
                            />
                          </div>

                          <div className="space-y-1">
                             <Label className="text-xs text-muted-foreground">Alt UOM</Label>
                             <Input
                              value={product.altUom}
                              onChange={(e) => updateProduct(product.id, "altUom", e.target.value)}
                              placeholder="Alt UOM"
                              className="bg-background h-9"
                            />
                          </div>

                          <div className="space-y-1">
                             <Label className="text-xs text-muted-foreground">Alt Qty (Kg)</Label>
                             <Input
                              type="number"
                              value={product.altQty}
                              onChange={(e) => updateProduct(product.id, "altQty", e.target.value)}
                              placeholder="0"
                              className="bg-background h-9"
                            />
                          </div>
                          
                        </div>

                        {/* Action - Delete */}
                        <div className="flex-none">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeProduct(product.id)}
                            disabled={products.length === 1}
                            className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8 w-8"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Legacy Oil Type View - removed for now as confusing with Depo logic
                  If needed, it can be restored. */}

              <div className="space-y-2">
                <Label htmlFor="isBroker">Is This Order Through Broker</Label>
                <Select value={isBrokerOrder} onValueChange={setIsBrokerOrder}>
                  <SelectTrigger id="isBroker">
                    <SelectValue placeholder="Select YES/NO" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NO">NO</SelectItem>
                    <SelectItem value="YES">YES</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {isBrokerOrder === "YES" && (
                <div className="space-y-2">
                  <Label htmlFor="brokerName">Broker Name (IF ORDER THROUGH BROKER)</Label>
                  <Input
                    id="brokerName"
                    placeholder="Enter broker name"
                    value={brokerName}
                    onChange={(e) => setBrokerName(e.target.value)}
                  />
                </div>
              )}

              {/* Delivery Date is now conditional or moved, lets add Expected Delivery Date down here if NOT week-on-week as fallback? 
                  The prompt says: "Actual Delivery Date ... jo ki abhi Form me hai Expected Delivery Date hai usko upr lao or jb Start date, end ddate enable hoga mtlb Week on Week dropdown se select krenege tb wo bhi show krega."
                  This implies it ONLY shows then? Or if not week-on-week, does it show as Expected?
                  Usually regular orders still need a delivery date. I will leave it here as "Expected Delivery Date" for non-week-on-week cases to be safe, or just hide it if that's what "usko upr lao" meant (move entirely).
                  "usko upr lao" (bring it up). I brought it up.
                  "or jb Start date... enable hoga... tb wo bhi show krega" (and when start date is enable, it will also show).
                  This might mean it should ONLY be visible then? Or it should be visible generally? 
                  Most likely, regular orders still need a delivery date. 
                  I will conditionally render it:
                  If Week-on-Week: It's shown above as 'Actual Delivery Date'.
                  If NOT Week-on-Week: It should probably still stay as 'Expected Delivery Date'.
              */}
              {orderPurpose !== "week-on-week" && (
                <div className="space-y-2">
                  <Label htmlFor="deliveryDate">Expected Delivery Date</Label>
                  <Input
                    id="deliveryDate"
                    type="date"
                    value={deliveryDate}
                    onChange={(e) => setDeliveryDate(e.target.value)}
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="paymentTerms">Payment Terms</Label>
                <Select value={paymentTerms} onValueChange={setPaymentTerms}>
                  <SelectTrigger id="paymentTerms">
                    <SelectValue placeholder="Select terms" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="advance">Advance</SelectItem>
                    <SelectItem value="7days">7 Days After Delivery</SelectItem>
                    <SelectItem value="delivery">On Delivery</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="transportType">Transport Type</Label>
                <Select value={transportType} onValueChange={setTransportType}>
                  <SelectTrigger id="transportType">
                    <SelectValue placeholder="Select transport" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="self">Self</SelectItem>
                    <SelectItem value="others">Others</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="soFile">Upload SO Copy</Label>
                <Input id="soFile" type="file" className="cursor-pointer" />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-4">
          <Button variant="ghost" type="button" disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" className="gap-2 px-8" disabled={isSubmitting}>
            <Save className="h-4 w-4" /> {isSubmitting ? "Saving..." : "Save Order"}
          </Button>
        </div>
      </form>
    </div>
  )
}
