import GlassCard from "@/components/common/GlassCard";

type PlaceholderPageProps = {
  title: string;
};

function PlaceholderPage({ title }: PlaceholderPageProps): JSX.Element {
  return (
    <GlassCard>
      <h2 className="mb-2 text-lg font-semibold">{title}</h2>
      <p className="text-sm text-gray-300">Kommt bald.</p>
    </GlassCard>
  );
}

export default PlaceholderPage;
