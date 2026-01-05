"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { WorkflowStageShell } from "@/components/workflow/workflow-stage-shell";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

export default function OverallCheckingPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [pendingOrders, setPendingOrders] = useState<any[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [decision, setDecision] = useState<string>("");
  const [openOrderId, setOpenOrderId] = useState<string | null>(null);
  const [historyOrders, setHistoryOrders] = useState<any[]>([]);

  useEffect(() => {
    const savedHistory = localStorage.getItem("workflowHistory");
    if (savedHistory) {
      const history = JSON.parse(savedHistory);
      
      const completed = history.filter(
        (item: any) => item.stage === "Overall Checking"
      );
      setHistoryOrders(completed);

      const approved = history.filter(
        (item: any) =>
          item.stage === "Commitment Entry" && item.status === "Approved"
      ).filter(
        (item: any) => 
          !completed.some((completedItem: any) => completedItem.doNumber === item.doNumber)
      );
      setPendingOrders(approved);
    }
  }, []);

  const handleApprove = async (order: any, index: number) => {
    if (!decision) return;

    setIsProcessing(true);
    try {
      const isAccepted = decision === "accept";
      const updatedOrder = {
        ...order,
        stage: "Overall Checking",
        status: isAccepted ? "Completed" : "Rejected",
        overallCheckingData: {
          decision,
          completedAt: new Date().toISOString(),
        },
      };

      const savedHistory = localStorage.getItem("workflowHistory");
      const history = savedHistory ? JSON.parse(savedHistory) : [];
      history.push(updatedOrder);
      localStorage.setItem("workflowHistory", JSON.stringify(history));
      localStorage.setItem("currentOrderData", JSON.stringify(updatedOrder));

      toast({
        title: isAccepted ? "Overall Checking Completed" : "Order Rejected",
        description: isAccepted
          ? "Order moved to Check Delivery stage."
          : "Order has been rejected.",
      });

      const newPending = [...pendingOrders];
      newPending.splice(index, 1);
      setPendingOrders(newPending);
      setHistoryOrders((prev) => [...prev, updatedOrder]);
      setDecision("");
      setOpenOrderId(null);

      if (isAccepted) {
        setTimeout(() => {
          router.push("/check-delivery");
        }, 1500);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <WorkflowStageShell
      title="Stage 5: Overall Checking"
      description="Final verification of all order details before dispatch."
      pendingCount={pendingOrders.length}
      historyData={historyOrders.map((order) => ({
        date: new Date(order.overallCheckingData?.completedAt || new Date()).toLocaleDateString(),
        stage: "Overall Checking",
        status: order.status === "Completed" ? "Accepted" : "Rejected",
        remarks: order.overallCheckingData?.decision === "accept" ? "Accepted" : "Rejected",
      }))}
    >
      <Card className="border-none shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow>
              <TableHead>Action</TableHead>
              <TableHead>DO Number</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Products</TableHead>
              <TableHead>Stage</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pendingOrders.length > 0 ? (
              pendingOrders.map((order, index) => (
                <TableRow key={`${order.doNumber}-${index}`}>
                  <TableCell>
                    <Dialog
                      open={openOrderId === order.doNumber}
                      onOpenChange={(isOpen) => {
                        if (isOpen) {
                          setOpenOrderId(order.doNumber);
                        } else {
                          setOpenOrderId(null);
                          setDecision("");
                        }
                      }}
                    >
                      <DialogTrigger asChild>
                        <Button size="sm">Check</Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-sm">
                        <DialogHeader>
                          <DialogTitle>
                            Overall Checking: {order.doNumber}
                          </DialogTitle>
                        </DialogHeader>
                        <div className="py-4 space-y-4">
                          <div className="space-y-2">
                            <Label>Action</Label>
                            <Select
                              value={decision}
                              onValueChange={setDecision}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select Action" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="accept">Accept</SelectItem>
                                <SelectItem value="reject">Reject</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <DialogFooter>
                          <Button
                            onClick={() => handleApprove(order, index)}
                            disabled={!decision || isProcessing}
                          >
                            {isProcessing
                              ? "Processing..."
                              : "Submit"}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </TableCell>
                  <TableCell className="font-medium">{order.doNumber}</TableCell>
                  <TableCell>{order.customerName}</TableCell>
                  <TableCell>{order.productCount} Products</TableCell>
                  <TableCell>{order.stage}</TableCell>
                  <TableCell>
                    <Badge className="bg-yellow-100 text-yellow-700">
                      {order.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="text-center py-8 text-muted-foreground"
                >
                  No orders pending for overall checking
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </WorkflowStageShell>
  );
}
