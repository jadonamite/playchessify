// src/lib/index.ts
/**
 * Chessify Protocol
 * A decentralized chess protocol built on Celo.
 * Full SDK functionality coming in v0.2.0
 */
export const VERSION = "0.1.0";

const logMessage = (message: string) => {
  console.log(message);
};

export const initProtocol = () => {
  logMessage("Chessify Protocol Initialized");
};
