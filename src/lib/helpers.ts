/**
 * right-pad hex-string with zeros up to specified byte-length (NOT string length)
 * @param data hex-string data EXCLUDE 0x prefix
 * @param desiredLength how big the string should be (e.g. 256, when the data length is 224)
 */
 export const padRightWithZeros = (data: string, desiredLengthBytes: number) => {
    // each char is 1/2 byte; add 2 zeros for each desired byte
    const numZ = (desiredLengthBytes - (data.length / 2)) * 2
    return `${data}${"0".repeat(numZ)}`
}
