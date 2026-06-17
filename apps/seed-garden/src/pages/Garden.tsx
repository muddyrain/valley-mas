import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { fetchGarden } from '@/api/garden';
import { plantSeed } from '@/api/plant';
import { PlantPot } from '@/components/PlantPot';
import { SeedBirthAnimation } from '@/components/SeedBirthAnimation';
import { SeedInputBar } from '@/components/SeedInputBar';
import { useAuthStore } from '@/stores/useAuthStore';
import { useGardenStore } from '@/stores/useGardenStore';

export default function Garden() {
  const { token } = useAuthStore();
  const { garden, plants, setGarden, setPlants, upsertPlant } = useGardenStore();
  const [loading, setLoading] = useState(false);
  const [birthing, setBirthing] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    fetchGarden().then((view) => {
      setGarden(view.garden);
      setPlants(view.plants);
    });
  }, [token, setGarden, setPlants]);

  if (!token) return <Navigate to="/login" replace />;

  const slots = Array.from({ length: garden?.slot_count ?? 3 });

  return (
    <main className="mx-auto max-w-2xl p-4 flex flex-col gap-6">
      <header className="text-center pt-6">
        <h1 className="text-3xl font-bold text-garden-ink">语种园</h1>
        <p className="text-garden-ink/60 text-sm">把任何东西种成一棵从未存在过的植物</p>
      </header>
      <div className="grid grid-cols-3 gap-3">
        {slots.map((_, i) => (
          <PlantPot key={i} slotIndex={i} plant={plants.find((p) => p.slot_index === i)} />
        ))}
      </div>
      {err && <div className="rounded-2xl bg-red-100/80 px-4 py-3 text-sm text-red-700">{err}</div>}
      <SeedInputBar
        loading={loading}
        onSubmit={async (concept, style) => {
          setLoading(true);
          setBirthing(true);
          setErr(null);
          try {
            const p = await plantSeed(concept, style);
            upsertPlant(p);
          } catch (e) {
            const msg = e instanceof Error ? e.message : '播种失败，请稍后再试';
            setErr(msg);
          } finally {
            setLoading(false);
            setTimeout(() => setBirthing(false), 800);
          }
        }}
      />
      <SeedBirthAnimation visible={birthing} />
    </main>
  );
}
