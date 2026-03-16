import { DashboardGallery } from "@/components/dashboard-gallery";
import { loadDashboardData } from "@/lib/data";
import { deriveProjectProfile } from "@/lib/project-profile";

export default async function DashboardPage() {
  const { dashboardInsights, signatureMetrics, participants } = await loadDashboardData();
  const profile = deriveProjectProfile(participants);

  return (
    <DashboardGallery
      insights={dashboardInsights}
      signatureMetrics={signatureMetrics}
      primaryReader={profile.primaryReader}
    />
  );
}
