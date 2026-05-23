# Handover: Reown & Web3Auth Social Login Integration & Core Lobby Fixes

This document outlines the root causes of the failures in social logins (Reown/Web3Auth), the steps taken to resolve them, and the active requirements being addressed.

## The Problems Identified

### 1. Web3Auth Custom Connector Initialization Bug (`init` vs `initModal`)
* **Problem**: In `src/lib/web3auth-connector.ts`, the custom connector was calling `instance.init()` inside its `setup` and `isAuthorized` methods. 
* **Details**: Because the app imports `Web3Auth` from `@web3auth/modal` (the plug-and-play UI modal SDK), it is required to call `instance.initModal()` instead of `instance.init()`. Using the generic `init()` method failed to set up or prepare the modal UI, making subsequent calls to `instance.connect()` fail silently.
* **Resolution**: Updated `src/lib/web3auth-connector.ts` to call `instance.initModal()`.

### 2. Missing Environment Variables (`NEXT_PUBLIC_WEB3AUTH_CLIENT_ID`)
* **Problem**: The Web3Auth client initialization requires a valid `clientId`. In the local configuration, `NEXT_PUBLIC_WEB3AUTH_CLIENT_ID` was completely missing from the `.env` file, causing `process.env.NEXT_PUBLIC_WEB3AUTH_CLIENT_ID!` to evaluate to `undefined` and throw initialization crashes.
* **Resolution**: Added a robust fallback mechanism in `src/config/web3auth.ts`.

### 3. Reown Native Email/Socials Were Disabled
* **Problem**: The built-in Reown AppKit social/email features (which run directly inside the Reown modal and do not depend on the Web3Auth client config) were explicitly set to `email: false` and `socials: []` in `src/config/reown.ts`.
* **Resolution**: Enabled native socials in `src/config/reown.ts`.

---

## Active Tasks & Requirements Under Implementation

### 1. Automatic Redirect to Lobby
* When a user is authenticated/connected, they should be automatically redirected to the lobby (`/app/lobby`) without having to click the landing page button or link a second time.

### 2. Centralized Center-Middle Toast System
* Implement a centralized toast notification system (using Zustand + Framer Motion) that displays all error and success messages at the exact center-middle of the screen.

### 3. CHESS Token Balance Check
* Add a check function to ensure the user has sufficient CHESS tokens to spend before initiating a wager. If the balance is insufficient, throw an error to the centralized toast system.

### 4. Select Wager Modal UI Improvements
* Refine the select wager modal user interface for a premium look and feel.

### 5. Multi-Step Confirmation Modal (Approve + Spend)
* When a user selects a wager, display a confirmation modal with a loading state showing "Confirm in your wallet" for the blockchain transactions.
* **Resolve the Approve/Spend Sticking Bug**: During match creation, ensure that after approving the token spending limit, the second transaction is triggered to actually spend/lock the CHESS tokens (creating the match on-chain), preventing the user from getting stuck.
