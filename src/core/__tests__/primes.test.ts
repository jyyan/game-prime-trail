import { describe, expect, it } from 'vitest';
import { PRIMES, PRIME_SET, isPrime, primeIndex } from '../primes';

describe('primes', () => {
  it('has 25 primes from 2 to 97', () => {
    expect(PRIMES).toHaveLength(25);
    expect(PRIMES[0]).toBe(2);
    expect(PRIMES[PRIMES.length - 1]).toBe(97);
    expect(PRIME_SET.size).toBe(25);
  });

  it('isPrime', () => {
    expect(isPrime(1)).toBe(false);
    expect(isPrime(97)).toBe(true);
    expect(isPrime(100)).toBe(false);
    expect(isPrime(101)).toBe(false);
  });

  it('primeIndex round-trips', () => {
    for (const p of PRIMES) expect(PRIMES[primeIndex(p)]).toBe(p);
    expect(primeIndex(4)).toBe(-1);
    expect(primeIndex(2)).toBe(0);
    expect(primeIndex(97)).toBe(24);
  });
});
