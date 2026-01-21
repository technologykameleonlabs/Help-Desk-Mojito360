import type { ReactNode } from 'react'

type ConfirmModalProps = {
  open: boolean
  title: string
  description?: ReactNode
  confirmText?: string
  cancelText?: string
  onConfirm: () => void
  onCancel: () => void
  isConfirming?: boolean
}

export function ConfirmModal({
  open,
  title,
  description,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  onConfirm,
  onCancel,
  isConfirming = false,
}: ConfirmModalProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onCancel}
        role="button"
        tabIndex={-1}
        aria-label="Cerrar modal"
      />
      <div className="relative bg-white rounded-2xl shadow-xl border border-[#E0E0E1] w-full max-w-md mx-4">
        <div className="p-6 space-y-4">
          <h3 className="text-lg font-semibold text-[#3F4444]">{title}</h3>
          {description && <div className="text-sm text-[#5A5F5F]">{description}</div>}
        </div>
        <div className="px-6 pb-6 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-[#8A8F8F] hover:text-[#3F4444] hover:bg-[#F7F7F8] rounded-xl transition-colors"
            disabled={isConfirming}
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-4 py-2 text-sm font-semibold bg-[#6353FF] hover:bg-[#5244e6] text-white rounded-xl transition-colors disabled:opacity-50"
            disabled={isConfirming}
          >
            {isConfirming ? 'Guardando...' : confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}
