// scratch/smoke-onchain.cjs — end-to-end on-chain smoke test of the live Celo contracts.
// White & black (ephemeral) → faucetClaim → approve → createGame/joinGame → ORACLE settleGame → verify payout + Elo.
// Keys: master from Scripts/.env (funds gas); ORACLE_PRIVATE_KEY passed via env at runtime.
// Run: ORACLE_PRIVATE_KEY=0x... node scratch/smoke-onchain.cjs
const fs = require('fs'); const path = require('path')
const { createWalletClient, createPublicClient, http, parseEther, formatUnits, getAddress, parseEventLogs } = require('viem')
const { privateKeyToAccount, generatePrivateKey } = require('viem/accounts')
const { celo } = require('viem/chains')

const RPC = 'https://forno.celo.org'
const TOKEN = getAddress('0x3F7eFDFc8A76F76F22512fcd2bddC5fCa36e55A3')
const GAME  = getAddress('0xb37877A9EBD6C3169b2eAAa3E16852839785aE85')
const WAGER = 10_000000n // 10 CHESS (6 decimals)

const tokenAbi = [
  { type:'function', name:'faucetClaim', stateMutability:'nonpayable', inputs:[], outputs:[] },
  { type:'function', name:'approve', stateMutability:'nonpayable', inputs:[{name:'s',type:'address'},{name:'a',type:'uint256'}], outputs:[{type:'bool'}] },
  { type:'function', name:'balanceOf', stateMutability:'view', inputs:[{name:'a',type:'address'}], outputs:[{type:'uint256'}] },
]
const gameAbi = [
  { type:'function', name:'createGame', stateMutability:'nonpayable', inputs:[{name:'wager',type:'uint256'}], outputs:[{name:'gameId',type:'uint256'}] },
  { type:'function', name:'joinGame', stateMutability:'nonpayable', inputs:[{name:'gameId',type:'uint256'}], outputs:[] },
  { type:'function', name:'settleGame', stateMutability:'nonpayable', inputs:[{name:'gameId',type:'uint256'},{name:'result',type:'uint8'}], outputs:[] },
  { type:'event', name:'GameCreated', inputs:[{name:'gameId',type:'uint256',indexed:true},{name:'white',type:'address',indexed:true},{name:'wager',type:'uint256'}] },
  { type:'function', name:'getGame', stateMutability:'view', inputs:[{name:'id',type:'uint256'}], outputs:[{type:'tuple',components:[
    {name:'white',type:'address'},{name:'black',type:'address'},{name:'wager',type:'uint256'},{name:'status',type:'uint8'},{name:'result',type:'uint8'},{name:'createdAt',type:'uint256'},{name:'drawProposer',type:'address'}]}] },
  { type:'function', name:'getPlayerStats', stateMutability:'view', inputs:[{name:'p',type:'address'}], outputs:[{type:'tuple',components:[
    {name:'wins',type:'uint256'},{name:'losses',type:'uint256'},{name:'draws',type:'uint256'},{name:'rating',type:'uint256'},{name:'gamesPlayed',type:'uint256'}]}] },
]

function masterKey(){ const e=fs.readFileSync(path.join(process.env.HOME,'Projects/Scripts/.env'),'utf8'); const m=e.match(/^EVM_MASTER_PRIVATE_KEY=(.+)$/m); let k=m[1].trim(); return k.startsWith('0x')?k:'0x'+k }
const pub = createPublicClient({ chain: celo, transport: http(RPC) })
const wc = (acct)=> createWalletClient({ account: acct, chain: celo, transport: http(RPC) })
const send = async (label, hash)=>{ process.stdout.write(`  ${label}: ${hash.slice(0,14)}… `); const r=await pub.waitForTransactionReceipt({hash}); console.log(r.status); if(r.status!=='success') throw new Error(label+' reverted'); return r }
const chess = (v)=> formatUnits(v,6)

async function main(){
  const oraclePk = process.env.ORACLE_PRIVATE_KEY
  if(!oraclePk) throw new Error('ORACLE_PRIVATE_KEY env required')
  const oracle = privateKeyToAccount(oraclePk)
  const master = privateKeyToAccount(masterKey())
  const white = privateKeyToAccount(generatePrivateKey())
  const black = privateKeyToAccount(generatePrivateKey())
  console.log('White:', white.address, '\nBlack:', black.address, '\nOracle:', oracle.address, '\n')

  // 1. gas-fund both players from master
  console.log('Funding players with gas (0.3 CELO each):')
  for(const [n,p] of [['white',white],['black',black]]){
    await send(`fund ${n}`, await wc(master).sendTransaction({ to:p.address, value:parseEther('0.3') }))
  }

  // 2. faucet + approve + create/join
  console.log('\nWhite: faucet → approve → createGame:')
  await send('faucet', await wc(white).writeContract({ address:TOKEN, abi:tokenAbi, functionName:'faucetClaim' }))
  await send('approve', await wc(white).writeContract({ address:TOKEN, abi:tokenAbi, functionName:'approve', args:[GAME, WAGER] }))
  const createR = await send('createGame', await wc(white).writeContract({ address:GAME, abi:gameAbi, functionName:'createGame', args:[WAGER] }))
  const ev = parseEventLogs({ abi:gameAbi, eventName:'GameCreated', logs:createR.logs })[0]
  const gameId = ev.args.gameId
  console.log('  → gameId', gameId.toString())

  console.log('\nBlack: faucet → approve → joinGame:')
  await send('faucet', await wc(black).writeContract({ address:TOKEN, abi:tokenAbi, functionName:'faucetClaim' }))
  await send('approve', await wc(black).writeContract({ address:TOKEN, abi:tokenAbi, functionName:'approve', args:[GAME, WAGER] }))
  await send('joinGame', await wc(black).writeContract({ address:GAME, abi:gameAbi, functionName:'joinGame', args:[gameId] }))

  const whiteBefore = await pub.readContract({ address:TOKEN, abi:tokenAbi, functionName:'balanceOf', args:[white.address] })

  // 3. ORACLE settles White wins (result=1)
  console.log('\nOracle: settleGame(WhiteWins):')
  await send('settleGame', await wc(oracle).writeContract({ address:GAME, abi:gameAbi, functionName:'settleGame', args:[gameId, 1] }))

  // 4. verify
  const g = await pub.readContract({ address:GAME, abi:gameAbi, functionName:'getGame', args:[gameId] })
  const whiteAfter = await pub.readContract({ address:TOKEN, abi:tokenAbi, functionName:'balanceOf', args:[white.address] })
  const ws = await pub.readContract({ address:GAME, abi:gameAbi, functionName:'getPlayerStats', args:[white.address] })
  const bs = await pub.readContract({ address:GAME, abi:gameAbi, functionName:'getPlayerStats', args:[black.address] })
  const pot = whiteAfter - whiteBefore

  console.log('\n=== RESULT ===')
  console.log('game.status  =', g.status, '(expect 2 Finished)')
  console.log('game.result  =', g.result, '(expect 1 WhiteWins)')
  console.log('pot to white =', chess(pot), 'CHESS (expect 20)')
  console.log('white stats  : wins', ws.wins.toString(), 'rating', ws.rating.toString())
  console.log('black stats  : losses', bs.losses.toString(), 'rating', bs.rating.toString())
  const ok = g.status===2 && g.result===1 && pot===WAGER*2n && ws.wins===1n
  console.log('\n' + (ok ? '✅ ON-CHAIN SMOKE TEST PASSED' : '❌ MISMATCH — inspect above'))
}
main().catch(e=>{ console.error('ERROR:', e.shortMessage||e.message); process.exit(1) })
