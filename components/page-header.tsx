"use client"

import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { User } from "lucide-react"

import { useAuth } from "@/hooks/use-auth"

interface PageHeaderProps {
  title: string
  description?: string
  children?: React.ReactNode
}

export function PageHeader({ title, description, children }: PageHeaderProps) {
  const { user } = useAuth()
  
  return (
    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-6 mb-6">
      <div className="flex items-center gap-4 flex-1 min-w-0">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="h-6 hidden sm:block" />
        <div className="min-w-0 mr-4">
          <h1 className="text-2xl md:text-3xl font-black tracking-tight text-slate-900 truncate">
            {title}
          </h1>
          {description && (
            <p className="text-xs md:text-sm text-slate-500 font-medium mt-1 truncate">
              {description}
            </p>
          )}
        </div>
      </div>
      
      {/* User Profile and Actions Section */}
      <div className="flex items-center justify-between lg:justify-end gap-3 md:gap-4 w-full lg:w-auto">
        <div className="flex items-center gap-2 md:gap-4 flex-1 lg:flex-none justify-start lg:justify-end">
          {children}
        </div>
        
        <Separator orientation="vertical" className="h-8 mx-2 hidden md:block" />

        <div className="flex items-center gap-3 cursor-pointer group shrink-0">
          <div className="flex flex-col items-end text-right hidden sm:flex">
            <span className="text-sm font-bold text-slate-900 capitalize tracking-tight leading-none">
              {user?.username || "Admin"}
            </span>
            <span className="text-[10px] md:text-xs text-slate-500">
              OMS Enterprise
            </span>
          </div>
          <div className="relative">
            <div className="w-9 h-9 md:w-10 md:h-10 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center group-hover:bg-white group-hover:shadow-lg group-hover:border-primary/20 transition-all duration-300">
              <User className="h-4 w-4 md:h-5 md:w-5 text-slate-400 group-hover:text-primary transition-colors" />
            </div>
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full shadow-sm" />
          </div>
        </div>
      </div>
    </div>
  )
}
