'use client'

/** Guard wallet-extension inject races (Phantom vs MetaMask, etc.). */
export function installEthereumShim(): void {
  if (typeof window === 'undefined') return
  if ((window as Window & { __pcEthereumShim?: boolean }).__pcEthereumShim) return
  ;(window as Window & { __pcEthereumShim?: boolean }).__pcEthereumShim = true

  window.addEventListener(
    'error',
    (event) => {
      const message = event?.message
      if (
        message &&
        (message.includes('Cannot redefine property: ethereum') ||
          message.includes('Cannot set property ethereum'))
      ) {
        event.preventDefault()
        return false
      }
    },
    true,
  )

  let current = window.ethereum
  try {
    Object.defineProperty(window, 'ethereum', {
      configurable: true,
      enumerable: true,
      get() {
        return current
      },
      set(next) {
        if (next) current = next
      },
    })
  } catch {
    // Another extension locked window.ethereum before us.
  }

  const nativeDefineProperty = Object.defineProperty
  Object.defineProperty = function (target, property, attributes) {
    if (target === window && property === 'ethereum') {
      try {
        const next =
          attributes && 'value' in attributes
            ? attributes.value
            : attributes?.get
              ? attributes.get.call(window)
              : undefined
        if (next) window.ethereum = next
        return target
      } catch {
        return target
      }
    }
    return nativeDefineProperty.call(Object, target, property, attributes)
  }
}

if (typeof window !== 'undefined') {
  installEthereumShim()
}
