import { create } from 'zustand'

export type ToastType = 'success' | 'error' | 'info' | 'invalid' | 'check' | 'checkmate' | 'draw'

const DEFAULT_DURATION: Record<ToastType, number> = {
  success: 4000,
  error: 4000,
  info: 3000,
  invalid: 2500,
  check: 3000,
  checkmate: 7000,
  draw: 5000,
}

interface Toast {
  message: string
  type: ToastType
  duration?: number
}

interface ToastState {
  toast: Toast | null
  showToast: (message: string, type: ToastType, duration?: number) => void
  hideToast: () => void
}

const getToastDuration = (type: ToastType, duration?: number): number => duration ?? DEFAULT_DURATION[type]

export const useToastStore = create<ToastState>((set) => ({
  toast: null,
  showToast: (message, type, duration) => {
    set({ toast: { message, type, duration: getToastDuration(type, duration) } })
  },
  hideToast: () => set({ toast: null }),
}))