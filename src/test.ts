import { utils, providers, Contract, UnsignedTransaction, Transaction, Wallet, BigNumber } from 'ethers'
import contracts from './lib/contracts'
import { getPoolAddresses } from './lib/helpers'
import tokens from './lib/tokens'
import { decodeTx, ExactOutputSingle } from './lib/uniswap'

const BR_ABI = [
    {
      "inputs": [],
      "stateMutability": "nonpayable",
      "type": "constructor"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "_sushiPair",
          "type": "address"
        },
        {
          "internalType": "address",
          "name": "_uniPool",
          "type": "address"
        },
        {
          "internalType": "address",
          "name": "_token",
          "type": "address"
        },
        {
          "internalType": "bool",
          "name": "sushiZeroForOne",
          "type": "bool"
        },
        {
          "internalType": "bool",
          "name": "uniZeroForOne",
          "type": "bool"
        },
        {
          "internalType": "int256",
          "name": "buyAmount",
          "type": "int256"
        },
        {
          "internalType": "uint160",
          "name": "uniSqrtPriceLimitX96",
          "type": "uint160"
        }
      ],
      "name": "execute",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        }
      ],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "liquidate",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    }
]

// const provider = new providers.JsonRpcProvider("http://192.168.0.42:7777")
const provider = new providers.JsonRpcProvider("http://localhost:8545")
const sender = new Wallet("0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80", provider)
const uniswapV3Factory = new Contract(contracts.UniswapV3Factory.address, contracts.UniswapV3Factory.abi, provider)
const sushiswapFactory = new Contract(contracts.SushiswapFactory.address, contracts.SushiswapFactory.abi, provider)
const WETH = new Contract(tokens.WETH.address, contracts.IERC20.abi, provider)

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
    // note: tx included in block 15742640
    const txHash = "0x6b059739e1c53523982a687f1b998103377a72e0a65ea0598ceb177ade022da7"
    const calldata = "0x5ae401dc000000000000000000000000000000000000000000000000000000006348adff000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000040000000000000000000000000000000000000000000000000000000000000016000000000000000000000000000000000000000000000000000000000000000e45023b4df000000000000000000000000626e8036deb333b408be468f951bdb42433cbf18000000000000000000000000c02aaa39b223fe8d0a0e5c4f27ead9083c756cc200000000000000000000000000000000000000000000000000000000000027100000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000008c550a6ca0c00000000000000000000000000000000000000000000000003798737e57650b0e25000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000004449404b7c000000000000000000000000000000000000000000000000008c550a6ca0c00000000000000000000000000038c350599a55343df6b38c3667ebaa04f7af2bfc00000000000000000000000000000000000000000000000000000000"
    const decodedTx = decodeTx(calldata) as ExactOutputSingle
    console.log("txHash", txHash)
    console.log("decoded", decodedTx)
    console.log("amountOut", decodedTx.amountOut.toString())
    console.log("amountIn", decodedTx.amountInMaximum.toString())
}

const testBackrunExecutor = async () => {
    const backrunContract = new Contract("0x4951a1c579039ebfcba0be33d2cd3a6d30b0f802", BR_ABI, provider)
    const uniswapFactory = new Contract(contracts.UniswapV3Factory.address, contracts.UniswapV3Factory.abi, provider)
    const sushiswapFactory = new Contract(contracts.SushiswapFactory.address, contracts.SushiswapFactory.abi, provider)
    
    const startWethBalance = await WETH.balanceOf(sender.address)

    const mempoolTxOrigin = await provider.getTransaction("0x6b059739e1c53523982a687f1b998103377a72e0a65ea0598ceb177ade022da7")
    delete mempoolTxOrigin.gasPrice
    const mempoolTx: UnsignedTransaction = mempoolTxOrigin
    const {r, s, v} = mempoolTxOrigin
    
    const decodedTx = decodeTx(mempoolTxOrigin.data)
    console.log("decodedTx", decodedTx)
    if (!decodedTx) {
        console.error("tx decode failed")
        return
    }
    const { uniPoolAddress, sushiPoolAddress } = await getPoolAddresses(decodedTx, sushiswapFactory, uniswapFactory)
    const uniPool = new Contract(uniPoolAddress, contracts.IUniswapV3Pool.abi, provider)
    const sushiPool = new Contract(sushiPoolAddress, contracts.ISushiswapV3Pair.abi, provider)
    const tokenAddress = decodedTx.tokenIn // will always be tokenIn bc we filter by (tokenOut == WETH)
    const uniZeroForOne = (await uniPool.token0) === tokens.WETH.address
    const sushiZeroForOne = (await sushiPool.token0) === tokenAddress
    const buyAmount = (decodedTx as ExactOutputSingle).amountInMaximum

    console.log("initialized backrun params", {
        uniPoolAddress,
        sushiPoolAddress,
        tokenAddress,
        uniZeroForOne,
        sushiZeroForOne,
        buyAmount,
    })

    const backrunTx = {
        ...await backrunContract.populateTransaction.execute(
            sushiPoolAddress,
            uniPoolAddress,
            tokenAddress,
            sushiZeroForOne,
            uniZeroForOne,
            buyAmount,
            decodedTx.sqrtPriceLimitX96
        ),
        type: 2,
        maxFeePerGas: BigNumber.from(1e9).mul(42),
        maxPriorityFeePerGas: BigNumber.from(1e9).mul(3),
        gasLimit: BigNumber.from(800000),
        chainId: 1,
        nonce: (await sender.getTransactionCount()),
        value: BigNumber.from(0),
}

    console.log("backrun tx", backrunTx)

    const signedMempoolTx = utils.serializeTransaction(mempoolTx, {r: r || "", s, v})
    const signedBackrunTx = await sender.signTransaction(backrunTx)

    console.log("signedMempoolTx", signedMempoolTx)
    console.log("signedBackrunTx", signedBackrunTx)

    console.log("sending mempool tx...")
    const mempoolTxRes = await (await provider.sendTransaction(signedMempoolTx)).wait()
    console.log("done", mempoolTxRes)
    console.log("sending backrun tx...")
    const backrunTxRes = (await provider.sendTransaction(signedBackrunTx)).wait()
    console.log("done", backrunTxRes)

    console.log("checking updated WETH balance...")
    const endWethBalance = await WETH.balanceOf(sender.address)

    console.log("start WETH balance", startWethBalance)
    console.log("end WETH balance", endWethBalance)
}

async function wtf() {
    // testPoolAddresses()
    // testMulticallDecode()
    await testBackrunExecutor()
}

wtf()
