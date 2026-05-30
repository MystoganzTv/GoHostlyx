import { redirect } from "next/navigation";
import { OnboardingFlow } from "@/components/onboarding-flow";
import { getAuthSession } from "@/lib/auth";
import { getOnboardingState } from "@/lib/onboarding";

export const runtime = "nodejs";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await getAuthSession();
  const ownerEmail = session?.user?.email?.toLowerCase();

  if (!session?.user?.email || !ownerEmail) {
    redirect("/login");
  }

  const userName = session.user.name ?? session.user.email ?? "Host";
  const onboardingState = await getOnboardingState(ownerEmail, userName);
  const resolvedSearchParams = await searchParams;
  const forceView = (Array.isArray(resolvedSearchParams.force) ? resolvedSearchParams.force[0] : resolvedSearchParams.force) === "1";

  if (onboardingState.isComplete && !forceView) {
    redirect("/dashboard");
  }

  return (
    <OnboardingFlow
      userName={userName}
      initialSettings={onboardingState.userSettings}
      initialProperties={onboardingState.properties}
      initialHasData={onboardingState.hasData}
      defaultPropertyName={onboardingState.defaultPropertyName}
    />
  );
}
