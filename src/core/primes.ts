export const PRIMES: readonly number[] = [
  2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71, 73, 79, 83, 89, 97,
];

export const PRIME_SET: ReadonlySet<number> = new Set(PRIMES);

export function isPrime(n: number): boolean {
  return PRIME_SET.has(n);
}

export function primeIndex(p: number): number {
  return PRIMES.indexOf(p);
}
