import { Client } from "pg";

type Env = {
  CLUB_FILES: R2Bucket;
  HYPERDRIVE: Hyperdrive;
  PUBLIC_APP_ORIGIN: string;
  PLATFORM_PROVISIONING_URL: string;
  PLATFORM_PROVISIONING_TOKEN: string;
  PAYPAL_CLIENT_ID: string;
  PAYPAL_CLIENT_SECRET: string;
  PAYPAL_START_PLAN_ID: string;
  PAYPAL_TEAM_PLAN_ID: string;
  PAYPAL_VERBAND_PLAN_ID: string;
  PAYPAL_WEBHOOK_ID: string;
};

type PlanCode = "start" | "team" | "verband";
type PaymentMethod = "paypal" | "invoice";

type Onboarding = {
  id: string;
  planCode: PlanCode;
  paymentMethod: PaymentMethod;
  clubName: string;
  legalForm: string | null;
  street: string;
  city: string;
  clubEmail: string;
  clubPhone: string | null;
  administratorName: string;
  administratorEmail: string;
  administratorRole: string;
  billingEmail: string;
  logoObjectKey: string | null;
};

const allowedOrigins = new Set(["https://vereinslio.de", "https://www.vereinslio.de"]);
const allowedLogoTypes = new Set(["image/png", "image/jpeg", "image/svg+xml"]);
const maxLogoBytes = 3 * 1024 * 1024;
const maxTextLength = 254;

function apiError(message: string, status = 400) {
  return Response.json({ error: { message } }, { status, headers: noStoreHeaders() });
}

function noStoreHeaders(extra: HeadersInit = {}) {
  return { "cache-control": "no-store", ...extra };
}

function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get("origin");
  if (!origin || !allowedOrigins.has(origin)) return {};
  return { "access-control-allow-origin": origin, vary: "Origin" };
}

function sameSiteRequest(request: Request) {
  const origin = request.headers.get("origin");
  return Boolean(origin && allowedOrigins.has(origin));
}

function text(value: FormDataEntryValue | null, name: string, required = true, max = maxTextLength) {
  if (typeof value !== "string") {
    if (required) throw new Error(`${name} fehlt.`);
    return null;
  }
  const result = value.trim();
  if (required && !result) throw new Error(`${name} fehlt.`);
  if (result.length > max) throw new Error(`${name} ist zu lang.`);
  return result || null;
}

function email(value: FormDataEntryValue | null, name: string) {
  const result = text(value, name)!;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result)) throw new Error(`${name} ist keine gültige E-Mail-Adresse.`);
  return result.toLowerCase();
}

function valueIn<T extends string>(value: FormDataEntryValue | null, values: readonly T[], name: string): T {
  if (typeof value !== "string" || !values.includes(value as T)) throw new Error(`${name} ist ungültig.`);
  return value as T;
}

function id() {
  return crypto.randomUUID();
}

function logoKey(onboardingId: string, file: File) {
  const extension = file.type === "image/png" ? "png" : file.type === "image/jpeg" ? "jpg" : "svg";
  return `onboarding/${onboardingId}/logo.${extension}`;
}

async function withDatabase<T>(env: Env, operation: (client: Client) => Promise<T>) {
  const client = new Client({ connectionString: env.HYPERDRIVE.connectionString });
  await client.connect();
  try {
    return await operation(client);
  } finally {
    await client.end();
  }
}

async function saveOnboarding(client: Client, onboarding: Onboarding, status: "PAYPAL_APPROVAL" | "INVOICE_PENDING") {
  await client.query(
    `INSERT INTO club_onboarding (
       id, status, plan_code, payment_method, club_name, legal_form, street, city, club_email, club_phone,
       administrator_name, administrator_email, administrator_role, billing_email, logo_object_key, terms_accepted_at
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, now())`,
    [onboarding.id, status, onboarding.planCode, onboarding.paymentMethod, onboarding.clubName, onboarding.legalForm,
      onboarding.street, onboarding.city, onboarding.clubEmail, onboarding.clubPhone, onboarding.administratorName,
      onboarding.administratorEmail, onboarding.administratorRole, onboarding.billingEmail, onboarding.logoObjectKey]
  );
}

function paypalPlan(env: Env, plan: PlanCode) {
  const value = plan === "start" ? env.PAYPAL_START_PLAN_ID : plan === "team" ? env.PAYPAL_TEAM_PLAN_ID : env.PAYPAL_VERBAND_PLAN_ID;
  if (!/^[A-Z0-9-]{3,64}$/i.test(value || "")) throw new Error("PayPal-Tarif ist nicht konfiguriert.");
  return value;
}

async function paypalAccessToken(env: Env) {
  const credentials = btoa(`${env.PAYPAL_CLIENT_ID}:${env.PAYPAL_CLIENT_SECRET}`);
  const response = await fetch("https://api-m.paypal.com/v1/oauth2/token", {
    method: "POST",
    headers: { authorization: `Basic ${credentials}`, "content-type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials"
  });
  const body = await response.json() as { access_token?: string };
  if (!response.ok || !body.access_token) throw new Error("PayPal-Authentifizierung fehlgeschlagen.");
  return body.access_token;
}

async function createPayPalApproval(env: Env, onboarding: Onboarding) {
  const token = await paypalAccessToken(env);
  const response = await fetch("https://api-m.paypal.com/v1/billing/subscriptions", {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json", "paypal-request-id": `vereinslio-${onboarding.id}` },
    body: JSON.stringify({
      plan_id: paypalPlan(env, onboarding.planCode),
      custom_id: onboarding.id,
      subscriber: { email_address: onboarding.billingEmail },
      application_context: {
        brand_name: "VereinsLio",
        locale: "de-DE",
        shipping_preference: "NO_SHIPPING",
        user_action: "SUBSCRIBE_NOW",
        return_url: `${env.PUBLIC_APP_ORIGIN}/buchen/?paypal=returned`,
        cancel_url: `${env.PUBLIC_APP_ORIGIN}/buchen/?paypal=cancelled`
      }
    })
  });
  const payload = await response.json() as { id?: string; links?: Array<{ rel?: string; href?: string }> };
  const approval = payload.links?.find((link) => link.rel === "approve")?.href;
  const parsed = approval ? new URL(approval) : null;
  if (!response.ok || !payload.id || !parsed || parsed.protocol !== "https:" || parsed.hostname !== "www.paypal.com") {
    throw new Error("PayPal konnte keine sichere Zahlungsfreigabe erstellen.");
  }
  return { subscriptionId: payload.id, approvalUrl: parsed.toString() };
}

async function verifyPayPalWebhook(request: Request, env: Env, event: unknown) {
  const token = await paypalAccessToken(env);
  const header = (name: string) => request.headers.get(name)?.trim() || "";
  const response = await fetch("https://api-m.paypal.com/v1/notifications/verify-webhook-signature", {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({
      transmission_id: header("paypal-transmission-id"),
      transmission_time: header("paypal-transmission-time"),
      cert_url: header("paypal-cert-url"),
      auth_algo: header("paypal-auth-algo"),
      transmission_sig: header("paypal-transmission-sig"),
      webhook_id: env.PAYPAL_WEBHOOK_ID,
      webhook_event: event
    })
  });
  const result = await response.json() as { verification_status?: string };
  return response.ok && result.verification_status === "SUCCESS";
}

async function provision(env: Env, client: Client, onboardingId: string) {
  const result = await client.query("UPDATE club_onboarding SET status = 'PROVISIONING', updated_at = now() WHERE id = $1 AND status = 'PAID' RETURNING *", [onboardingId]);
  if (!result.rowCount) return;
  const response = await fetch(env.PLATFORM_PROVISIONING_URL, {
    method: "POST",
    headers: { authorization: `Bearer ${env.PLATFORM_PROVISIONING_TOKEN}`, "content-type": "application/json" },
    body: JSON.stringify({ onboardingId, onboarding: result.rows[0] })
  });
  if (!response.ok) {
    await client.query("UPDATE club_onboarding SET status = 'FAILED', updated_at = now() WHERE id = $1", [onboardingId]);
    throw new Error("Die Vereinsplattform konnte nicht eingerichtet werden.");
  }
  await client.query("UPDATE club_onboarding SET status = 'ACTIVE', provisioned_at = now(), updated_at = now() WHERE id = $1", [onboardingId]);
}

async function createOnboarding(request: Request, env: Env) {
  if (!sameSiteRequest(request)) return apiError("Ungültige Herkunft der Anfrage.", 403);
  const form = await request.formData();
  let onboarding: Onboarding;
  try {
    const planCode = valueIn(form.get("plan"), ["start", "team", "verband"] as const, "Tarif");
    const paymentMethod = valueIn(form.get("payment"), ["paypal", "invoice"] as const, "Zahlungsart");
    if (form.get("terms") !== "on") throw new Error("Bitte akzeptieren Sie die Nutzungsbedingungen.");
    onboarding = {
      id: id(), planCode, paymentMethod,
      clubName: text(form.get("clubName"), "Vereinsname", true, 120)!,
      legalForm: text(form.get("legalForm"), "Rechtsform", false, 40),
      street: text(form.get("street"), "Straße und Hausnummer", true, 120)!,
      city: text(form.get("city"), "PLZ und Ort", true, 120)!,
      clubEmail: email(form.get("clubEmail"), "Vereins-E-Mail"),
      clubPhone: text(form.get("clubPhone"), "Telefon", false, 40),
      administratorName: text(form.get("adminName"), "Name", true, 120)!,
      administratorEmail: email(form.get("adminEmail"), "Administrations-E-Mail"),
      administratorRole: text(form.get("adminRole"), "Funktion", true, 120)!,
      billingEmail: email(form.get("billingEmail"), "Rechnungs-E-Mail"),
      logoObjectKey: null
    };
  } catch (error) {
    return apiError(error instanceof Error ? error.message : "Ungültige Eingabe.");
  }
  const logo = form.get("logo");
  if (logo instanceof File && logo.size) {
    if (!allowedLogoTypes.has(logo.type) || logo.size > maxLogoBytes) return apiError("Das Logo muss PNG, JPG oder SVG sein und darf höchstens 3 MB groß sein.");
    onboarding.logoObjectKey = logoKey(onboarding.id, logo);
    await env.CLUB_FILES.put(onboarding.logoObjectKey, logo.stream(), {
      httpMetadata: { contentType: logo.type },
      customMetadata: { onboardingId: onboarding.id }
    });
  }
  let saved = false;
  try {
    if (onboarding.paymentMethod === "invoice") {
      await withDatabase(env, (client) => saveOnboarding(client, onboarding, "INVOICE_PENDING"));
      saved = true;
      return Response.json({ data: { status: "invoice_pending", onboardingId: onboarding.id } }, { headers: noStoreHeaders(corsHeaders(request)) });
    }
    await withDatabase(env, (client) => saveOnboarding(client, onboarding, "PAYPAL_APPROVAL"));
    saved = true;
    const paypal = await createPayPalApproval(env, onboarding);
    await withDatabase(env, async (client) => {
      const result = await client.query(
        "UPDATE club_onboarding SET paypal_subscription_id = $2, updated_at = now() WHERE id = $1 AND status = 'PAYPAL_APPROVAL'",
        [onboarding.id, paypal.subscriptionId]
      );
      if (result.rowCount !== 1) throw new Error("Die lokale PayPal-Zuordnung konnte nicht gespeichert werden.");
    });
    return Response.json({ data: { status: "paypal_approval", approvalUrl: paypal.approvalUrl } }, { headers: noStoreHeaders(corsHeaders(request)) });
  } catch (error) {
    if (saved) {
      await withDatabase(env, (client) => client.query("UPDATE club_onboarding SET status = 'FAILED', updated_at = now() WHERE id = $1 AND status = 'PAYPAL_APPROVAL'", [onboarding.id])).catch(() => undefined);
    } else if (onboarding.logoObjectKey) {
      await env.CLUB_FILES.delete(onboarding.logoObjectKey).catch(() => undefined);
    }
    console.error("onboarding failed", error instanceof Error ? error.message : "unknown");
    return apiError("Die Buchung konnte gerade nicht vorbereitet werden. Bitte versuchen Sie es später erneut.", 503);
  }
}

async function handlePayPalWebhook(request: Request, env: Env) {
  let event: { id?: string; event_type?: string; resource?: { id?: string; custom_id?: string } };
  try {
    event = await request.json();
  } catch {
    return apiError("Ungültiger PayPal-Webhook.");
  }
  if (!event.id || !event.event_type || !(await verifyPayPalWebhook(request, env, event))) return apiError("PayPal-Webhook konnte nicht geprüft werden.", 400);
  if (event.event_type !== "BILLING.SUBSCRIPTION.ACTIVATED") return Response.json({ data: { accepted: true } }, { headers: noStoreHeaders() });
  const onboardingId = event.resource?.custom_id;
  const subscriptionId = event.resource?.id;
  if (!onboardingId || !subscriptionId) return apiError("PayPal-Webhook ohne Buchungsbindung.", 400);
  try {
    await withDatabase(env, async (client) => {
      await client.query("BEGIN");
      const deduplicated = await client.query(
        "INSERT INTO provider_webhook_event (provider, provider_event_id, payload) VALUES ('paypal', $1, $2) ON CONFLICT DO NOTHING RETURNING provider_event_id",
        [event.id, JSON.stringify(event)]
      );
      if (!deduplicated.rowCount) {
        await client.query("ROLLBACK");
        return;
      }
      const changed = await client.query(
        "UPDATE club_onboarding SET status = 'PAID', updated_at = now() WHERE id = $1 AND paypal_subscription_id = $2 AND status = 'PAYPAL_APPROVAL' RETURNING id",
        [onboardingId, subscriptionId]
      );
      if (!changed.rowCount) {
        await client.query("ROLLBACK");
        throw new Error("PayPal-Webhook stimmt nicht mit einer offenen Buchung überein.");
      }
      await client.query("COMMIT");
    });
    await withDatabase(env, (client) => provision(env, client, onboardingId));
    return Response.json({ data: { accepted: true } }, { headers: noStoreHeaders() });
  } catch (error) {
    console.error("paypal webhook failed", error instanceof Error ? error.message : "unknown");
    return apiError("PayPal-Webhook konnte nicht verarbeitet werden.", 503);
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: { ...corsHeaders(request), "access-control-allow-methods": "POST, OPTIONS", "access-control-allow-headers": "content-type" } });
    if (request.method === "GET" && url.pathname === "/health") return Response.json({ data: { status: "ok" } }, { headers: noStoreHeaders(corsHeaders(request)) });
    if (request.method === "POST" && url.pathname === "/v1/onboardings") return createOnboarding(request, env);
    if (request.method === "POST" && url.pathname === "/v1/paypal/webhook") return handlePayPalWebhook(request, env);
    return apiError("Nicht gefunden.", 404);
  }
} satisfies ExportedHandler<Env>;
