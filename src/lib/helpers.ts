import { Contract } from 'ethers'
import { UniswapTrade } from './uniswap'

/**
 * right-pad hex-string with zeros up to specified byte-length (NOT string length)
 * @param data hex-string data EXCLUDE 0x prefix
 * @param desiredLength how big the string should be (e.g. 256, when the data length is 224)
 */
export const padRightWithZeros = (data: string, desiredLengthBytes: number) => {
    const numZ = (desiredLengthBytes - (data.length / 2)) * 2 // each char is 1/2 byte; add 2 zeros for each desired byte
    return `${data}${"0".repeat(numZ)}`
}

/** `now` in seconds, rounded to nearest int */
export const now = () => Math.round(new Date().getTime() / 1000)

export const getPoolAddresses = async (decodedTx: UniswapTrade, sushiswapFactory: Contract, uniswapFactory: Contract): Promise<{sushiPoolAddress: string, uniPoolAddress: string}> => {
    const sushiPool = sushiswapFactory.getPair(decodedTx.tokenIn, decodedTx.tokenOut)
    const uniPool = uniswapFactory.getPool(decodedTx.tokenIn, decodedTx.tokenOut, decodedTx.fee)
    return {
        sushiPoolAddress: await sushiPool,
        uniPoolAddress: await uniPool,
    }
}
