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
import { SidebarTrigger } from "@/components/ui/sidebar"
import { useToast } from "@/hooks/use-toast"
import { customerApi } from "@/lib/api-service"

type ProductItem = {
  id: string
  productName: string
  uom: string
  orderQty: string
  altUom: string
  altQty: string
  rate: string
}

type PreApprovalProduct = {
  id: string
  oilType: string
  ratePerLtr: string
  rateLtr: string // Used for Rate per 15KG
}

export default function OrderPunchPage() {
  const { toast } = useToast()
  const router = useRouter()

  // New state for customers
  const [customers, setCustomers] = useState<any[]>([])
  const [isLoadingCustomers, setIsLoadingCustomers] = useState(false)

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

  const [products, setProducts] = useState<ProductItem[]>([
    { id: "1", productName: "", uom: "", orderQty: "", altUom: "", altQty: "", rate: "" },
  ])
  const [customerType, setCustomerType] = useState<string>("")
  const [depoName, setDepoName] = useState<string>("")
  const [isBrokerOrder, setIsBrokerOrder] = useState<string>("NO")
  const [orderPurpose, setOrderPurpose] = useState<string>("")
  const [orderType, setOrderType] = useState<string>("")
  const [advancePaymentTaken, setAdvancePaymentTaken] = useState<string>("NO")
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

  // Legacy/Single states
  const [oilType, setOilType] = useState<string>("")
  const [rateLtr, setRateLtr] = useState<string>("")
  
  const [brokerName, setBrokerName] = useState<string>("")
  const [deliveryDate, setDeliveryDate] = useState<string>("")
  const [startDate, setStartDate] = useState<string>("")
  const [endDate, setEndDate] = useState<string>("")
  const [paymentTerms, setPaymentTerms] = useState<string>("")
  const [transportType, setTransportType] = useState<string>("")
  const [advanceAmount, setAdvanceAmount] = useState<string>("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Fetch customers on mount
  useEffect(() => {
    fetchCustomers()
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

  // Week on Week Date Logic
  useEffect(() => {
    if (orderPurpose === "week-on-week") {
      if (!startDate) {
        setStartDate(new Date().toISOString().split("T")[0])
      }
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
    }
  }, [sameAsCustomerAddress, customerAddress])

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
        payment_terms: paymentTerms || null,
        advance_payment_to_be_taken: advancePaymentTaken === "YES",
        advance_amount: advanceAmount ? parseFloat(advanceAmount) : null,
        is_order_through_broker: isBrokerOrder === "YES",
        broker_name: brokerName || null,
        type_of_transporting: transportType || null,
        remark: null,
      }

      // Add products array for backend
      if (orderType === "regular" && products.length > 0) {
        orderData.products = products.map(p => ({
          product_name: p.productName,
          uom: p.uom || "Ltr",
          order_quantity: p.orderQty ? parseFloat(p.orderQty) : null,
          rate_of_material: p.rate ? parseFloat(p.rate) : null,
          alternate_uom: p.altUom || "Kg",
          alternate_qty_kg: p.altQty ? parseFloat(p.altQty) : null,
        }))
      } else if (orderType === "pre-approval" && preApprovalProducts.length > 0) {
        orderData.products = preApprovalProducts.map(p => ({
          product_name: p.oilType, // Using oil type as product name for pre-approval
          oil_type: p.oilType,
          rate_per_ltr: p.ratePerLtr ? parseFloat(p.ratePerLtr) : null,
          rate_per_15kg: p.rateLtr ? parseFloat(p.rateLtr) : null,
        }))
      }

      // Import API service
      const { orderApi } = await import('@/lib/api-service')
      
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
          orderType,
          advancePaymentTaken,
          soNumber: backendOrderNo, // Use generated order number
          soDate,
          customerName: customerNameValue,
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
          preApprovalProducts,
          stage: orderType === "regular" ? "Approval Of Order" : "Pre-Approval",
          status: "Pending" as const,
          timestamp: new Date().toISOString(),
          orderType: orderType as "regular" | "pre-approval"
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
      toast({
        title: "Error Saving Order",
        description: error.message || "Failed to save order to database. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const addProduct = () => {
    setProducts([
      ...products,
      { id: Math.random().toString(36).substr(2, 9), productName: "", uom: "", orderQty: "", altUom: "", altQty: "", rate: "" },
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
    setProducts([{ id: Math.random().toString(36).substr(2, 9), productName: "", uom: "", orderQty: "", altUom: "", altQty: "", rate: "" }])
    setPreApprovalProducts([{ id: Math.random().toString(36).substr(2, 9), oilType: "", ratePerLtr: "", rateLtr: "" }])
  }

  return (
    <div className="p-6 max-w-full space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <SidebarTrigger className="-ml-1" />
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Stage 1: Order Punch</h1>
            <p className="text-muted-foreground">Create a new order with customer and product details.</p>
          </div>
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
                  <div className="space-y-2">
                    <Label htmlFor="deliveryDate">Actual Delivery Date</Label>
                     <Input
                      id="deliveryDate"
                      type="date"
                      value={deliveryDate}
                      onChange={(e) => setDeliveryDate(e.target.value)}
                    />
                  </div>
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
                  <Select value={customerName} onValueChange={setCustomerName} disabled={isLoadingCustomers}>
                    <SelectTrigger id="customerName">
                      <SelectValue placeholder={isLoadingCustomers ? "Loading customers..." : "Select existing customer"} />
                    </SelectTrigger>
                    <SelectContent>
                      {customers.map((customer) => (
                        <SelectItem key={customer.id} value={customer.customer_name}>
                          {customer.customer_name}
                        </SelectItem>
                      ))}
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
                    {preApprovalProducts.map((item, idx) => (
                      <div key={item.id} className="flex gap-4 items-center p-4 border rounded-lg bg-card relative pt-8">
                         <div className="absolute top-2 left-4 text-[10px] font-bold text-blue-500/80 bg-blue-50 px-2 py-0.5 rounded border border-blue-100 uppercase tracking-widest">
                             Requirement {idx + 1}
                         </div>
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
                    {products.map((product, idx) => (
                      <div key={product.id} className="flex gap-4 items-end p-4 border rounded-lg bg-card shadow-sm relative pt-8">
                         <div className="absolute top-2 left-4 text-[10px] font-bold text-blue-500/80 bg-blue-50 px-2 py-0.5 rounded border border-blue-100 uppercase tracking-widest">
                             Product {idx + 1}
                         </div>
                        <div className="grid grid-cols-1 md:grid-cols-6 gap-4 flex-1">
                          
                          <div className="space-y-1.5 flex-1">
                             <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Product Name</Label>
                             <Input
                               value={product.productName}
                               onChange={(e) => updateProduct(product.id, "productName", e.target.value)}
                               placeholder="Product name"
                               className="bg-background h-10 border-slate-200 focus:border-blue-400 focus:ring-blue-400"
                             />
                          </div>

                          <div className="space-y-1.5 flex-1">
                             <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">UOM</Label>
                             <Input
                               value={product.uom}
                               onChange={(e) => updateProduct(product.id, "uom", e.target.value)}
                               placeholder="UOM"
                               className="bg-background h-10 border-slate-200 focus:border-blue-400 focus:ring-blue-400"
                             />
                          </div>

                          <div className="space-y-1.5 flex-1">
                             <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Order Qty</Label>
                             <Input
                               type="number"
                               value={product.orderQty}
                               onChange={(e) => updateProduct(product.id, "orderQty", e.target.value)}
                               placeholder="0"
                               className="bg-background h-10 border-slate-200 focus:border-blue-400 focus:ring-blue-400"
                             />
                          </div>

                          <div className="space-y-1.5 flex-1">
                             <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Rate Of Material</Label>
                             <Input
                               type="number"
                               value={product.rate}
                               onChange={(e) => updateProduct(product.id, "rate", e.target.value)}
                               placeholder="0.00"
                               className="bg-background h-10 border-slate-200 focus:border-blue-400 focus:ring-blue-400 font-semibold text-blue-600"
                             />
                          </div>

                          <div className="space-y-1.5 flex-1">
                             <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Alt UOM</Label>
                             <Input
                               value={product.altUom}
                               onChange={(e) => updateProduct(product.id, "altUom", e.target.value)}
                               placeholder="Alt UOM"
                               className="bg-background h-10 border-slate-200 focus:border-blue-400 focus:ring-blue-400"
                             />
                          </div>

                          <div className="space-y-1.5 flex-1">
                             <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Alt Qty (Kg)</Label>
                             <Input
                               type="number"
                               value={product.altQty}
                               onChange={(e) => updateProduct(product.id, "altQty", e.target.value)}
                               placeholder="0"
                               className="bg-background h-10 border-slate-200 focus:border-blue-400 focus:ring-blue-400"
                             />
                          </div>
                          
                        </div>

                        <div className="flex-none mb-1">
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
