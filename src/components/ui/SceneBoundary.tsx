'use client'

import React from 'react'

interface Props {
  children: React.ReactNode
  /** Rendered instead of the 3D scene if it fails. Defaults to nothing (transparent). */
  fallback?: React.ReactNode
}
interface State {
  failed: boolean
}

/**
 * Catches react-three-fiber / WebGL failures so a dead or exhausted GL context
 * degrades to "no 3D background" instead of throwing during render and unmounting
 * the entire page (the faucet black-screen). The specific crash this guards is
 * r3f's mount wiring against a lost context:
 *   "Cannot read properties of null (reading 'addEventListener')" at connect/onCreated.
 *
 * Wrap every <Canvas> in this. Worst case the decorative scene is missing; the
 * actual page UI keeps rendering.
 */
export class SceneBoundary extends React.Component<Props, State> {
  state: State = { failed: false }

  static getDerivedStateFromError(): State {
    return { failed: true }
  }

  componentDidCatch(error: unknown) {
    console.warn('[SceneBoundary] 3D scene failed — hiding it, page stays up.', error)
  }

  render() {
    if (this.state.failed) return this.props.fallback ?? null
    return this.props.children
  }
}

export default SceneBoundary
