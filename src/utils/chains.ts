import deployments from "../../../ens-contracts/deployments/fenine/deployments.json";

import { addEnsContracts, createEnsPublicClient } from "@fenine/ensjs";
import { defineChain, createClient, http } from "viem";
import { mainnet, sepolia } from "viem/chains";
import type { Address } from "viem";
import { BaseEnv } from "./hono";
import { createMiddleware } from "hono/factory";
import { addLocalhostEnsContracts } from "./localhost-chain";
import { ensPublicActions, ensSubgraphActions } from "@fenine/ensjs";
import { Context } from "hono";
import { getErrorMessage } from "./error";

const fenineChain = defineChain({
  id: deployments._chainId,
  name: "Fenine",
  network: "fenine",
  nativeCurrency: {
    decimals: 18,
    name: "Fenine",
    symbol: "FEN",
  },
  rpcUrls: {
    default: {
      http: [deployments._rpc],
    },
    public: {
      http: [deployments._rpc],
    },
  },
  blockExplorers: {
    default: {
      name: "Fenine Explorer",
      url: "https://explorer.fene.app",
    },
  },
  contracts: {
    multicall3: {
      address: "0xcA11bde05977b3631167028862bE2a173976CA11" as Address,
    },
  },
});

const fenineWithEns = addEnsContracts(fenineChain, {
  contracts: {
    ensRegistry: { address: deployments.ENSRegistry as Address },
    ensBaseRegistrarImplementation: {
      address: deployments.BaseRegistrarImplementation as Address,
    },
    ensEthRegistrarController: { address: deployments.FENRegistrarController as Address },
    ensNameWrapper: { address: deployments.FENNameWrapper as Address },
    ensPublicResolver: { address: deployments.PublicResolver as Address },
    ensReverseRegistrar: { address: deployments.ReverseRegistrar as Address },
    ensDefaultReverseRegistrar: {
      address: deployments.DefaultReverseRegistrar as Address,
    },
    ensUniversalResolver: { address: deployments.UniversalResolver as Address },
  },
  subgraphs: {
    ens: {
      url: "https://subgraph.fenine.codes/subgraphs/name/fenine/fns",
    },
  },
  ens: {
    nativeTld: deployments._tld.replace(/^\./, ""),
    minRegistrationLength: 3,
  },
});

const baseChains = [
  fenineWithEns,
  addEnsContracts(mainnet),
  addEnsContracts(sepolia),
] as const;

// Note: localhost chain will be dynamically added based on environment
export const chains = baseChains;

export type Chain =
  | (typeof baseChains)[number]
  | ReturnType<typeof addLocalhostEnsContracts>;
export type Network = "fenine" | "mainnet" | "sepolia" | "localhost";
export type EnsPublicClient = ReturnType<typeof createEnsPublicClient>;

const isDev = (c: Context<BaseEnv & NetworkMiddlewareEnv, string, object>) => c.env.ENVIRONMENT === "dev";

export const getChainFromNetwork = (
  _network: string,
  c: Context<BaseEnv & NetworkMiddlewareEnv, string, object>,
) => {
  const lowercased = _network.toLowerCase();

  // Handle localhost network in development mode
  if (lowercased === "localhost" && isDev(c)) {
    return addLocalhostEnsContracts(c.env);
  }

  const network = lowercased === "mainnet" ? "ethereum" : lowercased;
  return chains.find(chain => chain.name.toLowerCase() === network);
};

export type NetworkMiddlewareEnv = {
  Variables: {
    chain: Chain;
    network: Network;
  };
};

export const networkMiddleware = createMiddleware<
  BaseEnv & NetworkMiddlewareEnv
>(async (c, next) => {
  try {
    const network = c.req.param("network")?.toLowerCase() ?? "mainnet";

    // Check if localhost is being accessed in non-dev mode
    if (network === "localhost" && !isDev(c)) throw new Error("localhost is only available in development mode");

    const chain = getChainFromNetwork(network, c);

    if (!chain) {
      return c.text("Network is not supported", 400);
    }

    c.set("chain", chain);
    c.set("network", network as Network);

    await next();
  }
  catch (e) {
    return c.text(getErrorMessage(e, "Network middleware error: "), 400);
  }
});

export type ClientMiddlewareEnv = NetworkMiddlewareEnv & {
  Variables: {
    client: EnsPublicClient;
  };
};
export const clientMiddleware = createMiddleware<BaseEnv & ClientMiddlewareEnv>(
  async (c, next) => {
    const endpointMap = JSON.parse(c.env.WEB3_ENDPOINT_MAP ?? "{}") as Record<
      Network,
      string
    >;

    // Did not use createEnsPublicClinet because it does not support localhost
    const client = createClient({
      chain: c.var.chain,
      key: "ensPublic",
      name: "ENS Public Client",
      transport: http(endpointMap[c.var.network]),
      type: "ensPublicClient",
    })
      .extend(ensPublicActions)
      .extend(ensSubgraphActions) as EnsPublicClient;

    c.set("client", client);

    await next();
  },
);
