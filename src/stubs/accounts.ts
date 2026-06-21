// Stub for @wagmi/core's optional Tempo 'accounts' dependency.
// Turbopack requires all import() targets to resolve; this satisfies it.
function createAccountsStub(): typeof accountsStub {
  return {};
}
const accountsStub = createAccountsStub();
export default accountsStub;
