import { useNavigate } from "react-router-dom";
import GlassCard from "@/components/common/GlassCard";

type ContactsSummaryProps = {
  contactsTotal: number;
};

function ContactsSummary({ contactsTotal }: ContactsSummaryProps): JSX.Element {
  const navigate = useNavigate();

  return (
    <GlassCard
      className="cursor-pointer space-y-2 transition hover:border-blue-500/60"
      onClick={() => navigate("/contacts")}
      data-testid="contacts-summary-card"
    >
      <h3 className="text-sm font-semibold text-blue-200">Kontakte</h3>
      <p className="text-3xl font-semibold text-blue-100">{contactsTotal} Kontakte</p>
      <p className="text-sm text-gray-300">Adressbuch oeffnen</p>
    </GlassCard>
  );
}

export default ContactsSummary;
