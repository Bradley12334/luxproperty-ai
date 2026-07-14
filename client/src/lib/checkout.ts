// ─── Stripe checkout URL builder ─────────────────────────────────────────────
// Attaches the LuxProperty user identity to a Stripe Payment Link.
//
// Why this exists:
// The app upgrades users via static Stripe Payment Links. A bare Payment Link
// carries NO link back to the account that clicked it — Stripe only knows the
// email the buyer types into the checkout form. Payments made that way cannot be
// matched to an account, which is what produced "we couldn't find your billing
// record" on the manage/cancel flow.
//
// Stripe Payment Links accept `client_reference_id` as a query parameter and echo
// it back on the `checkout.session.completed` event. We put the user's id there,
// so the webhook can upgrade the exact account that paid. We also prefill the
// email so the buyer defaults to their account address.
//
// FAIL CLOSED: if nobody is signed in we return null rather than the bare link.
// An identity-less checkout is then impossible to construct, instead of merely
// being hidden by the UI. Callers must handle null by sending the user through
// sign-in first — see useCheckout(), which is the only sanctioned way to start a
// checkout.
import { getUser } from "./authStore";

export function checkoutUrl(baseUrl: string): string | null {
  const user = getUser();
  if (!user) return null;
  try {
    const url = new URL(baseUrl);
    url.searchParams.set("client_reference_id", user.id);
    url.searchParams.set("prefilled_email", user.email);
    return url.toString();
  } catch {
    // A malformed base URL is a programming error, not something to paper over
    // with an identity-less link.
    return null;
  }
}
