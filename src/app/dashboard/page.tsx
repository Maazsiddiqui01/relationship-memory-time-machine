import { DashboardGallery } from "@/components/dashboard-gallery";
import { loadDashboardData } from "@/lib/data";

export default async function DashboardPage() {
  const { dashboardInsights, signatureMetrics } = await loadDashboardData();

  return <DashboardGallery insights={dashboardInsights} signatureMetrics={signatureMetrics} />;
}
