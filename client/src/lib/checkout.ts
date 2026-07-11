// ─── Stripe checkout URL builder ─────────────────────────────────────────────
// Attaches the LuxProperty user identity to a Stripe Payment Link.
//
// Why this exists:
// The app upgrades users via static Stripe Payment Links. A bare Payment Link
// carries NO link back to the account that clicked it — Stripe only knows the
// email the buyer types into the checkout form. The webhook was therefore
// matching payments to accounts purely by that typed email, so paying with a
// different email than your account email silently upgraded the wrong row (or
// no row at all), while the money was still taken.
//
// Stripe Payment Links accept `client_reference_id` as a query parameter and
// echo it back on the `checkout.session.completed` event. We put the user's id
// there, so the webhook can upgrade the exact account that paid. We also
// prefill the email so the buyer defaults to their account address.
//
// If nobody is signed in we return the URL untouched — an anonymous purchase
// still works and falls back to email matching in the webhook.
import { getUser } from "./authStore";

export function checkoutUrl(baseUrl: string): string {
  const user = getUser();
  if (!user) return baseUrl;
  try {
    const url = new URL(baseUrl);
    url.searchParams.set("client_reference_id", user.id);
    url.searchParams.set("prefilled_email", user.email);
    return url.toString();
  } catch {
    // Never let a malformed URL block checkout — fall back to the raw link.
    return baseUrl;
  }
}
