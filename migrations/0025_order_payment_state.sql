-- Keep the stored payment state inside the contract's exact vocabulary. The
-- application already validates this, but a future adapter or manual repair
-- must not make the whole Orders snapshot unreadable.
CREATE TRIGGER creator_orders_payment_state_insert
BEFORE INSERT ON creator_orders
FOR EACH ROW
WHEN NEW.payment_state NOT IN ('unpaid','pending','paid','failed','cancelled','expired','partially-refunded','refunded')
BEGIN
  SELECT RAISE(ABORT, 'Unsupported payment state.');
END;

CREATE TRIGGER creator_orders_payment_state_update
BEFORE UPDATE OF payment_state ON creator_orders
FOR EACH ROW
WHEN NEW.payment_state NOT IN ('unpaid','pending','paid','failed','cancelled','expired','partially-refunded','refunded')
BEGIN
  SELECT RAISE(ABORT, 'Unsupported payment state.');
END;
