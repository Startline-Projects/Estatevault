/*
 * DOCUMENT GENERATION — ATTORNEY SUPERVISED
 * All document templates and Claude prompts used in this file have been reviewed and
 * approved by a licensed Michigan estate planning attorney before deployment.
 * Claude generates document content based on structured client intake data.
 * The AI operates within attorney-approved template constraints.
 * This system provides document preparation services only. It does not provide legal advice.
 * No attorney-client relationship is created.
 * Template Version: 1.0.0-michigan
 * Attorney Approval Date: [TO BE FILLED]
 * Approved By: [TO BE FILLED]
 */

import React from 'react';
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
} from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Times-Roman',
    fontSize: 11,
    paddingTop: 72,
    paddingBottom: 72,
    paddingLeft: 72,
    paddingRight: 72,
    lineHeight: 1.6,
  },
  header: {
    marginBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#1C3557',
    paddingBottom: 12,
  },
  headerTitle: {
    fontFamily: 'Times-Bold',
    fontSize: 14,
    color: '#1C3557',
    textAlign: 'center',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 10,
    color: '#666666',
    textAlign: 'center',
  },
  textBlock: {
    marginBottom: 10,
    textAlign: 'justify',
  },
  signatureLine: {
    marginTop: 30,
    marginBottom: 6,
  },
  signatureRule: {
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
    width: 300,
    marginBottom: 4,
  },
  signatureLabel: {
    fontSize: 10,
    color: '#444444',
  },
  dateLine: {
    marginTop: 20,
    marginBottom: 6,
  },
  dateRule: {
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
    width: 200,
    marginBottom: 4,
  },
  dateLabel: {
    fontSize: 10,
    color: '#444444',
  },
  witnessBlock: {
    marginTop: 24,
    marginBottom: 12,
  },
  witnessTitle: {
    fontFamily: 'Times-Bold',
    fontSize: 11,
    marginBottom: 8,
  },
  witnessRule: {
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
    width: 300,
    marginBottom: 4,
  },
  witnessLabel: {
    fontSize: 10,
    color: '#444444',
    marginBottom: 2,
  },
  witnessSubRule: {
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
    width: 250,
    marginBottom: 4,
    marginTop: 12,
  },
  notaryBlock: {
    marginTop: 30,
    padding: 16,
    borderWidth: 1,
    borderColor: '#000000',
  },
  notaryTitle: {
    fontFamily: 'Times-Bold',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 12,
  },
  notaryText: {
    fontSize: 10,
    marginBottom: 8,
    textAlign: 'justify',
    lineHeight: 1.5,
  },
  notarySignatureRule: {
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
    width: 250,
    marginBottom: 4,
    marginTop: 16,
  },
  notaryLabel: {
    fontSize: 10,
    color: '#444444',
    marginBottom: 2,
  },
  footer: {
    position: 'absolute',
    bottom: 36,
    left: 72,
    right: 72,
    borderTopWidth: 1,
    borderTopColor: '#CCCCCC',
    paddingTop: 8,
  },
  footerText: {
    fontSize: 8,
    color: '#888888',
    textAlign: 'center',
    marginBottom: 2,
  },
  pageNumber: {
    fontSize: 8,
    color: '#888888',
    textAlign: 'center',
    marginTop: 4,
  },
});

interface DocumentSection {
  type: 'text' | 'signature' | 'date' | 'witness' | 'notary';
  content: string;
}

function parseDocumentText(documentText: string): DocumentSection[] {
  const sections: DocumentSection[] = [];
  const parts = documentText.split(
    /(\[SIGNATURE LINE\]|\[DATE LINE\]|\[WITNESS SIGNATURE\]|\[NOTARY BLOCK\])/
  );

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    switch (trimmed) {
      case '[SIGNATURE LINE]':
        sections.push({ type: 'signature', content: 'Signature' });
        break;
      case '[DATE LINE]':
        sections.push({ type: 'date', content: 'Date' });
        break;
      case '[WITNESS SIGNATURE]':
        sections.push({ type: 'witness', content: 'Witness' });
        break;
      case '[NOTARY BLOCK]':
        sections.push({ type: 'notary', content: 'Notary' });
        break;
      default:
        sections.push({ type: 'text', content: trimmed });
        break;
    }
  }

  return sections;
}

function renderSignatureBlock(): React.ReactElement {
  return React.createElement(View, { style: styles.signatureLine },
    React.createElement(View, { style: styles.signatureRule }),
    React.createElement(Text, { style: styles.signatureLabel }, 'Signature'),
    React.createElement(View, { style: { marginTop: 12 } },
      React.createElement(View, { style: styles.signatureRule }),
      React.createElement(Text, { style: styles.signatureLabel }, 'Printed Name'),
    ),
  );
}

function renderDateBlock(): React.ReactElement {
  return React.createElement(View, { style: styles.dateLine },
    React.createElement(View, { style: styles.dateRule }),
    React.createElement(Text, { style: styles.dateLabel }, 'Date'),
  );
}

function renderWitnessBlock(witnessNumber: number): React.ReactElement {
  return React.createElement(View, { style: styles.witnessBlock },
    React.createElement(Text, { style: styles.witnessTitle }, `Witness ${witnessNumber}`),
    React.createElement(View, { style: styles.witnessRule }),
    React.createElement(Text, { style: styles.witnessLabel }, 'Witness Signature'),
    React.createElement(View, { style: styles.witnessSubRule }),
    React.createElement(Text, { style: styles.witnessLabel }, 'Printed Name'),
    React.createElement(View, { style: styles.witnessSubRule }),
    React.createElement(Text, { style: styles.witnessLabel }, 'Address'),
    React.createElement(View, { style: styles.witnessSubRule }),
    React.createElement(Text, { style: styles.witnessLabel }, 'City, State, ZIP'),
  );
}

function renderNotaryBlock(): React.ReactElement {
  return React.createElement(View, { style: styles.notaryBlock },
    React.createElement(Text, { style: styles.notaryTitle }, 'NOTARY ACKNOWLEDGMENT'),
    React.createElement(Text, { style: styles.notaryText },
      'STATE OF MICHIGAN'
    ),
    React.createElement(Text, { style: styles.notaryText },
      'COUNTY OF ____________________'
    ),
    React.createElement(Text, { style: styles.notaryText },
      'On this _____ day of __________________, 20_____, before me, the undersigned notary public, ' +
      'personally appeared the above-named individual(s), known to me (or proved to me on the basis ' +
      'of satisfactory evidence) to be the person(s) whose name(s) is/are subscribed to the within ' +
      'instrument and acknowledged to me that he/she/they executed the same in his/her/their ' +
      'authorized capacity(ies), and that by his/her/their signature(s) on the instrument, the ' +
      'person(s), or the entity upon behalf of which the person(s) acted, executed the instrument.'
    ),
    React.createElement(Text, { style: styles.notaryText },
      'WITNESS my hand and official seal.'
    ),
    React.createElement(View, { style: styles.notarySignatureRule }),
    React.createElement(Text, { style: styles.notaryLabel }, 'Notary Public, State of Michigan'),
    React.createElement(View, { style: styles.notarySignatureRule }),
    React.createElement(Text, { style: styles.notaryLabel }, 'Printed Name'),
    React.createElement(View, { style: { marginTop: 12 } },
      React.createElement(Text, { style: styles.notaryLabel }, 'My Commission Expires: ____________________'),
    ),
    React.createElement(View, { style: { marginTop: 8 } },
      React.createElement(Text, { style: styles.notaryLabel }, 'Acting in the County of: ____________________'),
    ),
  );
}

let witnessCounter = 0;

function renderSection(section: DocumentSection): React.ReactElement {
  switch (section.type) {
    case 'signature':
      return renderSignatureBlock();
    case 'date':
      return renderDateBlock();
    case 'witness':
      witnessCounter += 1;
      return renderWitnessBlock(witnessCounter);
    case 'notary':
      return renderNotaryBlock();
    case 'text':
    default: {
      const paragraphs = section.content.split('\n').filter((p) => p.trim().length > 0);
      return React.createElement(View, null,
        ...paragraphs.map((paragraph, index) =>
          React.createElement(Text, { key: `p-${index}`, style: styles.textBlock }, paragraph.trim())
        ),
      );
    }
  }
}

function formatDocumentType(documentType: string): string {
  const typeMap: Record<string, string> = {
    will: 'Last Will and Testament',
    'pour-over-will': 'Pour-Over Will',
    trust: 'Revocable Living Trust',
    poa: 'Durable Power of Attorney',
    'healthcare-directive': 'Patient Advocate Designation',
  };
  return typeMap[documentType] ?? documentType;
}

export async function generatePDF(
  documentText: string,
  documentType: string,
  clientName: string,
  partnerName?: string
): Promise<Buffer> {
  witnessCounter = 0;

  const sections = parseDocumentText(documentText);
  const formattedType = formatDocumentType(documentType);

  const footerLine1 = partnerName
    ? `Prepared by EstateVault on behalf of ${partnerName}`
    : 'Prepared by EstateVault';
  const footerLine2 =
    'Document preparation service only | Not legal advice | Template Version 1.0.0-michigan';

  const doc = React.createElement(
    Document,
    {
      title: `${formattedType} - ${clientName}`,
      author: 'EstateVault',
      subject: formattedType,
      creator: 'EstateVault Document Generation System',
    },
    React.createElement(
      Page,
      { size: 'LETTER', style: styles.page },
      React.createElement(View, { style: styles.header },
        React.createElement(Text, { style: styles.headerTitle }, formattedType.toUpperCase()),
        React.createElement(Text, { style: styles.headerSubtitle }, clientName),
      ),
      ...sections.map((section, index) =>
        React.createElement(View, { key: `section-${index}` },
          renderSection(section),
        )
      ),
      React.createElement(View, { style: styles.footer, fixed: true },
        React.createElement(Text, { style: styles.footerText }, footerLine1),
        React.createElement(Text, { style: styles.footerText }, footerLine2),
        React.createElement(
          Text,
          {
            style: styles.pageNumber,
            render: ({ pageNumber, totalPages }: { pageNumber: number; totalPages: number }) =>
              `Page ${pageNumber} of ${totalPages}`,
            fixed: true,
          } as Record<string, unknown>,
        ),
      ),
    ),
  );

  const buffer = await renderToBuffer(doc);
  return buffer;
}
