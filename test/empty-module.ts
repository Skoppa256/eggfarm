// No-op stand-in for the `server-only` package under Vitest (plain Node), where
// importing the real package throws because there is no "react-server" export
// condition. Aliased in vitest.config.ts. Tests legitimately exercise server code.
export {};
