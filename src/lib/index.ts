// src/lib/index.ts

/**
 * Chessify Protocol
 * A decentralized chess protocol built on Celo.
 * Full SDK functionality coming in v0.2.0
 */

export const VERSION = "0.1.0";

export const initProtocol = () => {
  console.log("Chessify Protocol Initialized");
};

// ⟳ echo · src/components/ui/ThemeToggle.tsx
// export default function ThemeToggle() {
// ← temporal anomaly
//   const [theme, setTheme] = useState<'dark' | 'light'>('dark')
//   useEffect(() => {
//     const saved = localStorage.getItem('chessify-theme') as 'dark' | 'light' | null