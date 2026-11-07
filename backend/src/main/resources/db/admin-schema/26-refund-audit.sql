-- Preparation only. Not scanned by Flyway. Promote after migration number/order agreement.
-- Existing V9 stays immutable; a refund must never call Toss without durable REFUND audit support.
ALTER TABLE admin_actions DROP CONSTRAINT admin_actions_action_chk,
ADD CONSTRAINT admin_actions_action_chk CHECK (action IN (
    'HIDE', 'DELETE', 'RESTORE', 'SANCTION', 'REVOKE', 'DISMISS', 'VIEW_EMAIL',
    'APPEAL_ACCEPT', 'APPEAL_REJECT', 'REFUND'
));
