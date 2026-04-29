import { DebatePageClient } from '@/components/DebatePageClient';

interface DebatePageProps {
  params: Promise<{ id: string }>;
}

export default async function DebatePage({ params }: DebatePageProps) {
  const { id } = await params;
  return <DebatePageClient debateId={id} />;
}
