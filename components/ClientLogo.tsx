import { clientInitials } from "@/lib/logo";

export function ClientLogo({
  client,
  logo,
  size = 48,
}: {
  client: string;
  logo?: string | null;
  size?: number;
}) {
  const initials = clientInitials(client);
  return (
    <span className="client-mark" style={{ width: size, height: size }} data-testid={logo ? "client-logo" : "client-initials"}>
      {logo ? (
        // The value is a data URL checked before it is saved.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logo} alt="" />
      ) : (
        <span aria-hidden="true">{initials}</span>
      )}
    </span>
  );
}
