import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  reactCompiler: true,
  turbopack: {
    root: path.resolve(__dirname),
    resolveAlias: {
      // Stub for @wagmi/core's optional Tempo 'accounts' dependency.
      // Turbopack can't handle unresolvable dynamic imports — webpack silently fails them.
      accounts: './src/stubs/accounts.ts',
    },
  },
  // stockfish is CommonJS and loads its own .wasm from disk at runtime. Bundling
  // it drops the wasm file, so it must resolve from node_modules instead.
  serverExternalPackages: ['stockfish'],
  // The ask route spawns scripts/stockfish-host.cjs as a child process, so the
  // script and the engine's wasm have to be traced into that function's bundle.
  // Nothing imports them, so tracing cannot discover them on its own.
  outputFileTracingIncludes: {
    '/api/coach/ask': [
      './tools/stockfish-host.cjs',
      './node_modules/stockfish/**',
    ],
  },
  transpilePackages: [
    'react-chessboard',
    'wagmi',
    '@wagmi/core',
    '@wagmi/connectors'
  ],
};

export default nextConfig;
