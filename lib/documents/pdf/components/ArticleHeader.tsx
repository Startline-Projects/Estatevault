import React from "react";
import { View, Text, StyleSheet } from "@react-pdf/renderer";
import { TOKENS } from "../tokens";

export interface ArticleHeaderProps {
  number: string;
  title: string;
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: TOKENS.colors.navyDark,
    paddingTop: 12,
    paddingBottom: 12,
    paddingLeft: 18,
    paddingRight: 18,
    marginTop: TOKENS.spacing.articleBefore,
    marginBottom: TOKENS.spacing.paragraphAfter,
  },
  text: {
    color: TOKENS.colors.white,
    fontFamily: TOKENS.fonts.sans,
    fontWeight: "bold",
    fontSize: TOKENS.fontSize.articleHeader,
    letterSpacing: TOKENS.letterSpacing.articleHeader,
  },
  dot: {
    color: TOKENS.colors.gold,
  },
});

/**
 * Full-width navy bar that introduces an article, e.g. "ARTICLE I · IDENTIFICATION".
 *
 * Visual: navy dark background, white Helvetica-bold 11pt with 3pt letter spacing,
 * gold middle-dot separator between the roman numeral and the title.
 */
export function ArticleHeader({ number, title }: ArticleHeaderProps): React.ReactElement {
  return (
    <View style={styles.bar}>
      <Text style={styles.text}>
        ARTICLE {number}
        <Text style={styles.dot}> · </Text>
        {title}
      </Text>
    </View>
  );
}

export default ArticleHeader;
