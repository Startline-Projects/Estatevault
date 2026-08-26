import React from "react";
import { Text } from "@react-pdf/renderer";
import { BorderedNotice, noticeStyles } from "./_notice";
import { renderInlineText } from "./_inline";

export interface CalloutNavyProps {
  label: string;
  text: string;
}

/**
 * Statutory notice. Rendered as a plain black-bordered box with a centered bold
 * uppercase heading — the conventional way a legal instrument makes a notice
 * conspicuous without colour.
 */
export function CalloutNavy({ label, text }: CalloutNavyProps): React.ReactElement {
  return (
    <BorderedNotice label={label}>
      <Text style={noticeStyles.boxBody}>{renderInlineText(text)}</Text>
    </BorderedNotice>
  );
}

export default CalloutNavy;
