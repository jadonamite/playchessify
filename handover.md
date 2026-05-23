# Handover: Reown & Web3Auth Social Login Integration

This document outlines the root causes of the failures in social logins (Reown/Web3Auth), the steps taken to resolve them, and how to verify or configure the application going forward.

## The Problems Identified

### 1. Web3Auth Custom Connector Initialization Bug (`init` vs `initModal`)
* **Problem**: In `src/lib/web3auth-connector.ts`, the custom connector was calling `instance.init()` inside its `setup` and `isAuthorized` methods. 
* **Details**: Because the app imports `Web3Auth` from `@web3auth/modal` (the plug-and-play UI modal SDK), it is required to call `instance.initModal()` instead of `instance.init()`. Using the generic `init()` method failed to set up or prepare the modal UI, making subsequent calls to `instance.connect()` fail silently.
* **Resolution**: Updated `src/lib/web3auth-connector.ts` to call `instance.initModal()`.

### 2. Missing Environment Variables (`NEXT_PUBLIC_WEB3AUTH_CLIENT_ID`)
* **Problem**: The Web3Auth client initialization requires a valid `clientId`. In the local configuration, `NEXT_PUBLIC_WEB3AUTH_CLIENT_ID` was completely missing from the `.env` file, causing `process.env.NEXT_PUBLIC_WEB3AUTH_CLIENT_ID!` to evaluate to `undefined` and throw initialization crashes.
* **Resolution**: Added a robust fallback mechanism in `src/config/web3auth.ts`:
  - If the environment variable is missing, it falls back to a sandbox client ID: `BHgArYmWwSeq21czpcarYh0EVq2WWOzflX-NTK-tY1-1pauPzHKRRLgpABkmYiIV_og9jAvoIxQ8L3Smrwe04Lw`.
  - To prevent client ID mismatch errors, it automatically configures the network to `SAPPHIRE_DEVNET` when utilizing the fallback client ID, and `SAPPHIRE_MAINNET` when the developer provides their own client ID.

### 3. Reown Native Email/Socials Were Disabled
* **Problem**: The built-in Reown AppKit social/email features (which run directly inside the Reown modal and do not depend on the Web3Auth client config) were explicitly set to `email: false` and `socials: []` in `src/config/reown.ts`.
* **Resolution**: Enabled native socials in `src/config/reown.ts` by setting `email: true` and configuring the `socials` array: `['google', 'x', 'github', 'discord', 'apple']`.

---

## Verification & Build
The project was fully built via `npm run build` to ensure no bundling or TypeScript compilation errors were introduced.
* **Compilation Status**: Successfully compiled and optimized in production bundle.
* **Pushed Status**: The changes to both `src/config/reown.ts`, `src/config/web3auth.ts`, and `src/lib/web3auth-connector.ts` have been pushed to GitHub on branch `main`.

---

## How to Configure in Production

### 1. For Custom Web3Auth Button (Social Login Button in Modal)
For production, you should register your domain on the [Web3Auth Dashboard](https://dashboard.web3auth.io/) and configure:
```env
NEXT_PUBLIC_WEB3AUTH_CLIENT_ID=your_production_client_id
```
When this environment variable is present, the app automatically runs on Web3Auth's `SAPPHIRE_MAINNET`.

### 2. For Reown Native Social Login (Inside AppKit modal when choosing Celo)
Ensure your Reown project is configured on the [Reown Cloud Dashboard](https://cloud.reown.com/) and that the `NEXT_PUBLIC_REOWN_PROJECT_ID` is correctly configured in your deployment environment. No additional client IDs or domain whitelists are needed for Reown's native socials.
