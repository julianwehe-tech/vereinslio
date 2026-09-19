CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS club_onboarding (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status text NOT NULL CHECK (status IN ('PAYPAL_APPROVAL', 'INVOICE_PENDING', 'PAID', 'PROVISIONING', 'ACTIVE', 'FAILED', 'CANCELED')),
  plan_code text NOT NULL CHECK (plan_code IN ('start', 'team', 'verband')),
  payment_method text NOT NULL CHECK (payment_method IN ('paypal', 'invoice')),
  club_name text NOT NULL,
  legal_form text,
  street text NOT NULL,
  city text NOT NULL,
  club_email text NOT NULL,
  club_phone text,
  administrator_name text NOT NULL,
  administrator_email text NOT NULL,
  administrator_role text NOT NULL,
  billing_email text NOT NULL,
  logo_object_key text,
  paypal_subscription_id text UNIQUE,
  terms_accepted_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  provisioned_at timestamptz
);

CREATE INDEX IF NOT EXISTS club_onboarding_status_created_idx ON club_onboarding (status, created_at DESC);
CREATE INDEX IF NOT EXISTS club_onboarding_administrator_email_idx ON club_onboarding (administrator_email);

CREATE TABLE IF NOT EXISTS provider_webhook_event (
  provider text NOT NULL,
  provider_event_id text NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  payload jsonb NOT NULL,
  PRIMARY KEY (provider, provider_event_id)
);
