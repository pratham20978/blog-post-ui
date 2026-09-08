import "server-only";

import { routes } from "@/shared/api/routes";
import { serverFetchOptional } from "@/shared/api/server";
import { dataSource } from "@/shared/config";
import type { OAuthProviderName } from "@/shared/contracts";

/** Backend capability discovery keeps OAuth buttons and configured adapters in sync. */
export async function getOAuthProviders(): Promise<readonly OAuthProviderName[]> {
  if (dataSource() === "fixtures") return [];
  return (
    (await serverFetchOptional<readonly OAuthProviderName[]>(routes.oauthProviders(), {
      anonymous: true,
      revalidate: 300,
      tags: ["oauth-providers"],
    })) ?? []
  );
}
