// scratch/gen-wallets.cjs — one-off wallet generator for oracle / minter / gas-sponsor.
// Run: node scratch/gen-wallets.cjs   (DELETE output from history after saving keys)
const { generateMnemonic, mnemonicToAccount } = require('viem/accounts')
const { english } = require('viem/accounts')

function make(label) {
  const mnemonic = generateMnemonic(english)
  const account = mnemonicToAccount(mnemonic)
  // private key of the first derivation path account
  const pk = account.getHdKey().privateKey
  const hex = '0x' + Buffer.from(pk).toString('hex')
  return { label, address: account.address, privateKey: hex, mnemonic }
}

for (const w of [make('ORACLE'), make('MINTER'), make('GAS_SPONSOR')]) {
  console.log('\n===== ' + w.label + ' =====')
  console.log('address    :', w.address)
  console.log('privateKey :', w.privateKey)
  console.log('mnemonic   :', w.mnemonic)
}
console.log('\n(Generated locally with viem. Save these to a password manager, then `rm scratch/gen-wallets.cjs` and clear terminal scrollback.)')
