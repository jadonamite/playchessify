import { create } from 'zustand'

export type ToastType = 'success' | 'error' | 'info'

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

export const useToastStore = create<ToastState>((set) => ({
  toast: null,
  showToast: (message, type, duration = 4000) => {
    set({ toast: { message, type, duration } })
  },
  hideToast: () => set({ toast: null }),
}))
