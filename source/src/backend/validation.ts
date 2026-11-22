export function fail(code: string, message: string): never {
  throw new Error(message);
}
