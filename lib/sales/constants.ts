// Default commission rate for sales reps (decimal). 0.05 = 5%.
// Applied when profiles.commission_rate is NULL.
// Must match the DB schema default in migration-phase9.sql.
export const DEFAULT_COMMISSION_RATE = 0.05;
