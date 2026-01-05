import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Package, Clock, CheckCircle2, Truck, MapPin, AlertTriangle } from "lucide-react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"

const stats = [
  { title: "Total Orders", value: "1,284", icon: Package, color: "text-blue-500" },
  { title: "Pending Orders", value: "45", icon: Clock, color: "text-orange-500" },
  { title: "Approved Orders", value: "892", icon: CheckCircle2, color: "text-green-500" },
  { title: "Dispatched", value: "312", icon: Truck, color: "text-purple-500" },
  { title: "Delivered", value: "256", icon: MapPin, color: "text-emerald-500" },
  { title: "Damaged", value: "12", icon: AlertTriangle, color: "text-red-500" },
]

export default function Dashboard() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard Overview</h1>
        <Badge variant="outline" className="px-3 py-1">
          Updated Just Now
        </Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {stats.map((stat) => (
          <Card key={stat.title} className="hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium text-muted-foreground">{stat.title}</CardTitle>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground mt-1">+2.5% from last month</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-7">
        <Card className="lg:col-span-4">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order ID</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Stage</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="font-medium">DO-2024-001</TableCell>
                  <TableCell>Alpha Corp</TableCell>
                  <TableCell>
                    <Badge variant="secondary">In Progress</Badge>
                  </TableCell>
                  <TableCell>Order Punch</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">DO-2024-002</TableCell>
                  <TableCell>Beta Logistics</TableCell>
                  <TableCell>
                    <Badge className="bg-green-100 text-green-700 hover:bg-green-100">Approved</Badge>
                  </TableCell>
                  <TableCell>Pre-Approval</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Today's Action Required</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4 p-3 rounded-lg bg-orange-50 border border-orange-100">
              <Clock className="h-5 w-5 text-orange-500" />
              <div className="flex-1">
                <p className="text-sm font-medium">12 Pending Approvals</p>
                <p className="text-xs text-muted-foreground">Urgent: Review by EOD</p>
              </div>
            </div>
            <div className="flex items-center gap-4 p-3 rounded-lg bg-blue-50 border border-blue-100">
              <Truck className="h-5 w-5 text-blue-500" />
              <div className="flex-1">
                <p className="text-sm font-medium">5 Shipments to Load</p>
                <p className="text-xs text-muted-foreground">Logistics ready at Gate 2</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
