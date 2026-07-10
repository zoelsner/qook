// Minimal ambient types for bun's test runner, covering only what our tests
// use. We deliberately don't install @types/bun: its global declarations
// (fetch, FormData, etc.) collide with react-native's under this tsconfig.
declare module 'bun:test' {
  type Matchers = {
    toBe(expected: unknown): void;
    toEqual(expected: unknown): void;
    toBeUndefined(): void;
    not: Matchers;
  };
  export function describe(label: string, fn: () => void): void;
  export function test(label: string, fn: () => void | Promise<unknown>): void;
  export function expect(actual: unknown): Matchers;
  export function afterEach(fn: () => void | Promise<unknown>): void;
}
