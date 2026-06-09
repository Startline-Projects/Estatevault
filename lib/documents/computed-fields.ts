import type { TemplateWillIntake as WillIntake } from "./intake-adapter";

/**
 * Reusable Intl formatters (locale en-US). Created once at module load; they hold
 * only locale/format configuration and are independent of the current time, so they
 * are safe to reuse and play nicely with faked system clocks in tests.
 */
const LONG_DATE_FMT = new Intl.DateTimeFormat("en-US", { year: "numeric", month: "long", day: "numeric" });
const SHORT_DATE_FMT = new Intl.DateTimeFormat("en-US", { year: "numeric", month: "numeric", day: "numeric" });

/**
 * Parse a `YYYY-MM-DD` date string (as produced by `<input type="date">`) into a
 * Date constructed in LOCAL time. This avoids the classic "new Date('1975-01-15')
 * is UTC midnight → previous day in negative offsets" bug, keeping date rendering
 * deterministic regardless of the runner's timezone.
 *
 * @param s - A date string, ideally `YYYY-MM-DD`. May be empty/undefined.
 * @returns A local Date, or `null` if the input is missing or unparseable.
 */
function parseLocalDate(s?: string | null): Date | null {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s.trim());
  if (m) {
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

/** Display labels for marital_status. Passthrough today; future-proof hook for new statuses. */
const MARITAL_STATUS_LABELS: Record<string, string> = {
  Single: "Single",
  Married: "Married",
  Divorced: "Divorced",
  Widowed: "Widowed",
};

/**
 * Compute the derived/convenience fields used by document templates from a raw
 * WillIntake. These are merged into the template resolver's lookup namespace so
 * that templates can reference values like `{{client_full_name_upper}}` or
 * `{{generation_date}}` without the resolver needing to know how they are built.
 *
 * Pure and synchronous. Uses only Node built-in `Intl.DateTimeFormat` for dates —
 * no external date library.
 *
 * @param intake - The raw WillIntake object.
 * @returns A flat record of computed field names → values.
 */
export function computeDerivedFields(intake: WillIntake): Record<string, unknown> {
  const first = (intake.first_name || "").trim();
  const middle = (intake.middle_name || "").trim();
  const last = (intake.last_name || "").trim();
  const suffix = (intake.suffix || "").trim();

  const nameParts = [first, middle, last].filter(Boolean);
  if (suffix && suffix !== "None") nameParts.push(suffix);
  const client_full_name = nameParts.join(" ");

  const dob = parseLocalDate(intake.date_of_birth);
  const now = new Date();
  const hipaaExpiration = new Date(now.getFullYear() + 7, now.getMonth(), now.getDate());

  const purposes = Array.isArray(intake.organ_donation_purposes) ? intake.organ_donation_purposes : [];
  const contingent = Array.isArray(intake.contingent_beneficiaries) ? intake.contingent_beneficiaries : [];
  const hipaaParties = Array.isArray(intake.hipaa_additional_authorized_parties) ? intake.hipaa_additional_authorized_parties : [];

  return {
    client_full_name,
    client_full_name_upper: client_full_name.toUpperCase(),
    client_dob: dob ? LONG_DATE_FMT.format(dob) : "",
    client_dob_short: dob ? SHORT_DATE_FMT.format(dob) : "",
    first_name_upper: first.toUpperCase(),
    middle_name_upper: middle.toUpperCase(),
    last_name_upper: last.toUpperCase(),
    county_upper: (intake.county || "").toUpperCase(),
    // The current WillIntake shape has a single `street_address` field. If separate
    // street/unit fields are ever added, compose them here; for now pass through.
    street_address: intake.street_address || "",
    generation_date: LONG_DATE_FMT.format(now),
    generation_date_short: SHORT_DATE_FMT.format(now),
    hipaa_expiration_date: LONG_DATE_FMT.format(hipaaExpiration),
    organ_donation_purposes_joined: purposes.join(", "),
    marital_status_label: MARITAL_STATUS_LABELS[intake.marital_status] ?? intake.marital_status ?? "",
    contingent_beneficiaries_not_empty: contingent.length > 0,
    hipaa_additional_authorized_parties_not_empty: hipaaParties.length > 0,
  };
}
