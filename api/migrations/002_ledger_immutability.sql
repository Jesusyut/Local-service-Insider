CREATE FUNCTION protect_ledger_history() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Ledger history cannot be deleted'; END IF;
 IF ROW(NEW.id,NEW.partner_id,NEW.appointment_id,NEW.kind,NEW.amount_cents,NEW.earned_at,NEW.memo)
    IS DISTINCT FROM ROW(OLD.id,OLD.partner_id,OLD.appointment_id,OLD.kind,OLD.amount_cents,OLD.earned_at,OLD.memo)
 THEN RAISE EXCEPTION 'Use an adjustment line to correct ledger history'; END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER immutable_ledger BEFORE UPDATE OR DELETE ON ledger FOR EACH ROW EXECUTE FUNCTION protect_ledger_history();
