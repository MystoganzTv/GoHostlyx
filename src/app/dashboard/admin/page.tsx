import { redirect } from "next/navigation";
import { AdminUsersPanel } from "@/components/admin-users-panel";
import { WorkspaceShell } from "@/components/workspace-shell";
import { getAuthSession } from "@/lib/auth";
import { isAdminOwnerEmail } from "@/lib/admin";
import { getLatestImport, getSubscriptionState, getUserSettings, listAdminUsers } from "@/lib/db";
import { getSubscriptionBadge } from "@/lib/subscription";

export const runtime = "nodejs";

export default async function AdminPage() {
  const session = await getAuthSession();
  const ownerEmail = session?.user?.email?.toLowerCase();

  if (!session?.user?.email || !ownerEmail) {
    redirect("/login");
  }

  if (!isAdminOwnerEmail(ownerEmail)) {
    redirect("/dashboard");
  }

  const userName = session.user.name ?? session.user.email ?? "Host";
  const [latestImport, userSettings, subscription, users] = await Promise.all([
    getLatestImport(ownerEmail),
    getUserSettings(ownerEmail, userName),
    getSubscriptionState(ownerEmail),
    listAdminUsers(),
  ]);

  return (
    <WorkspaceShell
      activePage="admin"
      pageTitle="Admin Panel"
      pageSubtitle="Manage access, plans, and user accounts from one control surface."
      businessName={userSettings.businessName}
      userName={userName}
      userEmail={ownerEmail}
      currencyCode={userSettings.currencyCode}
      latestImport={latestImport}
      subscriptionBadge={getSubscriptionBadge(subscription)}
    >
      <AdminUsersPanel users={users} />
    </WorkspaceShell>
  );
}
