import { randomInt } from 'node:crypto';

/** No 0/O, 1/I/L: easy to read on paper and to type (D3). */
export const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const CODE_LENGTH = 7;

export function generateCode(): string {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return code;
}

/** Normalizes typed input: case-insensitive, ignores spaces and dashes. */
export function normalizeCode(input: string): string {
  return input.replace(/[\s-]+/g, '').toUpperCase();
}
