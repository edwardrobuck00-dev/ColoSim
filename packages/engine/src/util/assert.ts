export class InvariantError extends Error {
  override name = "InvariantError";
}

/** Throws if `condition` is falsy. Use for programmer errors, never for user input. */
export function invariant(condition: unknown, message: string): asserts condition {
  if (!condition) throw new InvariantError(message);
}

/** Compile-time exhaustiveness check for discriminated unions. */
export function assertNever(value: never, context = "value"): never {
  throw new InvariantError(`Unhandled ${context}: ${JSON.stringify(value)}`);
}
