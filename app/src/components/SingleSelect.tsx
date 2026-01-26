import { useEffect, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { clsx } from 'clsx'

type Option = {
  value: string
  label: string
}

type SingleSelectProps = {
  options: Option[]
  value: string
  onChange: (value: string) => void
  placeholder?: string
  label?: string
  prefix?: string
  className?: string
}

export function SingleSelect({
  options,
  value,
  onChange,
  placeholder = 'Seleccionar...',
  label,
  prefix,
  className = '',
}: SingleSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const selectedOption = options.find(option => option.value === value)
  const selectedLabel = selectedOption?.label ?? placeholder

  return (
    <div ref={containerRef} className={clsx('relative', className)}>
      {label && (
        <label className="block text-[10px] uppercase font-bold text-[#8A8F8F] tracking-wider mb-1.5">
          {label}
        </label>
      )}

      <div
        role="button"
        tabIndex={0}
        aria-expanded={isOpen}
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            setIsOpen((prev) => !prev)
          }
        }}
        className={clsx(
          'w-full flex items-center justify-between gap-2 px-3 py-2 bg-white border rounded-lg text-sm text-left transition-all',
          isOpen
            ? 'border-[#6353FF] ring-2 ring-[#6353FF] ring-opacity-30'
            : 'border-[#E0E0E1] hover:border-[#B0B5B5]'
        )}
      >
        <div className="flex-1 flex items-center gap-2 min-w-0 overflow-hidden">
          {prefix && <span className="text-[#5A5F5F] whitespace-nowrap">{prefix}</span>}
          <span className={selectedOption ? 'text-[#3F4444]' : 'text-[#B0B5B5]'}>
            {selectedLabel}
          </span>
        </div>
        <ChevronDown className={clsx(
          'w-4 h-4 text-[#8A8F8F] transition-transform',
          isOpen && 'rotate-180'
        )} />
      </div>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-[#E0E0E1] rounded-lg shadow-lg overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
          <div className="max-h-56 overflow-auto py-1">
            {options.map(option => {
              const isSelected = option.value === value
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    onChange(option.value)
                    setIsOpen(false)
                  }}
                  className={clsx(
                    'w-full px-3 py-2 text-sm text-left transition-colors',
                    isSelected
                      ? 'bg-[rgba(99,83,255,0.08)] text-[#6353FF]'
                      : 'hover:bg-[#F7F7F8] text-[#3F4444]'
                  )}
                >
                  {option.label}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
