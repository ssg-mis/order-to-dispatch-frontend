"use client"

import { Suspense, useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Search, Filter, Download, Eye } from "lucide-react"
import { Input } from "@/components/ui/input"

function HistoryContent() {
  const router = useRouter()
  const [historyLogs, setHistoryLogs] = useState<any[]>([])
  const [searchTerm, setSearchTerm] = useState("")

  useEffect(() => {
    const savedHistory = localStorage.getItem("workflowHistory")
    if (savedHistory) {
      setHistoryLogs(JSON.parse(savedHistory))
    }
  }, [])

  const filteredLogs = historyLogs.filter(
    (log) =>
      log.orderNo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.customerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.processedBy?.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  const formatDate = (isoString: string) => {
    const date = new Date(isoString)
    return date.toLocaleString()
  }

  const handleViewDetails = (index: number) => {
    router.push(`/commitment-entry?index=${index}`)
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Global Audit History</h1>
          <p className="text-muted-foreground">Track every action across all workflow stages.</p>
        </div>
        <Button className="gap-2">
          <Download className="h-4 w-4" /> Export logs
        </Button>
      </div>

      <Card className="border shadow-sm">
        <CardHeader className="bg-muted/10 border-b">
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search Order No, Customer or User..."
                className="pl-9"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Button variant="outline" className="gap-2 bg-transparent">
              <Filter className="h-4 w-4" /> Filter Stage
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead>DO Number</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Products</TableHead>
                <TableHead>Stage Completed</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Processed By</TableHead>
                <TableHead>Date & Time</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLogs.length > 0 ? (
                filteredLogs.map((log, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{log.orderNo}</TableCell>
                    <TableCell>{log.customerName}</TableCell>
                    <TableCell>
                      <span className="text-sm">
                        {log.productCount || 0} {log.productCount === 1 ? "Product" : "Products"}
                      </span>
                    </TableCell>
                    <TableCell>{log.stage}</TableCell>
                    <TableCell>
                      <Badge variant={log.status === "Completed" ? "default" : "destructive"}>{log.status}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold">
                          {log.processedBy?.charAt(0)}
                        </div>
                        {log.processedBy}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">{formatDate(log.timestamp)}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" className="gap-2" onClick={() => handleViewDetails(i)}>
                        <Eye className="h-4 w-4" /> Details
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    No history records found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-primary/5 border-primary/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-primary">System Health</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">100%</div>
            <p className="text-xs text-muted-foreground mt-1">All modules operational</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Orders Processed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{historyLogs.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Total completed orders</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default function HistoryPage() {
  return (
    <Suspense fallback={null}>
      <HistoryContent />
    </Suspense>
  )
}
