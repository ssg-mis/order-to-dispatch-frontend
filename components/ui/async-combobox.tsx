"use client"

import * as React from "react"
import { Check, ChevronsUpDown, Loader2, Search } from "lucide-react"
import { useInView } from "react-intersection-observer"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

export interface AsyncComboboxOption {
  value: string
  label: string
  dropdownLabel?: string
  original?: any
}

interface AsyncComboboxProps {
  fetchOptions: (search: string, page: number) => Promise<{
    options: AsyncComboboxOption[]
    hasMore: boolean
  }>
  value?: string
  onValueChange?: (value: string) => void
  onSelectOption?: (option: any) => void
  placeholder?: string
  searchPlaceholder?: string
  emptyText?: string
  disabled?: boolean
  className?: string
  debounceItems?: number
}

export function AsyncCombobox({
  fetchOptions,
  value,
  onValueChange,
  onSelectOption,
  placeholder = "Select option...",
  searchPlaceholder = "Search...",
  emptyText = "No option found.",
  disabled = false,
  className,
  debounceItems = 300,
}: AsyncComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState("")
  const [options, setOptions] = React.useState<AsyncComboboxOption[]>([])
  const [page, setPage] = React.useState(1)
  const [hasMore, setHasMore] = React.useState(true)
  const [isLoading, setIsLoading] = React.useState(false)
  const [isInitialLoading, setIsInitialLoading] = React.useState(true)
  
  const { ref: scrollRef, inView } = useInView({
    threshold: 0,
  })

  // Selected label state to show current value even before options are loaded
  const [selectedLabel, setSelectedLabel] = React.useState<string>(value || "")

  const loadOptions = React.useCallback(async (currentSearch: string, currentPage: number, isNewSearch: boolean) => {
    setIsLoading(true)
    try {
      const result = await fetchOptions(currentSearch, currentPage)
      setOptions(prev => isNewSearch ? result.options : [...prev, ...result.options])
      setHasMore(result.hasMore)
      
      // If we find the current value in the new options, update the label
      if (value) {
        const found = result.options.find(o => o.value === value)
        if (found) setSelectedLabel(found.label)
      }
    } catch (error) {
      console.error("Failed to fetch options:", error)
    } finally {
      setIsLoading(false)
      setIsInitialLoading(false)
    }
  }, [fetchOptions, value])

  // Load initial options if value is provided even before popover is opened
  React.useEffect(() => {
    if (value && options.length === 0) {
      loadOptions("", 1, true)
    }
  }, [value, options.length, loadOptions])

  // Initial load
  React.useEffect(() => {
    if (open) {
      setPage(1)
      loadOptions(search, 1, true)
    }
  }, [open, search, loadOptions])

  // Load more when scrolling
  React.useEffect(() => {
    if (inView && hasMore && !isLoading && open) {
      const nextPage = page + 1
      setPage(nextPage)
      loadOptions(search, nextPage, false)
    }
  }, [inView, hasMore, isLoading, search, page, open, loadOptions])

  // Update selected label when value changes locally if possible
  React.useEffect(() => {
    if (value) {
      const found = options.find(o => o.value === value)
      if (found) setSelectedLabel(found.label)
    } else {
      setSelectedLabel("")
    }
  }, [value, options])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "w-full justify-between font-normal",
            !value && "text-muted-foreground",
            className
          )}
        >
          <span className="truncate">
            {selectedLabel || placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0" align="start">
        <Command shouldFilter={false}>
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <input
              className="flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
              placeholder={searchPlaceholder}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
            />
          </div>
          <CommandList className="max-h-[300px] overflow-y-auto">
            <CommandEmpty>
              {isLoading && page === 1 ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  <span>Loading...</span>
                </div>
              ) : (
                emptyText
              )}
            </CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.value}
                  onSelect={(currentValue) => {
                    const selected = options.find(o => o.value === currentValue)
                    onValueChange?.(currentValue === value ? "" : currentValue)
                    if (selected) onSelectOption?.(selected)
                    setOpen(false)
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === option.value ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {option.dropdownLabel || option.label}
                </CommandItem>
              ))}
            </CommandGroup>
            {hasMore && (
              <div
                ref={scrollRef}
                className="flex items-center justify-center py-4 border-t"
              >
                {isLoading && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
              </div>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
