import { randomInt } from 'node:crypto';

/** No 0/O, 1/I/L: easy to read on paper and to type (D3). */
export const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const CODE_LENGTH = 7;

export function generateCode(): string {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return code;
}

/** A code chosen by the Bureau, after normalizeCode: letters and digits only, long enough to resist guessing. */
export const CUSTOM_CODE_MIN = 6;
export const CUSTOM_CODE_MAX = 20;
const CUSTOM_CODE = new RegExp(`^[A-Z0-9]{${CUSTOM_CODE_MIN},${CUSTOM_CODE_MAX}}$`);

export function isValidCustomCode(code: string): boolean {
  return CUSTOM_CODE.test(code);
}

/** Normalizes typed input: case-insensitive, ignores spaces and dashes. */
export function normalizeCode(input: string): string {
  return input.replace(/[\s-]+/g, '').toUpperCase();
}
