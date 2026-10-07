import { SaReviewDetail } from "@/components/admin/saReview/SaReviewDetail";

export default async function SaReviewDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <SaReviewDetail id={id} />;
}
