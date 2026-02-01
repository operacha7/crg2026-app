// src/emails/components/HoursTable.jsx
// React Email component for displaying hours in email format

import { Section, Text } from '@react-email/components';

/**
 * Renders hours data as a formatted table for emails
 * Handles regular hours, special hours, and labeled hours
 */
export function HoursTable({ formattedHours }) {
  if (!formattedHours) return null;

  // Legacy format (plain string)
  if (formattedHours.legacy) {
    return (
      <Text style={styles.legacyHours}>
        {formattedHours.legacy}
      </Text>
    );
  }

  const allRows = [
    ...(formattedHours.rows || []),
    ...(formattedHours.special || []),
  ];

  return (
    <Section>
      {/* Regular/Special hours table */}
      {allRows.length > 0 && (
        <table cellPadding="0" cellSpacing="0" border="0" style={styles.table}>
          <tbody>
            {allRows.map((row, idx) => (
              <tr key={idx}>
                <td style={styles.daysCell}>{row.days}</td>
                <td style={styles.hoursCell}>{row.hours}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Labeled hours (e.g., "By Appointment: Mon-Fri 9am-5pm") */}
      {formattedHours.labeled?.map((item, idx) => (
        <Text key={idx} style={styles.labeledHours}>
          <strong>{item.label}:</strong>
          <span style={{ marginLeft: '8px' }}>{item.days} {item.hours}</span>
        </Text>
      ))}
    </Section>
  );
}

/**
 * Renders hours notes in red italic style
 */
export function HoursNotes({ notes }) {
  if (!notes) return null;

  return (
    <Text style={styles.hoursNotes}>
      {notes}
    </Text>
  );
}

const styles = {
  table: {
    fontSize: '14px',
  },
  daysCell: {
    textAlign: 'right',
    paddingRight: '15px',
    whiteSpace: 'nowrap',
  },
  hoursCell: {
    textAlign: 'right',
    whiteSpace: 'nowrap',
  },
  legacyHours: {
    fontSize: '14px',
    margin: '0',
  },
  labeledHours: {
    marginTop: '4px',
    fontSize: '14px',
  },
  hoursNotes: {
    color: '#e74c3c',
    fontStyle: 'italic',
    marginTop: '0',
    marginBottom: '0',
    fontSize: '14px',
  },
};
