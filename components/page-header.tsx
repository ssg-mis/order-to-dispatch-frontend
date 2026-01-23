"use client"

import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { User } from "lucide-react"

interface PageHeaderProps {
  title: string
  description?: string
  children?: React.ReactNode
}

export function PageHeader({ title, description, children }: PageHeaderProps) {
  return (
    <div className="flex items-center justify-between gap-6 border-b border-slate-100 pb-6 mb-6">
      <div className="flex items-center gap-4 flex-1">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="h-6" />
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900">
            {title}
          </h1>
          {description && (
            <p className="text-sm text-slate-500 font-medium mt-1">
              {description}
            </p>
          )}
        </div>
      </div>
      
      {/* User Profile Section */}
      <div className="flex items-center gap-4">
        {children}
        <div className="flex items-center gap-3 cursor-pointer group">
          <div className="flex flex-col items-end text-right hidden sm:flex">
            <span className="text-sm font-bold text-slate-900 capitalize tracking-tight leading-none">
              Admin
            </span>
            <span className="text-xs text-slate-500">
              OMS Enterprise
            </span>
          </div>
          <div className="relative">
            <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center group-hover:bg-white group-hover:shadow-lg group-hover:border-primary/20 transition-all duration-300">
              <User className="h-5 w-5 text-slate-400 group-hover:text-primary transition-colors" />
            </div>
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full shadow-sm" />
          </div>
        </div>
      </div>
    </div>
  )
}
