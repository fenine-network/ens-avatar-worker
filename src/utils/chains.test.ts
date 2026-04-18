import { describe, expect, test } from "vitest";
import { getChainFromNetwork } from "./chains";

const mockContext = (environment: "dev" | "production" = "production") =>
  ({ env: { ENVIRONMENT: environment } }) as Parameters<typeof getChainFromNetwork>[1];

describe("getChainFromNetwork", () => {
  test("return chain for mainnet", () => {
    expect(getChainFromNetwork("mainnet", mockContext())).toBeDefined();
  });
  test("return chain for fenine", () => {
    expect(getChainFromNetwork("fenine", mockContext())).toBeDefined();
  });
  test("return chain for sepolia", () => {
    expect(getChainFromNetwork("sepolia", mockContext())).toBeDefined();
  });
  test("return undefined for unknown network", () => {
    expect(getChainFromNetwork("unknown", mockContext())).toBeUndefined();
  });
  test("return chain for unnormalised network value", () => {
    expect(getChainFromNetwork("fEnInE", mockContext())).toBeDefined();
  });
  test("return localhost only in dev", () => {
    expect(getChainFromNetwork("localhost", mockContext("production"))).toBeUndefined();
    expect(() => getChainFromNetwork("localhost", mockContext("dev"))).toThrow();
  });
});
