import { useNavigate } from "react-router-dom";
import GlassCard from "@/components/common/GlassCard";

type ContactsSummaryProps = {
  contactsTotal: number;
};

function ContactsSummary({ contactsTotal }: ContactsSummaryProps): JSX.Element {
  const navigate = useNavigate();

  return (
    <GlassCard
      className="cursor-pointer space-y-2"
      onClick={() => navigate("/contacts")}
      data-testid="contacts-summary-card"
    >
      <h3 className="text-sm font-medium text-zinc-400">Contacts</h3>
      <p className="text-3xl font-semibold text-zinc-100">{contactsTotal} saved</p>
      <p className="text-sm text-zinc-400">
        {contactsTotal === 0
          ? "Nobody in your address book yet"
          : "People Ozy can look up by name"}
      </p>
      <p className="text-xs text-zinc-500">Open the address book</p>
    </GlassCard>
  );
}

export default ContactsSummary;
