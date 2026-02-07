"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import type React from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Save, FileUp, Plus, Trash2, CalendarIcon } from "lucide-react"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { useToast } from "@/hooks/use-toast"
import { customerApi, depotApi, skuApi, brokerApi, orderApi } from "@/lib/api-service"
import { Combobox } from "@/components/ui/combobox"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type ProductItem = {
  id: string
  productName: string
  uom: string
  orderQty: string
  altUom: string
  altQty: string
  rate: string
  ratePer15Kg: string
  ratePerLtr: string
  oilType: string
}

type PreApprovalProduct = {
  id: string
  oilType: string
  ratePer15Kg: string
  ratePerLtr: string
}

export default function OrderPunchPage() {
  const { toast } = useToast()
  const router = useRouter()

  // New state for customers
  const [customers, setCustomers] = useState<any[]>([])
  const [isLoadingCustomers, setIsLoadingCustomers] = useState(false)

  // New state for depots
  const [depots, setDepots] = useState<any[]>([])
  const [isLoadingDepots, setIsLoadingDepots] = useState(false)

  // New state for SKUs
  const [skus, setSkus] = useState<any[]>([])
  const [isLoadingSkus, setIsLoadingSkus] = useState(false)

  // New state for Brokers
  const [brokers, setBrokers] = useState<any[]>([])
  const [isLoadingBrokers, setIsLoadingBrokers] = useState(false)

  // Function to fetch customers - declared before useEffect
  const fetchCustomers = async () => {
    try {
      setIsLoadingCustomers(true)
      const response = await customerApi.getAll()
      if (response.success) {
        setCustomers(response.data)
      }
    } catch (error) {
      console.error("Failed to fetch customers:", error)
      toast({
        title: "Error",
        description: "Failed to load customer list",
        variant: "destructive",
      })
    } finally {
      setIsLoadingCustomers(false)
    }
  }

  // Function to fetch depots
  const fetchDepots = async () => {
    try {
      setIsLoadingDepots(true)
      const response = await depotApi.getAll()
      if (response.success) {
        setDepots(response.data)
      }
    } catch (error) {
      console.error("Failed to fetch depots:", error)
      toast({
        title: "Error",
        description: "Failed to load depot list",
        variant: "destructive",
      })
    } finally {
      setIsLoadingDepots(false)
    }
  }

  // Function to fetch SKUs
  const fetchSkus = async () => {
    try {
      setIsLoadingSkus(true)
      const response = await skuApi.getAll()
      if (response.success) {
        setSkus(response.data)
      }
    } catch (error) {
      console.error("Failed to fetch SKUs:", error)
      toast({
        title: "Error",
        description: "Failed to load product list",
        variant: "destructive",
      })
    } finally {
      setIsLoadingSkus(false)
    }
  }

  // Function to fetch Brokers
  const fetchBrokers = async () => {
    try {
      setIsLoadingBrokers(true)
      const response = await brokerApi.getAll()
      if (response.success) {
        setBrokers(response.data)
      }
    } catch (error) {
      console.error("Failed to fetch brokers:", error)
      toast({
        title: "Error",
        description: "Failed to load broker list",
        variant: "destructive",
      })
    } finally {
      setIsLoadingBrokers(false)
    }
  }

  const [products, setProducts] = useState<ProductItem[]>([
    { id: "1", productName: "", uom: "", orderQty: "", altUom: "", altQty: "", rate: "", ratePer15Kg: "", ratePerLtr: "", oilType: "" },
  ])
  const [customerType, setCustomerType] = useState<string>("existing")
  const [depoName, setDepoName] = useState<string>("Banari")
  const [isBrokerOrder, setIsBrokerOrder] = useState<string>("YES")
  const [orderPurpose, setOrderPurpose] = useState<string>("week-on-week")
  const [orderType, setOrderType] = useState<string>("regular")
  const [advancePaymentTaken, setAdvancePaymentTaken] = useState<string>("NO")
  // Set DO Date to today's date by default
  const [soDate, setSoDate] = useState<string>(new Date().toISOString().split("T")[0])
  const [customerName, setCustomerName] = useState<string>("")
  const [contactPerson, setContactPerson] = useState<string>("")
  const [whatsappNo, setWhatsappNo] = useState<string>("")
  const [customerAddress, setCustomerAddress] = useState<string>("")
  const [deliveryAddress, setDeliveryAddress] = useState<string>("")
  const [sameAsCustomerAddress, setSameAsCustomerAddress] = useState<boolean>(true)
  
  // Pre-Approval Products State
  const [preApprovalProducts, setPreApprovalProducts] = useState<PreApprovalProduct[]>([])

  // Current Pre-Approval Input State
  const [currentPreApproval, setCurrentPreApproval] = useState({
    oilType: "Palm Oil",
    ratePer15Kg: "",
    ratePerLtr: ""
  })
  
  const [brokerName, setBrokerName] = useState<string>("Ashish Motwani")
  const [deliveryDate, setDeliveryDate] = useState<string>("")
  const [deliveryDateError, setDeliveryDateError] = useState<string>("")
  const [startDate, setStartDate] = useState<string>("")
  const [endDate, setEndDate] = useState<string>("")
  const [paymentTerms, setPaymentTerms] = useState<string>("7days")
  const [transportType, setTransportType] = useState<string>("self")
  const [advanceAmount, setAdvanceAmount] = useState<string>("")
  const [futurePeriodDate, setFuturePeriodDate] = useState<string>("") // New state for future period date
  const [orderPunchRemarks, setOrderPunchRemarks] = useState<string>("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDeliveryDatePickerOpen, setIsDeliveryDatePickerOpen] = useState(false)
  const [isFuturePeriodDatePickerOpen, setIsFuturePeriodDatePickerOpen] = useState(false)

  // Fetch customers, depots, SKUs, and brokers on mount
  useEffect(() => {
    fetchCustomers()
    fetchDepots()
    fetchSkus()
    fetchBrokers()
  }, [])

  // Customer Auto-fill Effect
  useEffect(() => {
    if (customerType === "existing" && customerName) {
      // Find customer in the fetched list
      const selectedCustomer = customers.find(c => c.customer_name === customerName)
      
      if (selectedCustomer) {
        setContactPerson(selectedCustomer.contact_person || "")
        setWhatsappNo(selectedCustomer.contact || "") // Using 'contact' field for WhatsApp
        
        // Construct full address
        const parts = [
          selectedCustomer.address_line_1,
          selectedCustomer.address_line_2,
          selectedCustomer.state,
          selectedCustomer.pincode
        ].filter(Boolean)
        
        setCustomerAddress(parts.join(", "))
      }
    }
  }, [customerName, customerType, customers])

  // Week on Week / Future Period Date Logic - Initialize Start Date from DO Date
  useEffect(() => {
    if (orderPurpose === "week-on-week" || orderPurpose === "future-period") {
      // If DO Date (soDate) is set, use it as Start Date; otherwise use today
      if (soDate) {
        setStartDate(soDate)
      } else if (!startDate) {
        setStartDate(new Date().toISOString().split("T")[0])
      }
    }
  }, [orderPurpose, soDate])

  useEffect(() => {
    if (startDate) {
      const start = new Date(startDate)
      const end = new Date(start)
      end.setDate(start.getDate() + 7)
      setEndDate(end.toISOString().split("T")[0])
    }
  }, [startDate])

  // Validate Actual Delivery Date is within Start Date to End Date range
  useEffect(() => {
    if (deliveryDate && startDate && endDate && orderPurpose === "week-on-week") {
      const delivery = new Date(deliveryDate)
      const start = new Date(startDate)
      const end = new Date(endDate)
      
      if (delivery < start || delivery > end) {
        setDeliveryDateError(`You selected a date not between the start and end date (${startDate} to ${endDate})`)
      } else {
        setDeliveryDateError("")
      }
    } else {
      setDeliveryDateError("")
    }
  }, [deliveryDate, startDate, endDate, orderPurpose])

  // Same as Customer Address Logic
  useEffect(() => {
    if (sameAsCustomerAddress) {
      setDeliveryAddress(customerAddress)
    }
  }, [sameAsCustomerAddress, customerAddress])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validate based on Order Type
    if (orderType === "regular" || orderType === "pre-approval") {
      // For regular and pre-approval, validate products
      if (depoName && products.some((p) => !p.productName)) {
        toast({
          title: "Validation Error",
          description: "Please fill in product details for all rows.",
          variant: "destructive",
        })
        return
      }
    }

    // Validate dates based on orderPurpose
    if (orderPurpose === "future-period" || orderPurpose === "week-on-week") {
      if (!startDate) {
        toast({
          title: "Validation Error",
          description: "Please select a start date.",
          variant: "destructive",
        })
        return
      }
      
      if (orderPurpose === "week-on-week" && !deliveryDate) {
        toast({
          title: "Validation Error",
          description: "Please select an actual delivery date.",
          variant: "destructive",
        })
        return
      }
      
      if (orderPurpose === "future-period" && !futurePeriodDate) {
        toast({
          title: "Validation Error",
          description: "Please select a future period date.",
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
      // Prepare data for backend API
      const customerNameValue = customerName
      
      // Prepare common order data
      const orderData: any = {
        customer_name: customerNameValue,
        order_type: orderType,
        customer_type: customerType,
        order_type_delivery_purpose: orderPurpose,
        start_date: startDate || null,
        end_date: endDate || null,
        delivery_date: deliveryDate || null,
        party_so_date: soDate || null,
        customer_contact_person_name: contactPerson || null,
        customer_contact_person_whatsapp_no: whatsappNo || null,
        customer_address: customerAddress || null,
        depo_name: depoName || null,
        payment_terms: paymentTerms || null,
        advance_payment_to_be_taken: advancePaymentTaken === "YES",
        advance_amount: advanceAmount ? parseFloat(advanceAmount) : null,
        is_order_through_broker: isBrokerOrder === "YES",
        broker_name: brokerName || null,
        type_of_transporting: transportType || null,
        order_punch_remarks: orderPunchRemarks || null,
        remark: null,
        futureperioddate: futurePeriodDate || null, // Add future period date
      }

      // Add products array for backend (for regular and pre-approval order types)
      if ((orderType === "regular" || orderType === "pre-approval") && products.length > 0) {
        orderData.products = products.map(p => {
          let rate15kg = p.ratePer15Kg ? parseFloat(p.ratePer15Kg) : null
          let rateLtr = p.ratePerLtr ? parseFloat(p.ratePerLtr) : null
          let oilTypeVal = ""

          // For pre-approval, pick from the preApprovalProducts list based on detected oil type
          if (orderType === "pre-approval") {
            const productNameLower = (p.productName || "").toLowerCase()
            let matchedRate = null
            
            // Robust auto-detection of oil type from product name
            if (productNameLower.includes("palm") || productNameLower.includes("p.o.") || productNameLower.includes(" po ")) {
              oilTypeVal = "Palm Oil"
            } else if (productNameLower.includes("rice") || productNameLower.includes("r.o.") || productNameLower.includes(" ro ") || productNameLower.includes("rbo")) {
              oilTypeVal = "Rice Oil"
            } else if (productNameLower.includes("soya") || productNameLower.includes("s.o.") || productNameLower.includes(" so ") || productNameLower.includes("sbo")) {
              oilTypeVal = "Soya Oil"
            }

            if (oilTypeVal) {
              matchedRate = preApprovalProducts.find(pap => pap.oilType.toLowerCase() === oilTypeVal.toLowerCase())
            }

            if (matchedRate) {
              rate15kg = matchedRate.ratePer15Kg ? parseFloat(matchedRate.ratePer15Kg) : rate15kg
              rateLtr = matchedRate.ratePerLtr ? parseFloat(matchedRate.ratePerLtr) : rateLtr
            }
          }

          return {
            product_name: p.productName,
            uom: p.uom || "Ltr",
            order_quantity: p.orderQty ? parseFloat(p.orderQty) : null,
            rate_of_material: p.rate ? parseFloat(p.rate) : null,
            rate_per_15kg: rate15kg,
            rate_per_ltr: rateLtr,
            oil_type: oilTypeVal,
            alternate_uom: p.altUom || "Kg",
            alternate_qty_kg: p.altQty ? parseFloat(p.altQty) : null,
          }
        })
      }

      // Call backend API
      const response = await orderApi.create(orderData)

      if (response.success) {
        const backendOrderNo = response.data.order_no

        // Prepare order entry for localStorage (for compatibility in existing workflow)
        const orderEntry = {
          doNumber: backendOrderNo, // Use backend-generated order number
          customerType,
          depoName,
          isBrokerOrder,
          orderPurpose,
          orderType: orderType as "regular" | "pre-approval",
          advancePaymentTaken,
          soNumber: backendOrderNo, // Use generated order number
          soDate,
          customerName: customerNameValue,
          contactPerson,
          whatsappNo,
          customerAddress,
          deliveryAddress,
          brokerName,
          deliveryDate,
          startDate,
          endDate,
          paymentTerms,
          transportType,
          orderPunchRemarks,
          advanceAmount,
          products: products.map(p => ({
             ...p,
             uom: p.uom || "Ltr",
             altUom: p.altUom || "Kg"
          })),
          preApprovalProducts,
          stage: orderType === "regular" ? "Approval Of Order" : "Pre-Approval",
          status: "Pending" as const,
          timestamp: new Date().toISOString()
        }

        // Save workflow history
        const { saveWorkflowHistory } = await import('@/lib/storage-utils')
        saveWorkflowHistory(orderEntry)
        
        // Keep legacy keys for compatibility
        localStorage.setItem("orderData", JSON.stringify(orderEntry))
        if (orderType === "regular") {
            localStorage.setItem("commitmentReviewData", JSON.stringify({ orderData: orderEntry }))
        }

        // Show success message with prominently displayed order number
        toast({
            title: "✅ Order Created Successfully!",
            description: `Order Number: ${backendOrderNo}`,
            duration: 5000,
        })
        
        // Show additional alert for emphasis
        alert(`Order created successfully!\n\nOrder Number: ${backendOrderNo}\n\nThis order has been saved to the database.`)
        
        resetForm()
        
        setTimeout(() => {
            router.push(orderType === "regular" ? "/approval-of-order" : "/pre-approval")
        }, 1500)
      }

    } catch (error: any) {
      console.error('Error submitting order:', error)
      
      let errorMessage = error.message || "Failed to save order to database. Please try again."
      
      if (errorMessage.includes("too long for type character varying")) {
        errorMessage = "One or more fields exceed maximum length. Check: WhatsApp number (max 20 chars), Payment Terms, Transport Type."
      }
      
      toast({
        title: "Error Saving Order",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const addProduct = () => {
    setProducts([
      ...products,
      { id: Math.random().toString(36).substr(2, 9), productName: "", uom: "", orderQty: "", altUom: "", altQty: "", rate: "", ratePer15Kg: "", ratePerLtr: "", oilType: "" },
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

  // Handle product selection and auto-fill UOM fields
  const handleProductSelect = (productId: string, skuName: string) => {
    const selectedSku = skus.find((sku) => sku.sku_name === skuName)
    
    if (selectedSku) {
      setProducts((prevProducts) => 
        prevProducts.map((p) => {
          if (p.id !== productId) return p;
          return {
            ...p,
            productName: selectedSku.sku_name,
            uom: selectedSku.main_uom || "",
            altUom: selectedSku.alternate_uom || "",
          };
        })
      );
    } else {
      // If no SKU found, just update the product name
      updateProduct(productId, "productName", skuName)
    }
  }

  // Pre-Approval Product Helpers
  const addPreApprovalProduct = () => {
    if (!currentPreApproval.ratePer15Kg && !currentPreApproval.ratePerLtr) {
      toast({
        title: "Validation Error",
        description: "Please enter at least one rate (15 KG or 1 LTR).",
        variant: "destructive",
      })
      return
    }

    // Row Limit: maximum 3 items
    if (preApprovalProducts.length >= 3) {
      toast({
        title: "Limit Reached",
        description: "You can add a maximum of 3 oil types (Palm, Rice, and Soya Oil).",
        variant: "destructive",
      })
      return
    }

    // Duplicate Check: ensure same oil type isn't added twice
    if (preApprovalProducts.some(p => p.oilType === currentPreApproval.oilType)) {
      toast({
        title: "Duplicate Entry",
        description: "Rates for this oil type have already been added. Select a different oil type or edit the existing row.",
        variant: "destructive",
      })
      return
    }

    setPreApprovalProducts([
      ...preApprovalProducts,
      { 
        id: Math.random().toString(36).substr(2, 9), 
        oilType: currentPreApproval.oilType, 
        ratePer15Kg: currentPreApproval.ratePer15Kg, 
        ratePerLtr: currentPreApproval.ratePerLtr, 
      },
    ])
    
    // Reset current input
    setCurrentPreApproval({
      ...currentPreApproval,
      ratePer15Kg: "",
      ratePerLtr: ""
    })
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
    setCustomerType("existing")
    setDepoName("Banari")
    setIsBrokerOrder("YES")
    setOrderPurpose("week-on-week")
    setOrderType("regular")
    setAdvancePaymentTaken("NO")
    setSoDate(new Date().toISOString().split("T")[0])
    setCustomerName("")
    setContactPerson("")
    setWhatsappNo("")
    setCustomerAddress("")
    setDeliveryAddress("")
    setSameAsCustomerAddress(true)
    setPreApprovalProducts([])
    setCurrentPreApproval({
      oilType: "Palm Oil",
      ratePer15Kg: "",
      ratePerLtr: ""
    })
    setBrokerName("Ashish Motwani")
    setDeliveryDate("")
    setStartDate("")
    setEndDate("")
    setPaymentTerms("7days")
    setTransportType("self")
    setAdvanceAmount("")
    setFuturePeriodDate("")
    setOrderPunchRemarks("")
    setProducts([{ id: Math.random().toString(36).substr(2, 9), productName: "", uom: "", orderQty: "", altUom: "", altQty: "", rate: "", ratePer15Kg: "", ratePerLtr: "", oilType: "" }])
  }

  return (
    <div className="p-6 max-w-full space-y-6" suppressHydrationWarning>
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <SidebarTrigger className="-ml-1" />
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Stage 1: Order Punch</h1>
            <p className="text-muted-foreground">Create a new order with customer and product details.</p>
          </div>
        </div>
        {/* <Button variant="outline" className="gap-2 bg-transparent">
          <FileUp className="h-4 w-4" /> Import
        </Button> */}
      </div>

      <form onSubmit={handleSubmit} className="space-y-6" suppressHydrationWarning>
        <Card>
          <CardHeader>
            <CardTitle>Order Information</CardTitle>
            <CardDescription>Enter all order and customer details below.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="soDate">DO Date</Label>
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

              {(orderPurpose === "week-on-week" || orderPurpose === "future-period") && (
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
                  {(orderPurpose === "week-on-week" || orderPurpose === "future-period") && (
                    <div className="space-y-2">
                      <Label htmlFor="deliveryDate">Actual Delivery Date</Label>
                      <Popover open={isDeliveryDatePickerOpen} onOpenChange={setIsDeliveryDatePickerOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal",
                              !deliveryDate && "text-muted-foreground",
                              deliveryDateError && "border-red-500"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {deliveryDate ? format(new Date(deliveryDate), "PPP") : <span>Pick a date</span>}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={deliveryDate ? new Date(deliveryDate) : undefined}
                            onSelect={(date) => {
                              if (date) {
                                setDeliveryDate(format(date, "yyyy-MM-dd"))
                                setIsDeliveryDatePickerOpen(false)
                              }
                            }}
                            initialFocus
                            modifiers={{
                              inRange: (date) => {
                                if (!startDate || !endDate) return false
                                const start = new Date(startDate)
                                const end = new Date(endDate)
                                return date >= start && date <= end
                              }
                            }}
                            modifiersClassNames={{
                              inRange: "bg-blue-100 text-blue-900 hover:bg-blue-200"
                            }}
                          />
                        </PopoverContent>
                      </Popover>
                      {deliveryDateError && (
                        <p className="text-xs text-red-600 font-medium">{deliveryDateError}</p>
                      )}
                    </div>
                  )}

                  {orderPurpose === "future-period" && (
                    <div className="space-y-2">
                      <Label htmlFor="futurePeriodDate">Future Period Date</Label>
                      <Popover open={isFuturePeriodDatePickerOpen} onOpenChange={setIsFuturePeriodDatePickerOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal",
                              !futurePeriodDate && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {futurePeriodDate ? format(new Date(futurePeriodDate), "PPP") : <span>Pick a date</span>}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={futurePeriodDate ? new Date(futurePeriodDate) : undefined}
                            onSelect={(date) => {
                              if (date) {
                                setFuturePeriodDate(format(date, "yyyy-MM-dd"))
                                setIsFuturePeriodDatePickerOpen(false)
                              }
                            }}
                            initialFocus
                            modifiers={{
                              inRange: (date) => {
                                if (!startDate || !endDate) return false
                                const start = new Date(startDate)
                                const end = new Date(endDate)
                                return date >= start && date <= end
                              }
                            }}
                            modifiersClassNames={{
                              inRange: "bg-blue-100 text-blue-900 hover:bg-blue-200"
                            }}
                          />
                        </PopoverContent>
                      </Popover>
                      <p className="text-xs text-blue-600 mt-1">
                        ℹ️ This date will be saved for future period delivery
                      </p>
                    </div>
                  )}
                  <div className="hidden md:block"></div> 
                </>
              )}

              {/* Note for Pre-Approval Orders */}
              {orderType === "pre-approval" && (orderPurpose === "week-on-week" || orderPurpose === "future-period") && (
                <div className="md:col-span-2 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-sm font-semibold text-amber-800 flex items-center gap-2">
                    <span className="text-lg">⚠️</span>
                    15 KG and 1 Ltr rate is compulsory for Pre-Approval orders
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="customerType">Customer Type</Label>
                <Select value={customerType} onValueChange={setCustomerType}>
                  <SelectTrigger id="customerType">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="existing">Existing Customer</SelectItem>
                    <SelectItem value="new">New Customer</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="customerName">Customer Name</Label>
                {customerType === "existing" ? (
                  <Combobox
                    options={customers
                      .filter(c => c && c.customer_name) // Filter invalid customers
                      .map((customer) => ({
                        value: customer.customer_name,
                        label: customer.customer_name
                      }))}
                    value={customerName}
                    onValueChange={setCustomerName}
                    placeholder={isLoadingCustomers ? "Loading customers..." : "Select existing customer"}
                    searchPlaceholder="Search customers..."
                    emptyText="No customer found."
                    disabled={isLoadingCustomers}
                  />
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
                <Select value={depoName} onValueChange={setDepoName} disabled={isLoadingDepots}>
                  <SelectTrigger id="depoName">
                    <SelectValue placeholder={isLoadingDepots ? "Loading depots..." : "Select Depo"} />
                  </SelectTrigger>
                  <SelectContent>
                    {depots
                      .filter(d => d && d.depot_id && d.depot_name) // Filter invalid depots
                      .map((depot) => (
                      <SelectItem key={depot.depot_id} value={depot.depot_name}>
                        {depot.depot_name}
                      </SelectItem>
                    ))}
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

              {/* Pre-Approval Rates Section */}
              {orderType === "pre-approval" && (
                <div className="md:col-span-2 space-y-4 p-4 bg-blue-50/50 rounded-lg border border-blue-100">
                  <div className="flex flex-col space-y-1">
                    <Label className="text-lg font-semibold text-blue-900">Pre-Approval Rates</Label>
                    <p className="text-sm text-blue-600">Add 15 KG and 1 LTR rates for different oil types.</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end bg-white p-4 rounded-md shadow-sm border border-blue-100">
                    <div className="space-y-2">
                      <Label htmlFor="currentOilType">Oil Type</Label>
                      <Select 
                        value={currentPreApproval.oilType} 
                        onValueChange={(val) => setCurrentPreApproval(prev => ({ ...prev, oilType: val }))}
                      >
                        <SelectTrigger id="currentOilType">
                          <SelectValue placeholder="Select Oil" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Palm Oil">Palm Oil</SelectItem>
                          <SelectItem value="Rice Oil">Rice Oil</SelectItem>
                          <SelectItem value="Soya Oil">Soya Oil</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="currentRate15Kg">15 KG Rate</Label>
                      <Input
                        id="currentRate15Kg"
                        type="number"
                        value={currentPreApproval.ratePer15Kg}
                        onChange={(e) => setCurrentPreApproval(prev => ({ ...prev, ratePer15Kg: e.target.value }))}
                        placeholder="0.00"
                        className="font-semibold text-green-600"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="currentRateLtr">1 LTR Rate</Label>
                      <Input
                        id="currentRateLtr"
                        type="number"
                        value={currentPreApproval.ratePerLtr}
                        onChange={(e) => setCurrentPreApproval(prev => ({ ...prev, ratePerLtr: e.target.value }))}
                        placeholder="0.00"
                        className="font-semibold text-blue-600"
                      />
                    </div>
                    <Button 
                      type="button" 
                      onClick={addPreApprovalProduct}
                      className="bg-blue-600 hover:bg-blue-700 text-white font-medium"
                    >
                      <Plus className="h-4 w-4 mr-2" /> Add to List
                    </Button>
                  </div>

                  {preApprovalProducts.length > 0 && (
                    <div className="overflow-hidden rounded-md border border-blue-100 bg-white">
                      <Table>
                        <TableHeader className="bg-blue-50/50">
                          <TableRow>
                            <TableHead className="font-bold text-blue-900 text-xs uppercase tracking-wider">Oil Type</TableHead>
                            <TableHead className="font-bold text-blue-900 text-xs uppercase tracking-wider">15 KG Rate</TableHead>
                            <TableHead className="font-bold text-blue-900 text-xs uppercase tracking-wider">1 LTR Rate</TableHead>
                            <TableHead className="w-[50px]"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {preApprovalProducts.map((p) => (
                            <TableRow key={p.id} className="hover:bg-blue-50/30">
                              <TableCell className="font-medium py-2">{p.oilType}</TableCell>
                              <TableCell className="font-semibold text-green-600 py-2">₹{p.ratePer15Kg || "0.00"}</TableCell>
                              <TableCell className="font-semibold text-blue-600 py-2">₹{p.ratePerLtr || "0.00"}</TableCell>
                              <TableCell className="py-2 text-right">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => removePreApprovalProduct(p.id)}
                                  className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              )}

              {/* Show Product List for both regular and pre-approval */}
              {(orderType === "regular" || orderType === "pre-approval") && (
                <div className="md:col-span-2 space-y-4 p-4 bg-muted/50 rounded-lg border">
                  <div className="flex justify-between items-center">
                    <Label className="text-lg font-semibold">Product List</Label>
                  </div>
                  <div className="space-y-4">
                    {products.map((product, idx) => (
                      <div key={product.id} className="flex gap-4 items-end p-4 border rounded-lg bg-card shadow-sm relative pt-8">
                         <div className="absolute top-2 left-4 text-[10px] font-bold text-blue-500/80 bg-blue-50 px-2 py-0.5 rounded border border-blue-100 uppercase tracking-widest">
                             Product {idx + 1}
                         </div>
                         <div className="grid grid-cols-2 gap-4 flex-1 md:grid-cols-11">
                          <div className={`space-y-1.5 col-span-2 md:col-span-6`}>
                             <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Product Name</Label>
                             <Combobox
                               options={skus
                                 .filter(s => s && s.sku_name) // Filter invalid SKUs
                                 .filter(s => {
                                   // Dynamic Filter: Only show products matching the oil types in the Pre-Approval Rates list
                                   if (orderType !== "pre-approval" || preApprovalProducts.length === 0) return true;
                                   
                                   const skuNameLower = s.sku_name.toLowerCase();
                                   return preApprovalProducts.some(pap => {
                                     const oilType = pap.oilType.toLowerCase();
                                     if (oilType.includes("palm")) return skuNameLower.includes("palm") || skuNameLower.includes("p.o.");
                                     if (oilType.includes("rice")) return skuNameLower.includes("rice") || skuNameLower.includes("r.o.") || skuNameLower.includes("rbo");
                                     if (oilType.includes("soya")) return skuNameLower.includes("soya") || skuNameLower.includes("s.o.") || skuNameLower.includes("sbo");
                                     return false;
                                   });
                                 })
                                 .filter(s => !products.some(p => p.productName === s.sku_name && p.id !== product.id)) // Filter already selected products
                                 .map((sku) => ({
                                   value: sku.sku_name,
                                   label: sku.sku_name
                                 }))}
                               value={product.productName}
                               onValueChange={(val) => handleProductSelect(product.id, val)}
                               placeholder={isLoadingSkus ? "Loading..." : "Select product"}
                               searchPlaceholder="Search products..."
                               emptyText="No product found."
                               disabled={isLoadingSkus}
                               className="h-10"
                             />
                          </div>

                          <div className="space-y-1.5 col-span-1 md:col-span-2">
                             <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">UOM</Label>
                             <Input
                               value={product.uom}
                               onChange={(e) => updateProduct(product.id, "uom", e.target.value)}
                               placeholder="UOM"
                               className="h-10 border-slate-200 focus:border-blue-400 focus:ring-blue-400 bg-muted"
                               readOnly
                             />
                          </div>

                          <div className="space-y-1.5 col-span-1 md:col-span-2">
                             <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Order Qty</Label>
                             <Input
                               type="number"
                               value={product.orderQty}
                               onChange={(e) => updateProduct(product.id, "orderQty", e.target.value)}
                               placeholder="0"
                               className="bg-background h-10 border-slate-200 focus:border-blue-400 focus:ring-blue-400"
                             />
                          </div>
                      
                          {/* Rate field for both types, but auto-filled for Pre-Approval */}
                          <div className="space-y-1.5 col-span-2 md:col-span-1">
                             <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider truncate">Rate</Label>
                             <Input
                               type="number"
                               value={product.rate}
                               onChange={(e) => updateProduct(product.id, "rate", e.target.value)}
                               placeholder="0.00"
                               className="bg-background h-10 border-slate-200 focus:border-blue-400 focus:ring-blue-400 font-semibold text-blue-600"
                             />
                          </div>


                          
                        </div>

                        <div className="flex-none mb-1 pt-6">
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
                    <div className="flex justify-end pt-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={addProduct}
                        className="gap-2 bg-white hover:bg-blue-50 text-blue-600 border-blue-200 shadow-sm"
                      >
                        <Plus className="h-4 w-4" /> Add Product
                      </Button>
                    </div>
                  </div>
                </div>
              )}

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
                  <Combobox
                    options={brokers
                      .filter(b => b && b.salesman_name) // Filter invalid brokers
                      .map((broker) => ({
                        value: broker.salesman_name,
                        label: broker.salesman_name
                      }))}
                    value={brokerName}
                    onValueChange={setBrokerName}
                    placeholder={isLoadingBrokers ? "Loading brokers..." : "Select broker"}
                    searchPlaceholder="Search brokers..."
                    emptyText="No broker found."
                    disabled={isLoadingBrokers}
                  />
                </div>
              )}

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
                    <SelectItem value="self">FOR</SelectItem>
                    <SelectItem value="others">EX-Depot</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="soFile">Upload SO Copy</Label>
                <Input id="soFile" type="file" className="cursor-pointer" />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="orderPunchRemarks">Remarks</Label>
                <Textarea 
                  id="orderPunchRemarks" 
                  placeholder="Enter any additional remarks here..." 
                  value={orderPunchRemarks}
                  onChange={(e) => setOrderPunchRemarks(e.target.value)}
                  className="min-h-[100px]"
                />
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
