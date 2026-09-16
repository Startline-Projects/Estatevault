import React from "react";
import { LeadInNotice } from "./_notice";

export interface CalloutAmberProps {
  label: string;
  text: string;
}

/**
 * Emphasis block rendered as a plain paragraph with a bold uppercase lead-in.
 * Instrument pages carry no brand colour.
 */
export function CalloutAmber({ label, text }: CalloutAmberProps): React.ReactElement {
  return <LeadInNotice label={label} text={text} />;
}

export default CalloutAmber;
