import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export default function OrderPunchLoading() {
  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div className="space-y-2">
          <Skeleton className="h-9 w-[250px]" />
          <Skeleton className="h-5 w-[350px]" />
        </div>
        <Skeleton className="h-10 w-[100px]" />
      </div>

      <Card>
        <CardHeader>
          <Skeleton className="h-7 w-[200px]" />
          <Skeleton className="h-4 w-[300px]" />
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Array.from({ length: 10 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-4">
        <Skeleton className="h-10 w-[80px]" />
        <Skeleton className="h-10 w-[140px]" />
      </div>
    </div>
  )
}
