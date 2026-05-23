'use client'

import { useToastStore } from '@/hooks/useToastStore'
import { motion, AnimatePresence } from 'framer-motion'
import { useEffect } from 'react'

export default function CenterToast() {
  const { toast, hideToast } = useToastStore()

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => {
        hideToast()
      }, toast.duration || 4000)
      return () => clearTimeout(timer)
    }
  }, [toast, hideToast])

  return (
    <AnimatePresence>
      {toast && (
        <div className="fixed inset-0 pointer-events-none z-[9999] flex items-center justify-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: -15 }}
            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
            className="pointer-events-auto max-w-sm w-full mx-4 px-6 py-5 rounded-[24px] shadow-[0_24px_50px_rgba(0,0,0,0.6)] border backdrop-blur-xl flex flex-col items-center text-center gap-3"
            style={{
              background: toast.type === 'error'
                ? 'linear-gradient(135deg, rgba(220, 38, 38, 0.15) 0%, rgba(127, 29, 29, 0.45) 100%)'
                : 'linear-gradient(135deg, rgba(6, 182, 212, 0.15) 0%, rgba(8, 47, 73, 0.45) 100%)',
              borderColor: toast.type === 'error' ? 'rgba(220, 38, 38, 0.4)' : 'rgba(6, 182, 212, 0.4)',
              boxShadow: toast.type === 'error'
                ? '0 0 30px rgba(220, 38, 38, 0.25)'
                : '0 0 30px rgba(6, 182, 212, 0.25)'
            }}
          >
            <div className="flex items-center gap-2">
              {toast.type === 'error' ? (
                <svg className="w-6 h-6 text-red-500 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              ) : (
                <svg className="w-6 h-6 text-cyan-400 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
              <span className="text-[10px] font-black uppercase tracking-[0.25em]" style={{ color: toast.type === 'error' ? '#ef4444' : '#22d3ee', fontFamily: 'var(--fd)' }}>
                {toast.type === 'error' ? 'SYSTEM ERROR' : 'TRANSACTION COMPLETE'}
              </span>
            </div>
            <p className="text-sm font-semibold text-gray-100 tracking-wide leading-relaxed">
              {toast.message}
            </p>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
