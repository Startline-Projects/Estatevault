import React from "react";
import { View, Text, StyleSheet } from "@react-pdf/renderer";
import { TOKENS } from "../tokens";

export interface ArticleHeaderProps {
  number: string;
  title: string;
}

const styles = StyleSheet.create({
  container: {
    marginTop: TOKENS.spacing.articleBefore,
    marginBottom: TOKENS.spacing.paragraphAfter,
  },
  number: {
    fontFamily: TOKENS.fonts.serifBold,
    fontSize: TOKENS.fontSize.articleHeader,
    color: TOKENS.colors.black,
    letterSpacing: TOKENS.letterSpacing.articleHeader,
    textAlign: "center",
  },
  title: {
    fontFamily: TOKENS.fonts.serifBold,
    fontSize: TOKENS.fontSize.articleHeader,
    color: TOKENS.colors.black,
    letterSpacing: TOKENS.letterSpacing.articleHeader,
    textAlign: "center",
    marginTop: 2,
  },
});

/**
 * Article heading in conventional legal-instrument form: the article number
 * centered on its own line, the title centered beneath it, both in bold serif
 * caps.
 *
 * The previous full-width navy bar with a gold separator was branded styling;
 * per the formatting decision, instrument body pages carry no brand marks and
 * read as a conventional legal document.
 *
 * `wrap={false}` keeps the two lines together and prevents a heading from being
 * stranded at the bottom of a page away from its body.
 */
export function ArticleHeader({ number, title }: ArticleHeaderProps): React.ReactElement {
  return (
    <View style={styles.container} wrap={false}>
      <Text style={styles.number}>ARTICLE {number}</Text>
      {title ? <Text style={styles.title}>{title}</Text> : null}
    </View>
  );
}

export default ArticleHeader;
