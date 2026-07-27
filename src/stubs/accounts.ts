const createAccountsStub = () => {
  // Turbopack requires all import() targets to resolve; this satisfies it.
  return {};
};

const accountsStub = createAccountsStub();
export default accountsStub;
