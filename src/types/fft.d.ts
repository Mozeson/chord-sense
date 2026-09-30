declare module 'fft.js' {
  export default class FFT {
    constructor(size: number)
    readonly size: number
    createComplexArray(): number[]
    realTransform(output: number[], input: ArrayLike<number>): void
    completeSpectrum(spectrum: number[]): void
    transform(output: number[], input: number[]): void
    inverseTransform(output: number[], input: number[]): void
  }
}
