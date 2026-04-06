"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { varCalcApi } from "@/lib/api-service"
import {
    Calculator,
    Save,
    Calendar,
    TrendingUp,
    Truck,
    IndianRupee,
    Percent,
    History,
    Info,
    Clock,
    ArrowRight,
    Database,
    Droplets
} from "lucide-react"
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
    Table,
    TableBody,
    TableCaption,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { useInfiniteQuery } from "@tanstack/react-query"
import { useInView } from "react-intersection-observer"
import { Loader2 } from "lucide-react"

const OIL_TYPES = ["Palm Oil", "Soya Oil", "Rice Oil"] as const;
type OilType = typeof OIL_TYPES[number];

const OIL_TYPE_COLORS: Record<OilType, { bg: string; border: string; text: string; activeBg: string; activeText: string; icon: string }> = {
    "Palm Oil":  { bg: "bg-orange-50",  border: "border-orange-200", text: "text-orange-700",  activeBg: "bg-orange-600",  activeText: "text-white", icon: "text-orange-500" },
    "Soya Oil":  { bg: "bg-amber-50",   border: "border-amber-200",  text: "text-amber-700",   activeBg: "bg-amber-600",   activeText: "text-white", icon: "text-amber-500"  },
    "Rice Oil":  { bg: "bg-lime-50",    border: "border-lime-200",   text: "text-lime-700",    activeBg: "bg-lime-600",    activeText: "text-white", icon: "text-lime-500"   },
};

export default function VariableParametersPage() {
    const { toast } = useToast()
    const [isSaving, setIsSaving] = useState(false)
    const [activeTab, setActiveTab] = useState<string>("configure")
    const { ref: historyEndRef, inView: historyInView } = useInView()
    const [selectedOilType, setSelectedOilType] = useState<OilType>("Palm Oil")
    const getLocalISODate = (dateInput?: string | Date) => {
        const d = dateInput ? new Date(dateInput) : new Date();
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const [varCalc, setVarCalc] = useState({
        oil_rate: "",
        freight_rate: "",
        total: "0.00",
        gst: "0.00",
        gt: "0.00",
        calculation_date: getLocalISODate()
    })

    // History query with infinite pagination
    const {
        data: historyDataPage,
        fetchNextPage: fetchNextHistory,
        hasNextPage: hasNextHistory,
        isFetchingNextPage: isFetchingNextHistory,
        isLoading: isHistoryLoading,
        refetch: refetchHistory,
    } = useInfiniteQuery({
        queryKey: ["var-calc-history"],
        queryFn: async ({ pageParam = 1 }) => {
            const response = await varCalcApi.getAll({
                page: pageParam,
                limit: 20
            });
            return response.success ? response.data : { history: [], pagination: { total: 0 } };
        },
        initialPageParam: 1,
        getNextPageParam: (lastPage, allPages) => {
            const currentCount = allPages.reduce((sum, page) => sum + (Array.isArray(page) ? page.length : (page.history?.length || 0)), 0);
            const total = Array.isArray(lastPage) ? 0 : (lastPage.pagination?.total || 0);
            return currentCount < total ? allPages.length + 1 : undefined;
        },
        enabled: activeTab === "history",
    });

    const historyData = useMemo(() => {
        if (!historyDataPage) return [];
        return historyDataPage.pages.flatMap(page => Array.isArray(page) ? page : (page.history || []));
    }, [historyDataPage]);

    useEffect(() => {
        if (historyInView && hasNextHistory) {
            fetchNextHistory();
        }
    }, [historyInView, hasNextHistory, fetchNextHistory]);

    // Independent latest fetch
    const fetchLatest = useCallback(async () => {
        try {
            const response = await varCalcApi.getLatest()
            if (response.success && response.data) {
                setVarCalc({
                    oil_rate: response.data.oil_rate?.toString() || response.data.loose_1_kg_oil_rate?.toString() || "",
                    freight_rate: response.data.freight_rate?.toString() || "",
                    total: response.data.total?.toString() || "0.00",
                    gst: response.data.gst?.toString() || response.data.five_percent_gst?.toString() || "0.00",
                    gt: response.data.gt?.toString() || "0.00",
                    calculation_date: getLocalISODate()
                })
            }
        } catch (error) {
            console.error("Failed to fetch latest var calc:", error)
        }
    }, [])

    useEffect(() => {
        fetchLatest()
    }, [fetchLatest])

    // Auto-calculation logic
    useEffect(() => {
        const oil = parseFloat(varCalc.oil_rate) || 0
        const freight = parseFloat(varCalc.freight_rate) || 0
        const total = oil + freight
        const gst = total * 0.05
        const gt = total + gst

        setVarCalc(prev => ({
            ...prev,
            total: total.toFixed(2),
            gst: gst.toFixed(2),
            gt: gt.toFixed(2)
        }))
    }, [varCalc.oil_rate, varCalc.freight_rate])

    const handleSave = async () => {
        if (!varCalc.oil_rate || !varCalc.freight_rate) {
            toast({
                title: "Validation Error",
                description: "Please enter both oil rate and freight rate",
                variant: "destructive"
            })
            return
        }

        setIsSaving(true)
        try {
            const response = await varCalcApi.save({
                oil_rate: parseFloat(varCalc.oil_rate),
                freight_rate: parseFloat(varCalc.freight_rate),
                total: parseFloat(varCalc.total),
                gst: parseFloat(varCalc.gst),
                gt: parseFloat(varCalc.gt),
                oil_type: selectedOilType,
                calculation_date: varCalc.calculation_date
            })

            if (response.success) {
                toast({
                    title: "Success",
                    description: `Variable parameters saved for ${selectedOilType}`,
                })
                refetchHistory() // Refresh history after save
            }
        } catch (error: any) {
            toast({
                title: "Error",
                description: error.message || "Failed to save parameters",
                variant: "destructive"
            })
        } finally {
            setIsSaving(false)
        }
    }

    return (
        <SidebarInset>
            <div className="p-6 space-y-8 w-full">
                {/* Simplified Header */}
                <div className="flex items-center gap-3">
                    <SidebarTrigger className="-ml-1" />
                    <Separator orientation="vertical" className="h-6" />
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Variable Parameters</h1>
                        <p className="text-sm text-slate-500">Configure and track global rate parameters</p>
                    </div>
                </div>

                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <TabsList className="grid w-full max-w-[400px] grid-cols-2 mb-6 bg-slate-100 p-1 rounded-xl h-12">
                        <TabsTrigger value="configure" className="rounded-lg text-sm font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm transition-all flex items-center gap-2">
                            <Calculator className="h-4 w-4" />
                            Configuration
                        </TabsTrigger>
                        <TabsTrigger value="history" className="rounded-lg text-sm font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm transition-all flex items-center gap-2">
                            <Clock className="h-4 w-4" />
                            History Log
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="configure" className="space-y-8 animate-in fade-in duration-300">
                        {/* Oil Type Selector */}
                        <div className="flex items-center gap-3 flex-wrap">
                            <div className="flex items-center gap-2 mr-2">
                                <Droplets className="h-5 w-5 text-indigo-500" />
                                <span className="text-sm font-bold text-slate-600 uppercase tracking-wider">Oil Type</span>
                            </div>
                            {OIL_TYPES.map((oilType) => {
                                const colors = OIL_TYPE_COLORS[oilType];
                                const isActive = selectedOilType === oilType;
                                return (
                                    <button
                                        key={oilType}
                                        onClick={() => {
                                            setSelectedOilType(oilType);
                                            setVarCalc(prev => ({ ...prev, oil_rate: "", total: "0.00", gst: "0.00", gt: "0.00" }));
                                        }}
                                        className={`px-5 py-2.5 rounded-xl text-sm font-bold border-2 transition-all duration-200 flex items-center gap-2 ${
                                            isActive
                                                ? `${colors.activeBg} ${colors.activeText} border-transparent shadow-lg scale-105`
                                                : `${colors.bg} ${colors.text} ${colors.border} hover:shadow-md hover:scale-[1.02]`
                                        }`}
                                    >
                                        <Droplets className={`h-4 w-4 ${isActive ? 'text-white/80' : colors.icon}`} />
                                        {oilType}
                                    </button>
                                );
                            })}
                        </div>
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                            {/* Input Section */}
                            <Card className="lg:col-span-2 shadow-xl border-slate-200 overflow-hidden relative group">
                                <div className="absolute top-0 left-0 w-1 h-full bg-indigo-600"></div>
                                <CardHeader className="bg-slate-50/50 pb-4">
                                    <div className="flex items-center gap-2">
                                        <div className="p-2 bg-indigo-100 rounded-lg">
                                            <Calculator className="h-5 w-5 text-indigo-600" />
                                        </div>
                                        <div>
                                            <CardTitle className="text-xl font-bold text-slate-900">Configure Market Rates</CardTitle>
                                            <CardDescription>Enter the current daily rates for oil and transportation</CardDescription>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="pt-8 space-y-8">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                        {/* Loose Oil Rate */}
                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between">
                                                <Label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                                                    <TrendingUp className="h-4 w-4 text-emerald-500" />
                                                    Loose 1 kg oil rate
                                                </Label>
                                                <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Primary Input</span>
                                            </div>
                                            <div className="relative group transition-all duration-300">
                                                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-lg">₹</div>
                                                <Input
                                                    type="number"
                                                    step="0.01"
                                                    placeholder="0.00"
                                                    value={varCalc.oil_rate}
                                                    onChange={(e) => setVarCalc(prev => ({ ...prev, oil_rate: e.target.value }))}
                                                    className="pl-10 h-14 text-xl font-mono bg-white border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all rounded-xl"
                                                />
                                            </div>
                                        </div>

                                        {/* Freight Rate */}
                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between">
                                                <Label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                                                    <Truck className="h-4 w-4 text-indigo-500" />
                                                    Freight rate
                                                </Label>
                                                <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Primary Input</span>
                                            </div>
                                            <div className="relative group transition-all duration-300">
                                                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-lg">₹</div>
                                                <Input
                                                    type="number"
                                                    step="0.01"
                                                    placeholder="0.00"
                                                    value={varCalc.freight_rate}
                                                    onChange={(e) => setVarCalc(prev => ({ ...prev, freight_rate: e.target.value }))}
                                                    className="pl-10 h-14 text-xl font-mono bg-white border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all rounded-xl"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between p-6 bg-indigo-50/50 rounded-2xl border border-indigo-100 gap-4">
                                        <div className="flex items-center gap-4">
                                            <div className="p-3 bg-white shadow-sm rounded-xl">
                                                <Calendar className="h-5 w-5 text-indigo-600" />
                                            </div>
                                            <div className="space-y-1">
                                                <Label className="text-xs uppercase tracking-[0.2em] font-black text-indigo-400">Effective Date</Label>
                                                <Input
                                                    type="date"
                                                    value={varCalc.calculation_date}
                                                    onChange={(e) => setVarCalc(prev => ({ ...prev, calculation_date: e.target.value }))}
                                                    className="h-10 font-bold text-slate-900 bg-white border-indigo-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 rounded-lg w-[200px]"
                                                />
                                            </div>
                                        </div>

                                        <Button
                                            onClick={handleSave}
                                            disabled={isSaving}
                                            className="w-full md:w-auto px-10 h-12 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-600/20 transition-all active:scale-95 flex items-center gap-3"
                                        >
                                            {isSaving ? (
                                                <div className="h-5 w-5 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                                            ) : (
                                                <>
                                                    <Save className="h-5 w-5" />
                                                    Save Parameters
                                                </>
                                            )}
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Results Sidebar in Card */}
                            <div className="space-y-6">
                                <Card className="shadow-2xl border-none bg-linear-to-br from-indigo-900 to-slate-900 text-white overflow-hidden relative">
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full -mr-16 -mt-16 blur-3xl"></div>
                                    <CardHeader className="border-b border-white/10 pb-4">
                                        <CardTitle className="text-sm uppercase tracking-widest font-black text-indigo-300">Quick Glance</CardTitle>
                                    </CardHeader>
                                    <CardContent className="pt-8 space-y-6">
                                        <div className="space-y-6">
                                            <div className="flex justify-between items-center group">
                                                <div className="flex items-center gap-3">
                                                    <div className="p-2 bg-white/5 rounded-lg group-hover:bg-white/10 transition-colors">
                                                        <IndianRupee className="h-4 w-4 text-indigo-300" />
                                                    </div>
                                                    <span className="text-sm font-bold text-slate-300 uppercase letter-spacing-1">Total Base</span>
                                                </div>
                                                <span className="text-2xl font-black text-white font-mono">₹{varCalc.total}</span>
                                            </div>

                                            <div className="flex justify-between items-center group">
                                                <div className="flex items-center gap-3">
                                                    <div className="p-2 bg-white/5 rounded-lg group-hover:bg-white/10 transition-colors">
                                                        <Percent className="h-4 w-4 text-emerald-400" />
                                                    </div>
                                                    <span className="text-sm font-bold text-slate-300 uppercase letter-spacing-1">GST (5%)</span>
                                                </div>
                                                <span className="text-2xl font-black text-emerald-400 font-mono">₹{varCalc.gst}</span>
                                            </div>

                                            <Separator className="bg-white/10 h-px" />

                                            <div className="pt-4 pb-2 text-center relative">
                                                <div className="absolute inset-0 bg-indigo-500/10 blur-xl rounded-full opacity-50"></div>
                                                <Label className="block text-[10px] font-black text-indigo-300 uppercase tracking-[0.3em] mb-3 relative">Grand Total (GT)</Label>
                                                <div className="text-5xl font-black text-white font-mono tracking-tighter relative">
                                                    ₹{varCalc.gt}
                                                </div>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        </div>
                    </TabsContent>

                    <TabsContent value="history" className="animate-in fade-in slide-in-from-bottom-2 duration-400">
                        <Card className="shadow-xl border-slate-200 overflow-hidden">
                            <CardHeader className="border-b bg-slate-50/50 flex flex-row items-center justify-between py-6">
                                <div className="flex items-center gap-4">
                                    <div className="p-2 bg-amber-100 rounded-lg">
                                        <Database className="h-5 w-5 text-amber-600" />
                                    </div>
                                    <div>
                                        <CardTitle className="text-xl font-extrabold text-slate-900">Historical Records</CardTitle>
                                        <CardDescription>Comprehensive audit log of all parameter changes</CardDescription>
                                    </div>
                                </div>
                                <Badge className="bg-slate-200 text-slate-700 hover:bg-slate-200 font-bold px-4 py-1.5 rounded-full">
                                    {historyData.length} TOTAL ENTRIES
                                </Badge>
                            </CardHeader>
                            <CardContent className="p-0">
                                <div className="flex flex-col h-[600px]">
                                    <div className="flex-1 overflow-auto rounded-b-2xl">
                                        <Table>
                                            <TableHeader className="sticky top-0 z-20 bg-slate-50 shadow-sm">
                                                <TableRow className="hover:bg-transparent border-slate-200">
                                                    <TableHead className="w-[200px] text-[11px] font-black uppercase text-slate-400 tracking-wider h-14 pl-6">Calculation Date</TableHead>
                                                    <TableHead className="text-[11px] font-black uppercase text-slate-400 tracking-wider h-14">Oil Type</TableHead>
                                                    <TableHead className="text-[11px] font-black uppercase text-slate-400 tracking-wider h-14">Loose Oil Rate</TableHead>
                                                    <TableHead className="text-[11px] font-black uppercase text-slate-400 tracking-wider h-14">Freight Rate</TableHead>
                                                    <TableHead className="text-[11px] font-black uppercase text-slate-400 tracking-wider h-14">Base Total</TableHead>
                                                    <TableHead className="text-[11px] font-black uppercase tracking-wider h-14 text-emerald-600">GST (5%)</TableHead>
                                                    <TableHead className="text-right text-[11px] font-black uppercase text-slate-400 tracking-wider h-14 pr-8">Grand Total</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {isHistoryLoading && historyData.length === 0 ? (
                                                    [...Array(5)].map((_, i) => (
                                                        <TableRow key={i} className="opacity-40 border-b border-slate-50">
                                                            <TableCell className="py-5 pl-6"><div className="h-4 w-32 bg-slate-200 animate-pulse rounded" /></TableCell>
                                                            <TableCell><div className="h-4 w-20 bg-slate-200 animate-pulse rounded-full" /></TableCell>
                                                            <TableCell><div className="h-4 w-16 bg-slate-200 animate-pulse rounded" /></TableCell>
                                                            <TableCell><div className="h-4 w-16 bg-slate-200 animate-pulse rounded" /></TableCell>
                                                            <TableCell><div className="h-4 w-16 bg-slate-200 animate-pulse rounded" /></TableCell>
                                                            <TableCell><div className="h-4 w-16 bg-slate-100 animate-pulse rounded" /></TableCell>
                                                            <TableCell className="text-right pr-8"><div className="h-6 w-20 bg-slate-200 animate-pulse rounded ml-auto" /></TableCell>
                                                        </TableRow>
                                                    ))
                                                ) : historyData.length === 0 ? (
                                                    <TableRow>
                                                        <TableCell colSpan={7} className="h-64 text-center">
                                                            <div className="flex flex-col items-center gap-4 grayscale opacity-40">
                                                                <History className="h-12 w-12 text-slate-400" />
                                                                <p className="font-bold text-slate-500 uppercase tracking-widest">No historical data found</p>
                                                            </div>
                                                        </TableCell>
                                                    </TableRow>
                                                ) : (
                                                    <>
                                                        {historyData.map((row, idx) => (
                                                            <TableRow key={row.id || idx} className="hover:bg-indigo-50/30 transition-colors border-slate-100 group">
                                                                <TableCell className="font-bold text-slate-900 py-5 pl-6">
                                                                    <div className="flex items-center gap-3">
                                                                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 group-hover:scale-125 transition-transform" />
                                                                        {row.calculation_date ? new Date(row.calculation_date).toLocaleDateString('en-GB', {
                                                                            day: '2-digit', month: 'short', year: 'numeric'
                                                                        }) : 'N/A'}
                                                                    </div>
                                                                </TableCell>
                                                                <TableCell>
                                                                    {row.oil_type ? (
                                                                        <Badge className={`font-bold text-xs px-3 py-1 rounded-full ${
                                                                            row.oil_type === 'Palm Oil' ? 'bg-orange-100 text-orange-700 hover:bg-orange-100' :
                                                                            row.oil_type === 'Soya Oil' ? 'bg-amber-100 text-amber-700 hover:bg-amber-100' :
                                                                            row.oil_type === 'Rice Oil' ? 'bg-lime-100 text-lime-700 hover:bg-lime-100' :
                                                                            'bg-slate-100 text-slate-700 hover:bg-slate-100'
                                                                        }`}>
                                                                            {row.oil_type}
                                                                        </Badge>
                                                                    ) : (
                                                                        <span className="text-slate-400 text-xs">—</span>
                                                                    )}
                                                                </TableCell>
                                                                <TableCell className="font-mono font-medium text-slate-600">₹{row.loose_1_kg_oil_rate ?? row.oil_rate ?? '0.00'}</TableCell>
                                                                <TableCell className="font-mono font-medium text-slate-600">₹{row.freight_rate ?? '0.00'}</TableCell>
                                                                <TableCell className="font-mono font-medium text-slate-600">₹{row.total ?? '0.00'}</TableCell>
                                                                <TableCell className="font-mono font-bold text-emerald-600">₹{row.five_percent_gst ?? row.gst ?? '0.00'}</TableCell>
                                                                <TableCell className="text-right font-mono font-black text-indigo-600 pr-8 text-lg">
                                                                    ₹{row.gt ?? '0.00'}
                                                                </TableCell>
                                                            </TableRow>
                                                        ))}
                                                        {/* Infinite Scroll Sentinel */}
                                                        <TableRow ref={historyEndRef}>
                                                            <TableCell colSpan={7} className="p-0 h-16 border-none">
                                                                {isFetchingNextHistory && (
                                                                    <div className="flex items-center justify-center py-4 bg-slate-50/20">
                                                                        <div className="flex gap-1.5 items-center bg-white px-4 py-1.5 rounded-full shadow-sm border border-slate-100">
                                                                            <div className="h-1.5 w-1.5 bg-indigo-500 animate-bounce [animation-delay:-0.3s]"></div>
                                                                            <div className="h-1.5 w-1.5 bg-indigo-500 animate-bounce [animation-delay:-0.15s]"></div>
                                                                            <div className="h-1.5 w-1.5 bg-indigo-500 animate-bounce"></div>
                                                                            <span className="text-xs font-medium ml-2 text-slate-500 uppercase tracking-widest">Loading...</span>
                                                                        </div>
                                                                    </div>
                                                                )}
                                                                {!hasNextHistory && historyData.length > 0 && (
                                                                    <div className="flex justify-center flex-col items-center py-6 grayscale opacity-20">
                                                                        <div className="h-px w-12 bg-slate-300 mb-2" />
                                                                        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">End of records</span>
                                                                    </div>
                                                                )}
                                                            </TableCell>
                                                        </TableRow>
                                                    </>
                                                )}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </div>
        </SidebarInset>
    )
}
