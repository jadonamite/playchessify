import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactCompiler: true,
  turbopack: {
    root: path.resolve(__dirname),
    resolveAlias: {
      // Stub for @wagmi/core's optional Tempo 'accounts' dependency.
      // Turbopack can't handle unresolvable dynamic imports — webpack silently fails them.
      accounts: './src/stubs/accounts.ts',
    },
  },
  transpilePackages: [
    'react-chessboard',
    'wagmi',
    '@wagmi/core',
    '@wagmi/connectors'
  ],
};

export default nextConfig;
