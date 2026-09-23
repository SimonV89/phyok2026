import { cookies } from "next/headers";

import { CmsConsole } from "@/features/cms/CmsConsole";
import { getCmsSessionCookieName, isCmsAuthConfigured, readCmsSessionFromToken } from "@/features/cms/cms-auth";

export default async function CmsPage() {
  const cookieStore = await cookies();
  const session = readCmsSessionFromToken(cookieStore.get(getCmsSessionCookieName())?.value);

  return (
    <CmsConsole
      authenticated={Boolean(session)}
      configured={isCmsAuthConfigured()}
      initialUsername={session?.username ?? null}
    />
  );
}
