import { utils, providers, Contract } from 'ethers'
import contracts from './lib/contracts'
import tokens from './lib/tokens'
import { decodeTx, ExactOutputSingle } from './lib/uniswap'

const provider = new providers.JsonRpcProvider("http://192.168.0.42:7777")
const uniswapV3Factory = new Contract(contracts.UniswapV3Factory.address, contracts.UniswapV3Factory.abi, provider)
const sushiswapFactory = new Contract(contracts.SushiswapFactory.address, contracts.SushiswapFactory.abi, provider)

const testPoolAddresses = async () => {
    const uniPoolAddress3k = await uniswapV3Factory.getPool(tokens.DAI.address, tokens.WETH.address, 3000)
    const uniPoolAddress10k = await uniswapV3Factory.getPool(tokens.DAI.address, tokens.WETH.address, 10000)
    console.log("UNI pool address 3k", uniPoolAddress3k)
    console.log("UNI pool address 10k", uniPoolAddress10k)
    
    const sushiPoolAddressDaiWeth = await sushiswapFactory.getPair(tokens.DAI.address, tokens.WETH.address)
    const sushiPoolAddressWethDai = await sushiswapFactory.getPair(tokens.WETH.address, tokens.DAI.address)
    console.log("SUSHI pair address (DAI,WETH)", sushiPoolAddressDaiWeth)
    console.log("SUSHI pair address (WETH,DAI)", sushiPoolAddressWethDai)
}

const testMulticallDecode = () => {
    const txHash = "0x6b059739e1c53523982a687f1b998103377a72e0a65ea0598ceb177ade022da7"
    const calldata = "0x5ae401dc000000000000000000000000000000000000000000000000000000006348adff000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000040000000000000000000000000000000000000000000000000000000000000016000000000000000000000000000000000000000000000000000000000000000e45023b4df000000000000000000000000626e8036deb333b408be468f951bdb42433cbf18000000000000000000000000c02aaa39b223fe8d0a0e5c4f27ead9083c756cc200000000000000000000000000000000000000000000000000000000000027100000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000008c550a6ca0c00000000000000000000000000000000000000000000000003798737e57650b0e25000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000004449404b7c000000000000000000000000000000000000000000000000008c550a6ca0c00000000000000000000000000038c350599a55343df6b38c3667ebaa04f7af2bfc00000000000000000000000000000000000000000000000000000000"
    const decodedTx = decodeTx(calldata) as ExactOutputSingle
    console.log("txHash", txHash)
    console.log("decoded", decodedTx)
    console.log("amountOut", decodedTx.amountOut.toString())
    console.log("amountIn", decodedTx.amountInMaximum.toString())
}

async function main() {
    // testPoolAddresses()
    testMulticallDecode()
}

main()
