export const CHESS_TOKEN_ABI = [
  { "type": "function", "name": "approve", "stateMutability": "nonpayable", "inputs": [{ "name": "spender", "type": "address" }, { "name": "amount", "type": "uint256" }], "outputs": [{ "type": "bool" }] },
  { "type": "function", "name": "balanceOf", "stateMutability": "view", "inputs": [{ "name": "account", "type": "address" }], "outputs": [{ "type": "uint256" }] },
  { "type": "function", "name": "allowance", "stateMutability": "view", "inputs": [{ "name": "owner", "type": "address" }, { "name": "spender", "type": "address" }], "outputs": [{ "type": "uint256" }] },
  { "type": "function", "name": "faucetClaim", "stateMutability": "nonpayable", "inputs": [], "outputs": [] },
  { "type": "function", "name": "lastFaucetClaim", "stateMutability": "view", "inputs": [{ "name": "account", "type": "address" }], "outputs": [{ "type": "uint256" }] },
  { "type": "function", "name": "faucetCooldownRemaining", "stateMutability": "view", "inputs": [{ "name": "account", "type": "address" }], "outputs": [{ "type": "uint256" }] },
  { "type": "error", "name": "FaucetCooldown", "inputs": [{ "name": "secondsRemaining", "type": "uint256" }] },
  { "type": "function", "name": "mintTo", "stateMutability": "nonpayable", "inputs": [{ "name": "to", "type": "address" }, { "name": "amount", "type": "uint256" }], "outputs": [] },
  { "type": "function", "name": "minter", "stateMutability": "view", "inputs": [], "outputs": [{ "type": "address" }] },
  { "type": "function", "name": "decimals", "stateMutability": "view", "inputs": [], "outputs": [{ "type": "uint8" }] },
  // ERC-2612 permit — gasless approvals for the *WithPermit game functions.
  { "type": "function", "name": "permit", "stateMutability": "nonpayable", "inputs": [{ "name": "owner", "type": "address" }, { "name": "spender", "type": "address" }, { "name": "value", "type": "uint256" }, { "name": "deadline", "type": "uint256" }, { "name": "v", "type": "uint8" }, { "name": "r", "type": "bytes32" }, { "name": "s", "type": "bytes32" }], "outputs": [] },
  { "type": "function", "name": "nonces", "stateMutability": "view", "inputs": [{ "name": "owner", "type": "address" }], "outputs": [{ "type": "uint256" }] },
  { "type": "function", "name": "DOMAIN_SEPARATOR", "stateMutability": "view", "inputs": [], "outputs": [{ "type": "bytes32" }] }
] as const

// OpenZeppelin ERC2771Forwarder — carries signed player actions so the
// gas-sponsor can execute them (Tier C gasless).
export const FORWARDER_ABI = [
  { "type": "function", "name": "execute", "stateMutability": "payable", "inputs": [{ "name": "request", "type": "tuple", "components": [
    { "name": "from", "type": "address" },
    { "name": "to", "type": "address" },
    { "name": "value", "type": "uint256" },
    { "name": "gas", "type": "uint256" },
    { "name": "deadline", "type": "uint48" },
    { "name": "data", "type": "bytes" },
    { "name": "signature", "type": "bytes" }
  ]}], "outputs": [] },
  { "type": "function", "name": "verify", "stateMutability": "view", "inputs": [{ "name": "request", "type": "tuple", "components": [
    { "name": "from", "type": "address" },
    { "name": "to", "type": "address" },
    { "name": "value", "type": "uint256" },
    { "name": "gas", "type": "uint256" },
    { "name": "deadline", "type": "uint48" },
    { "name": "data", "type": "bytes" },
    { "name": "signature", "type": "bytes" }
  ]}], "outputs": [{ "type": "bool" }] },
  { "type": "function", "name": "nonces", "stateMutability": "view", "inputs": [{ "name": "owner", "type": "address" }], "outputs": [{ "type": "uint256" }] }
] as const

export const CHESS_GAME_ABI = [
  { "type": "function", "name": "createGame", "stateMutability": "nonpayable", "inputs": [{ "name": "wager", "type": "uint256" }], "outputs": [{ "name": "gameId", "type": "uint256" }] },
  { "type": "function", "name": "createGameWithPermit", "stateMutability": "nonpayable", "inputs": [{ "name": "wager", "type": "uint256" }, { "name": "deadline", "type": "uint256" }, { "name": "v", "type": "uint8" }, { "name": "r", "type": "bytes32" }, { "name": "s", "type": "bytes32" }], "outputs": [{ "name": "gameId", "type": "uint256" }] },
  { "type": "function", "name": "joinGame", "stateMutability": "nonpayable", "inputs": [{ "name": "gameId", "type": "uint256" }], "outputs": [] },
  { "type": "function", "name": "joinGameWithPermit", "stateMutability": "nonpayable", "inputs": [{ "name": "gameId", "type": "uint256" }, { "name": "deadline", "type": "uint256" }, { "name": "v", "type": "uint8" }, { "name": "r", "type": "bytes32" }, { "name": "s", "type": "bytes32" }], "outputs": [] },
  { "type": "function", "name": "resign", "stateMutability": "nonpayable", "inputs": [{ "name": "gameId", "type": "uint256" }], "outputs": [] },
  { "type": "function", "name": "proposeDraw", "stateMutability": "nonpayable", "inputs": [{ "name": "gameId", "type": "uint256" }], "outputs": [] },
  { "type": "function", "name": "acceptDraw", "stateMutability": "nonpayable", "inputs": [{ "name": "gameId", "type": "uint256" }], "outputs": [] },
  { "type": "function", "name": "cancelGame", "stateMutability": "nonpayable", "inputs": [{ "name": "gameId", "type": "uint256" }], "outputs": [] },
  { "type": "function", "name": "closeStaleGame", "stateMutability": "nonpayable", "inputs": [{ "name": "gameId", "type": "uint256" }], "outputs": [] },
  { "type": "function", "name": "settleGame", "stateMutability": "nonpayable", "inputs": [{ "name": "gameId", "type": "uint256" }, { "name": "result", "type": "uint8" }], "outputs": [] },
  { "type": "function", "name": "voidGame", "stateMutability": "nonpayable", "inputs": [{ "name": "gameId", "type": "uint256" }], "outputs": [] },
  { "type": "function", "name": "reclaimExpired", "stateMutability": "nonpayable", "inputs": [{ "name": "gameId", "type": "uint256" }], "outputs": [] },
  { "type": "function", "name": "setOracle", "stateMutability": "nonpayable", "inputs": [{ "name": "newOracle", "type": "address" }], "outputs": [] },
  { "type": "function", "name": "oracle", "stateMutability": "view", "inputs": [], "outputs": [{ "type": "address" }] },
  { "type": "function", "name": "getGame", "stateMutability": "view", "inputs": [{ "name": "gameId", "type": "uint256" }], "outputs": [{ "type": "tuple", "components": [
    { "name": "white", "type": "address" },
    { "name": "black", "type": "address" },
    { "name": "wager", "type": "uint256" },
    { "name": "status", "type": "uint8" },
    { "name": "result", "type": "uint8" },
    { "name": "createdAt", "type": "uint256" },
    { "name": "joinedAt", "type": "uint256" },
    { "name": "drawProposer", "type": "address" }
  ]}] },
  { "type": "function", "name": "canJoin", "stateMutability": "view", "inputs": [{ "name": "gameId", "type": "uint256" }], "outputs": [{ "type": "bool" }] },
  { "type": "function", "name": "canReclaim", "stateMutability": "view", "inputs": [{ "name": "gameId", "type": "uint256" }], "outputs": [{ "type": "bool" }] },
  { "type": "function", "name": "playerStats", "stateMutability": "view", "inputs": [{ "name": "player", "type": "address" }], "outputs": [{ "type": "uint256", "name": "wins" }, { "type": "uint256", "name": "losses" }, { "type": "uint256", "name": "draws" }, { "type": "uint256", "name": "rating" }, { "type": "uint256", "name": "gamesPlayed" }] },
  { "type": "function", "name": "gameNonce", "stateMutability": "view", "inputs": [], "outputs": [{ "type": "uint256" }] },
  { "type": "event", "name": "GameCreated", "inputs": [{ "name": "gameId", "type": "uint256", "indexed": true }, { "name": "white", "type": "address", "indexed": true }, { "name": "wager", "type": "uint256", "indexed": false }] },
  { "type": "event", "name": "GameJoined", "inputs": [{ "name": "gameId", "type": "uint256", "indexed": true }, { "name": "black", "type": "address", "indexed": true }] },
  { "type": "event", "name": "GameSettled", "inputs": [{ "name": "gameId", "type": "uint256", "indexed": true }, { "name": "result", "type": "uint8", "indexed": false }, { "name": "winner", "type": "address", "indexed": false }] },
  { "type": "event", "name": "StaleGameClosed", "inputs": [{ "name": "gameId", "type": "uint256", "indexed": true }, { "name": "by", "type": "address", "indexed": true }] },
  { "type": "event", "name": "GameVoided", "inputs": [{ "name": "gameId", "type": "uint256", "indexed": true }] }
] as const
