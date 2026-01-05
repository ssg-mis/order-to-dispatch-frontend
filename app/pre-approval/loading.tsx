import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export default function PreApprovalLoading() {
  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center">
        <div className="space-y-2">
          <Skeleton className="h-9 w-[300px]" />
          <Skeleton className="h-5 w-[400px]" />
        </div>
        <Skeleton className="h-8 w-[120px]" />
      </div>

      <Skeleton className="h-12 w-full max-w-[400px]" />

      <Card>
        <CardHeader>
          <Skeleton className="h-12 w-full" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-[300px] w-full" />
        </CardContent>
      </Card>
    </div>
  )
}
