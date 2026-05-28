import { formatToIST } from "@/lib/date-utils"

interface ISTDateTimeProps {
  value: string | Date
  className?: string
}

export function ISTDateTime({ value, className }: ISTDateTimeProps) {
  return <span className={className}>{formatToIST(value)}</span>
}
