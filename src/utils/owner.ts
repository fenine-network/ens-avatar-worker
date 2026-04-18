import { EnsPublicClient } from "./chains";
import { getChainNativeTld } from "@fenine/ensjs/contracts";

export const getOwnerAndAvailable = async ({
  client,
  name,
}: {
  client: EnsPublicClient;
  name: string;
}) => {
  const labels = name.split(".");
  const nativeTld = getChainNativeTld(client.chain);
  const is2LDNative = labels.length === 2 && labels.at(-1) === nativeTld;

  const [ownership, available] = await Promise.all([
    client.getOwner({ name }),
    is2LDNative ? client.getAvailable({ name }) : undefined,
  ]);

  return {
    owner: ownership?.owner ?? null,
    available: available ?? !ownership?.owner,
  };
};
