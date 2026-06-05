import { createPublicClient, http, formatUnits, parseAbiItem, getAddress } from 'viem'
const GAME='0xf85f00D39A84b5180390548Ea9f76B0458607E78', TOKEN='0xE370aad742dF8DC8Ae9c0F0b9f265334D39e2197'
const c = createPublicClient({ transport: http('https://forno.celo.org') })
const gameAbi=[{type:'function',name:'games',stateMutability:'view',inputs:[{type:'uint256'}],outputs:[
 {name:'white',type:'address'},{name:'black',type:'address'},{name:'wager',type:'uint256'},
 {name:'status',type:'uint8'},{name:'result',type:'uint8'},{name:'turn',type:'address'},
 {name:'moveCount',type:'uint256'},{name:'createdAt',type:'uint256'},{name:'lastMoveBlock',type:'uint256'},{name:'drawProposer',type:'address'}]}]
const transfer = parseAbiItem('event Transfer(address indexed from,address indexed to,uint256 value)')
const latest = await c.getBlockNumber()
// finished wagered games to verify: id -> expected winner side
const ids=[1170,1173,1174,1175]
for(const id of ids){
  const g=await c.readContract({address:GAME,abi:gameAbi,functionName:'games',args:[BigInt(id)]})
  const [white,black,wager,status,result,,,createdAt,lastMoveBlock]=g
  const winner = Number(result)===1?white:Number(result)===2?black:null
  const w=formatUnits(wager,6)
  console.log(`\n#${id} wager=${w} result=${['None','White','Black','Draw','Cxl'][result]} winner=${winner} createdAt=${createdAt} lastMove=${lastMoveBlock}`)
  if(!winner) continue
  // search a window from lastMoveBlock forward for Transfers TO winner from GAME
  const fromB=BigInt(lastMoveBlock), toB= (fromB+200000n>latest)?latest:fromB+200000n
  let found=[]
  for(let s=fromB;s<=toB;s+=5001n){
    const e=(s+5000n>toB)?toB:s+5000n
    try{
      const logs=await c.getLogs({address:TOKEN,event:transfer,args:{to:getAddress(winner)},fromBlock:s,toBlock:e})
      for(const l of logs) if(l.args.from.toLowerCase()===GAME.toLowerCase()) found.push({blk:l.blockNumber,amt:formatUnits(l.args.value,6)})
    }catch(err){ console.log('  range err',s,e,String(err).slice(0,60)) }
  }
  if(found.length===0) console.log('  ⚠️ NO payout transfer found from game→winner in window')
  for(const f of found) console.log(`  payout: ${f.amt} CHESS @block ${f.blk}  ${Number(f.amt)===Number(w)*2?'✅ 2x pot':Number(f.amt)===Number(w)?'❌ ONLY 1x (wager refund)':'?'}`)
}
