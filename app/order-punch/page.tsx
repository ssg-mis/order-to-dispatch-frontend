"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import type React from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
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

type OrderData = {
  customerType: string
  itemConfirm: string
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
  oilType: string
  rateLtr: string
  rateMaterial: string
  totalWithGst: string
  brokerName: string
  deliveryDate: string
  paymentTerms: string
  transportType: string
  advanceAmount: string
  products: ProductItem[]
  doNumber?: string
}

export default function OrderPunchPage() {
  const { toast } = useToast()
  const router = useRouter()

  const [products, setProducts] = useState<ProductItem[]>([
    { id: "1", productName: "", uom: "", orderQty: "", altUom: "", altQty: "" },
  ])
  const [customerType, setCustomerType] = useState<string>("")
  const [itemConfirm, setItemConfirm] = useState<string>("")
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
  const [oilType, setOilType] = useState<string>("")
  const [rateLtr, setRateLtr] = useState<string>("")
  const [rateMaterial, setRateMaterial] = useState<string>("")
  const [totalWithGst, setTotalWithGst] = useState<string>("")
  const [brokerName, setBrokerName] = useState<string>("")
  const [deliveryDate, setDeliveryDate] = useState<string>("")
  const [paymentTerms, setPaymentTerms] = useState<string>("")
  const [transportType, setTransportType] = useState<string>("")
  const [advanceAmount, setAdvanceAmount] = useState<string>("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    const savedData = localStorage.getItem("orderData")
    if (savedData) {
      const data: OrderData = JSON.parse(savedData)
      setCustomerType(data.customerType)
      setItemConfirm(data.itemConfirm)
      setIsBrokerOrder(data.isBrokerOrder)
      setOrderPurpose(data.orderPurpose)
      setOrderType(data.orderType)
      setAdvancePaymentTaken(data.advancePaymentTaken)
      setSoNumber(data.soNumber)
      setSoDate(data.soDate)
      setCustomerName(data.customerName)
      setContactPerson(data.contactPerson)
      setWhatsappNo(data.whatsappNo)
      setCustomerAddress(data.customerAddress)
      setOilType(data.oilType)
      setRateLtr(data.rateLtr)
      setRateMaterial(data.rateMaterial)
      setTotalWithGst(data.totalWithGst)
      setBrokerName(data.brokerName)
      setDeliveryDate(data.deliveryDate)
      setPaymentTerms(data.paymentTerms)
      setTransportType(data.transportType)
      setAdvanceAmount(data.advanceAmount)
      if (data.products.length > 0) {
        setProducts(data.products)
      }
    }
  }, [])

  const generateDONumber = () => {
    const lastSequence = parseInt(localStorage.getItem("lastODSequence") || "0", 10)
    const newSequence = lastSequence + 1
    const doNumber = `DO-${String(newSequence).padStart(3, "0")}A`
    localStorage.setItem("lastODSequence", newSequence.toString())
    return doNumber
  }

  const saveToLocalStorage = () => {
    // Check if we already have a DO Number for this session (unlikely unless editing, but safety check)
    // Actually, for a new punch, we always want a new one if it's a fresh submission. 
    // But since this calls on submit, we generate it here.

    // NOTE: In a real app, we might check if 'orderData' already has one to avoid regenerating on re-save.
    // For this simple flow, we'll assume a new submit = new order.

    // However, to prevent double generation on double click, we could check if we just generated one?
    // Let's stick to generating it right before saving.
    const doNumber = generateDONumber()

    const orderData: OrderData = {
      doNumber, // Add the generated number
      customerType,
      itemConfirm,
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
      oilType,
      rateLtr,
      rateMaterial,
      totalWithGst,
      brokerName,
      deliveryDate,
      paymentTerms,
      transportType,
      advanceAmount,
      products,
    }
    localStorage.setItem("orderData", JSON.stringify(orderData))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (itemConfirm === "yes" && products.some((p) => !p.productName)) {
      toast({
        title: "Validation Error",
        description: "Please fill in product details for all rows.",
        variant: "destructive",
      })
      return
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
      saveToLocalStorage()

      if (orderType === "regular") {
        toast({
          title: "Order Saved Successfully",
          description: "Order has been created and moved to Commitment Review stage.",
        })
        setTimeout(() => {
          router.push("/commitment-review")
        }, 1500)
      } else if (orderType === "pre-approval") {
        toast({
          title: "Order Saved Successfully",
          description: "Order has been created and moved to Pre-Approval stage.",
        })
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
    setProducts(products.map((p) => (p.id === id ? { ...p, [field]: value } : p)))
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
                    ℹ️ Regular orders will skip Pre-Approval and go directly to Commitment Review
                  </p>
                )}
              </div>

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

              <div className="space-y-2">
                <Label htmlFor="soNumber">SO Number</Label>
                <Input
                  id="soNumber"
                  placeholder="Enter SO Number"
                  value={soNumber}
                  onChange={(e) => setSoNumber(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="soDate">SO Date</Label>
                <Input id="soDate" type="date" value={soDate} onChange={(e) => setSoDate(e.target.value)} />
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

              <div className="space-y-2">
                <Label htmlFor="itemConfirm">Item Confirm</Label>
                <Select value={itemConfirm} onValueChange={setItemConfirm}>
                  <SelectTrigger id="itemConfirm">
                    <SelectValue placeholder="Select Yes/No" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="yes">YES</SelectItem>
                    <SelectItem value="no">NO</SelectItem>
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

              {itemConfirm === "yes" && (
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
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Product Name</TableHead>
                          <TableHead className="w-24">UOM</TableHead>
                          <TableHead className="w-28">Order Qty</TableHead>
                          <TableHead className="w-24">Alt UOM</TableHead>
                          <TableHead className="w-32">Alt Qty (Kg)</TableHead>
                          <TableHead className="w-12"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {products.map((product) => (
                          <TableRow key={product.id}>
                            <TableCell>
                              <Input
                                value={product.productName}
                                onChange={(e) => updateProduct(product.id, "productName", e.target.value)}
                                placeholder="Product name"
                                className="bg-background"
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                value={product.uom}
                                onChange={(e) => updateProduct(product.id, "uom", e.target.value)}
                                placeholder="UOM"
                                className="bg-background"
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                value={product.orderQty}
                                onChange={(e) => updateProduct(product.id, "orderQty", e.target.value)}
                                placeholder="0"
                                className="bg-background"
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                value={product.altUom}
                                onChange={(e) => updateProduct(product.id, "altUom", e.target.value)}
                                placeholder="Alt UOM"
                                className="bg-background"
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                value={product.altQty}
                                onChange={(e) => updateProduct(product.id, "altQty", e.target.value)}
                                placeholder="0"
                                className="bg-background"
                              />
                            </TableCell>
                            <TableCell>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => removeProduct(product.id)}
                                disabled={products.length === 1}
                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              {itemConfirm === "no" && (
                <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4 bg-muted/50 rounded-lg">
                  <div className="space-y-2">
                    <Label htmlFor="oilType">Oil Type</Label>
                    <Select value={oilType} onValueChange={setOilType}>
                      <SelectTrigger id="oilType">
                        <SelectValue placeholder="Select Oil" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="rice-bran">Rice Bran Oil</SelectItem>
                        <SelectItem value="soyabean">Soyabean Oil</SelectItem>
                        <SelectItem value="palm">Palm Oil</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="rateLtr">Rate Per Ltr</Label>
                    <Input
                      id="rateLtr"
                      type="number"
                      placeholder="0.00"
                      value={rateLtr}
                      onChange={(e) => setRateLtr(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="rateMaterial">Rate Of Material</Label>
                    <Input
                      id="rateMaterial"
                      type="number"
                      placeholder="0.00"
                      value={rateMaterial}
                      onChange={(e) => setRateMaterial(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="totalWithGst">Total Amount With Gst</Label>
                    <Input
                      id="totalWithGst"
                      type="number"
                      placeholder="0.00"
                      value={totalWithGst}
                      onChange={(e) => setTotalWithGst(e.target.value)}
                    />
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

              <div className="space-y-2">
                <Label htmlFor="deliveryDate">Expected Delivery Date</Label>
                <Input
                  id="deliveryDate"
                  type="date"
                  value={deliveryDate}
                  onChange={(e) => setDeliveryDate(e.target.value)}
                />
              </div>

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
