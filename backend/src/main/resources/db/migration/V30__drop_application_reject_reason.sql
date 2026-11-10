-- POL-R-4: recruit applications are rejected without a reason (the applicant only sees fixed copy)
ALTER TABLE applications DROP COLUMN reject_reason;
