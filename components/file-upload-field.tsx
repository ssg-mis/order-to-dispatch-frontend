"use client"

import * as React from "react"
import { ExternalLink, FileText, Image as ImageIcon, Upload, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

type UploadValue = string | string[] | null | undefined

type FileUploadFieldProps = {
  label?: React.ReactNode
  helperText?: React.ReactNode
  accept?: string
  multiple?: boolean
  disabled?: boolean
  uploading?: boolean
  value?: UploadValue
  fileName?: UploadValue
  placeholder?: string
  buttonText?: string
  variant?: "field" | "dropzone"
  className?: string
  inputClassName?: string
  triggerClassName?: string
  previewClassName?: string
  onRemove?: (index: number) => void
  onFilesSelected: (files: File[]) => void
}

function toArray(value: UploadValue) {
  if (!value) return []
  return Array.isArray(value) ? value.filter(Boolean) : [value]
}

function getFileName(source: string) {
  try {
    const pathname = source.includes("://") ? new URL(source).pathname : source
    const fileName = pathname.split("/").filter(Boolean).pop()
    return fileName || source.split("/").filter(Boolean).pop() || source
  } catch {
    return source.split("/").filter(Boolean).pop() || source
  }
}

function isImageSource(source: string, accept?: string) {
  const lowerSource = source.toLowerCase()
  const lowerAccept = accept?.toLowerCase() || ""
  return (
    lowerAccept.includes("image/*") ||
    /\.(png|jpe?g|webp|gif|bmp|heic|heif|svg)$/i.test(lowerSource)
  )
}

export function FileUploadField({
  label,
  helperText,
  accept,
  multiple,
  disabled,
  uploading,
  value,
  fileName,
  placeholder = "Choose file",
  buttonText,
  variant = "field",
  className,
  inputClassName,
  triggerClassName,
  previewClassName,
  onRemove,
  onFilesSelected,
}: FileUploadFieldProps) {
  const inputRef = React.useRef<HTMLInputElement | null>(null)
  const inputId = React.useId()

  const uploadedValues = toArray(value)
  const uploadedNames = toArray(fileName)
  const previewItems = uploadedValues.length > 0
    ? uploadedValues.map((url, index) => ({
        url,
        name: uploadedNames[index] || getFileName(url),
      }))
    : uploadedNames.map((name) => ({ name }))

  const openPicker = () => {
    if (disabled || uploading) return
    inputRef.current?.click()
  }

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || [])
    if (files.length) onFilesSelected(files)
    event.target.value = ""
  }

  const hasSelection = previewItems.length > 0 || uploadedNames.length > 0
  const primaryLabel = buttonText || (multiple ? "Choose files" : "Choose file")

  return (
    <div className={cn("space-y-2", className)}>
      {label && (
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">{label}</div>
          {hasSelection && (
            <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
              Uploaded
            </span>
          )}
        </div>
      )}

      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        onChange={handleChange}
        className="sr-only"
      />

      {variant === "dropzone" ? (
        <button
          type="button"
          onClick={openPicker}
          disabled={disabled}
          className={cn(
            "flex w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed bg-slate-50/70 p-4 text-center transition-colors hover:border-blue-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60",
            triggerClassName
          )}
        >
          <Upload className="h-5 w-5 text-blue-600" />
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
              {uploading ? "Uploading..." : hasSelection ? "Replace file" : primaryLabel}
            </p>
            <p className="mt-1 break-words text-xs text-slate-700">
              {uploadedNames[0] || placeholder}
            </p>
          </div>
        </button>
      ) : (
        <Button
          type="button"
          variant="outline"
          onClick={openPicker}
          disabled={disabled}
          className={cn(
            "w-full justify-between gap-3 border-dashed text-xs",
            triggerClassName
          )}
        >
          <span className="flex min-w-0 items-center gap-2 text-slate-500">
            <Upload className="h-4 w-4 shrink-0 text-slate-400" />
            <span className="truncate">{uploading ? "Uploading..." : uploadedNames[0] || primaryLabel}</span>
          </span>
          {hasSelection && (
            <span className="shrink-0 rounded-full bg-blue-100 px-2 py-0.5 text-[9px] font-black uppercase tracking-tight text-blue-700">
              Selected
            </span>
          )}
        </Button>
      )}

      {previewItems.length > 0 && (
        <div className={cn("grid gap-2", multiple ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-1", previewClassName)}>
          {previewItems.map((item, index) => {
            const imagePreview = item.url && isImageSource(item.url, accept)
            return (
              <div key={`${item.url || item.name || index}-${index}`} className="relative">
                <button
                  type="button"
                  onClick={() => item.url && window.open(item.url, "_blank", "noopener,noreferrer")}
                  disabled={!item.url}
                  className={cn(
                    "group flex w-full items-center gap-3 rounded-md border border-slate-200 bg-white p-2 text-left transition-colors",
                    item.url && "hover:bg-slate-50",
                    !item.url && "cursor-default"
                  )}
                >
                  {imagePreview ? (
                    <img
                      src={item.url}
                      alt={item.name}
                      className="h-12 w-12 rounded-md border border-slate-200 object-cover"
                    />
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-slate-500">
                      {item.url ? <FileText className="h-5 w-5" /> : <ImageIcon className="h-5 w-5" />}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-slate-700">{item.name}</p>
                    <p className="truncate text-[10px] text-slate-400">
                      {item.url ? "Click to open" : "Selected file"}
                    </p>
                  </div>
                  {item.url && <ExternalLink className="h-4 w-4 shrink-0 text-slate-400" />}
                </button>
                {onRemove && (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation()
                      onRemove(index)
                    }}
                    className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-rose-600 text-white shadow-sm transition-colors hover:bg-rose-700"
                    aria-label={`Remove ${item.name}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {helperText && <p className="text-[10px] text-slate-400">{helperText}</p>}
    </div>
  )
}
