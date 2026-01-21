import { useState, useRef, useEffect } from 'react'
import { Check, ChevronDown, X } from 'lucide-react'
import { clsx } from 'clsx'

type Option = {
  value: string
  label: string
  color?: string
}

type MultiSelectProps = {
  options: Option[]
  value: string[]
  onChange: (value: string[]) => void
  placeholder?: string
  label?: string
  className?: string
}

export function MultiSelect({
  options,
  value,
  onChange,
  placeholder = "Seleccionar...",
  label,
  className = ""
}: MultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const toggleOption = (optionValue: string) => {
    if (value.includes(optionValue)) {
      onChange(value.filter(v => v !== optionValue))
    } else {
      onChange([...value, optionValue])
    }
  }

  const clearAll = (e: React.MouseEvent) => {
    e.stopPropagation()
    onChange([])
  }

  const selectedOptions = options.filter(opt => value.includes(opt.value))

  return (
    <div ref={containerRef} className={clsx("relative", className)}>
      {label && (
        <label className="block text-[10px] uppercase font-bold text-[#8A8F8F] tracking-wider mb-1.5">
          {label}
        </label>
      )}
      
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={clsx(
          "w-full flex items-center justify-between gap-2 px-3 py-2 bg-white border rounded-lg text-sm text-left transition-all",
          isOpen 
            ? "border-[#6353FF] ring-2 ring-[#6353FF] ring-opacity-30" 
            : "border-[#E0E0E1] hover:border-[#B0B5B5]"
        )}
      >
        <div className="flex-1 flex items-center gap-1.5 min-w-0 overflow-hidden">
          {selectedOptions.length === 0 ? (
            <span className="text-[#B0B5B5]">{placeholder}</span>
          ) : selectedOptions.length <= 2 ? (
            <div className="flex items-center gap-1 flex-wrap">
              {selectedOptions.map(opt => (
                <span 
                  key={opt.value}
                  className={clsx(
                    "inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium",
                    opt.color ? `${opt.color} text-white` : "bg-[#F7F7F8] text-[#5A5F5F]"
                  )}
                >
                  {opt.label}
                </span>
              ))}
            </div>
          ) : (
            <span className="text-[#3F4444]">{selectedOptions.length} seleccionados</span>
          )}
        </div>
        
        <div className="flex items-center gap-1">
          {value.length > 0 && (
            <button
              type="button"
              onClick={clearAll}
              className="p-0.5 hover:bg-[#F7F7F8] rounded transition-colors"
            >
              <X className="w-3.5 h-3.5 text-[#8A8F8F]" />
            </button>
          )}
          <ChevronDown className={clsx(
            "w-4 h-4 text-[#8A8F8F] transition-transform",
            isOpen && "rotate-180"
          )} />
        </div>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-[#E0E0E1] rounded-lg shadow-lg overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
          <div className="max-h-60 overflow-auto py-1">
            {options.map(option => {
              const isSelected = value.includes(option.value)
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => toggleOption(option.value)}
                  className={clsx(
                    "w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors",
                    isSelected 
                      ? "bg-[rgba(99,83,255,0.08)] text-[#6353FF]" 
                      : "hover:bg-[#F7F7F8] text-[#3F4444]"
                  )}
                >
                  <div className={clsx(
                    "w-4 h-4 rounded border flex items-center justify-center transition-colors",
                    isSelected 
                      ? "bg-[#6353FF] border-[#6353FF]" 
                      : "border-[#E0E0E1]"
                  )}>
                    {isSelected && <Check className="w-3 h-3 text-white" />}
                  </div>
                  
                  {option.color && (
                    <span className={clsx("w-2 h-2 rounded-full", option.color)} />
                  )}
                  
                  <span className="flex-1">{option.label}</span>
                </button>
              )
            })}
          </div>
          
          {/* Quick Actions */}
          <div className="border-t border-[#E0E0E1] px-3 py-2 flex items-center justify-between bg-[#FAFAFA]">
            <button
              type="button"
              onClick={() => onChange(options.map(o => o.value))}
              className="text-xs text-[#6353FF] hover:underline"
            >
              Seleccionar todos
            </button>
            <button
              type="button"
              onClick={() => onChange([])}
              className="text-xs text-[#8A8F8F] hover:text-[#5A5F5F]"
            >
              Limpiar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
