CREATE TABLE partners (
 id uuid PRIMARY KEY, business_name text NOT NULL, owner_name text NOT NULL,
 owner_phone text, owner_email text NOT NULL, notify_phones text[] NOT NULL DEFAULT '{}',
 notify_emails text[] NOT NULL DEFAULT '{}', timezone text NOT NULL,
 notifications_consent_at timestamptz, commission_pct numeric(7,4) NOT NULL CHECK(commission_pct BETWEEN 0 AND 100),
 per_show_fee_cents integer NOT NULL DEFAULT 0 CHECK(per_show_fee_cents>=0),
 min_job_value_cents integer NOT NULL DEFAULT 0 CHECK(min_job_value_cents>=0),
 appointment_minutes integer NOT NULL DEFAULT 60 CHECK(appointment_minutes BETWEEN 15 AND 480),
 status text NOT NULL CHECK(status IN ('active','paused','churned')), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE territories(id uuid PRIMARY KEY, partner_id uuid NOT NULL REFERENCES partners, zip char(5) NOT NULL UNIQUE CHECK(zip ~ '^[0-9]{5}$'));
CREATE TABLE availability(id uuid PRIMARY KEY, partner_id uuid NOT NULL REFERENCES partners, weekday integer NOT NULL CHECK(weekday BETWEEN 0 AND 6), start_time time NOT NULL, end_time time NOT NULL, CHECK(start_time<end_time));
CREATE TABLE blackouts(id uuid PRIMARY KEY, partner_id uuid NOT NULL REFERENCES partners, starts_at timestamptz NOT NULL, ends_at timestamptz NOT NULL, CHECK(starts_at<ends_at));
CREATE TABLE leads(
 id uuid PRIMARY KEY, created_at timestamptz NOT NULL DEFAULT now(), first_name text NOT NULL, last_name text NOT NULL,
 phone_e164 text NOT NULL, email text, zip char(5) NOT NULL, yard_size text NOT NULL, current_surface text NOT NULL,
 project_scope text NOT NULL, timeline text NOT NULL, notes text NOT NULL DEFAULT '',
 utm_source text, utm_medium text, utm_campaign text, utm_content text, utm_term text, area_param text,
 fbclid text, fbp text, fbc text, client_ip text, user_agent text, meta_event_id uuid NOT NULL,
 consent_text text NOT NULL, consent_version text NOT NULL, consent_at timestamptz NOT NULL,
 contact_timezone text NOT NULL, partner_id uuid REFERENCES partners,
 status text NOT NULL CHECK(status IN ('new','contacted','booked','unassigned','dead','duplicate')),
 duplicate_of uuid REFERENCES leads, booking_token text NOT NULL UNIQUE,
 last_contacted_at timestamptz, replied_at timestamptz, opted_out_at timestamptz,
 followup_1h_sent_at timestamptz, followup_day1_sent_at timestamptz, followup_day3_sent_at timestamptz
);
CREATE INDEX leads_phone_created ON leads(phone_e164,created_at DESC);
CREATE TABLE sms_suppressions(phone_e164 text PRIMARY KEY, opted_out_at timestamptz NOT NULL);
CREATE TABLE appointments(
 id uuid PRIMARY KEY, lead_id uuid NOT NULL REFERENCES leads, partner_id uuid NOT NULL REFERENCES partners,
 starts_at timestamptz NOT NULL, ends_at timestamptz NOT NULL, install_address text NOT NULL,
 status text NOT NULL CHECK(status IN ('booked','rescheduled','canceled','showed','no_show')),
 confirmed_at timestamptz, reminder_24h_sent_at timestamptz, reminder_2h_sent_at timestamptz,
 no_show_offer_sent_at timestamptz, revision integer NOT NULL DEFAULT 1,
 commission_pct numeric(7,4) NOT NULL, per_show_fee_cents integer NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), CHECK(starts_at<ends_at)
);
CREATE UNIQUE INDEX one_live_appointment ON appointments(lead_id) WHERE status IN ('booked','rescheduled');
CREATE INDEX appointments_partner_time ON appointments(partner_id,starts_at,ends_at);
-- Booking, blackout and availability mutations share a partner advisory lock. All writes use the transaction service.
CREATE TABLE outcomes(id uuid PRIMARY KEY, appointment_id uuid NOT NULL UNIQUE REFERENCES appointments,
 result text NOT NULL CHECK(result IN ('sold','lost')), job_value_cents integer CHECK(job_value_cents>0),
 deposit_paid_at timestamptz, lost_reason text, recorded_by text NOT NULL, recorded_at timestamptz NOT NULL DEFAULT now(),
 CHECK((result='sold' AND job_value_cents IS NOT NULL) OR (result='lost' AND lost_reason IS NOT NULL)));
CREATE TABLE invoices(id uuid PRIMARY KEY, partner_id uuid NOT NULL REFERENCES partners, period_start date NOT NULL, period_end date NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), paid_at timestamptz);
CREATE TABLE ledger(id uuid PRIMARY KEY, partner_id uuid NOT NULL REFERENCES partners, appointment_id uuid NOT NULL REFERENCES appointments,
 kind text NOT NULL CHECK(kind IN ('per_show_fee','commission')), amount_cents bigint NOT NULL,
 earned_at timestamptz NOT NULL DEFAULT now(), invoiced_at timestamptz, paid_at timestamptz, invoice_id uuid REFERENCES invoices,
 memo text NOT NULL);
CREATE TABLE messages(id uuid PRIMARY KEY, lead_id uuid REFERENCES leads, direction text NOT NULL, channel text NOT NULL,
 body text NOT NULL, provider_id text UNIQUE, status text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 delivery_key text UNIQUE, recipient text, attempts integer NOT NULL DEFAULT 0, due_at timestamptz NOT NULL DEFAULT now(),
 payload jsonb NOT NULL DEFAULT '{}', sent_at timestamptz, last_error text);
CREATE INDEX messages_due ON messages(due_at) WHERE status='queued';
CREATE TABLE events(id uuid PRIMARY KEY, entity text NOT NULL, entity_id text NOT NULL, type text NOT NULL, payload jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE ad_spend(partner_id uuid NOT NULL REFERENCES partners, month date NOT NULL, amount_cents bigint NOT NULL CHECK(amount_cents>=0), PRIMARY KEY(partner_id,month));
CREATE TABLE sessions(token_hash text PRIMARY KEY, partner_id uuid REFERENCES partners, role text NOT NULL, expires_at timestamptz NOT NULL);
CREATE TABLE auth_requests(subject text PRIMARY KEY, requested_at timestamptz NOT NULL);
