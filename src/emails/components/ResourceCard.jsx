// src/emails/components/ResourceCard.jsx
// React Email component for displaying a single resource in email format

import { Section, Text, Link } from '@react-email/components';
import { HoursTable, HoursNotes } from './HoursTable';

/**
 * Displays a single resource with all its details
 * Used within ResourceEmail for each selected resource
 *
 * Layout (matching PDF format):
 * 1. Organization name (link)
 * 2. Street address (link)
 * 3. City, State Zip + distance (italic)
 * 4. [8px gap]
 * 5. Phone number
 * 6. [8px gap]
 * 7. Hours, requirements
 */
export function ResourceCard({
  resource,
  index,
  formattedHours,
  addressLines,
  requirements,
  distanceText,
}) {

  return (
    <Section style={styles.card}>
      {/* Organization name with link */}
      <Text style={styles.orgName}>
        {index + 1}.&nbsp;&nbsp;
        <Link
          href={resource.webpage || '#'}
          target="_blank"
          style={styles.orgLink}
        >
          {resource.organization || 'N/A'}
        </Link>
      </Text>

      {/* Full address as single Google Maps link + distance */}
      <Text style={styles.addressBlock}>
        <Link
          href={resource.googlemaps || '#'}
          target="_blank"
          style={styles.addressLink}
          dangerouslySetInnerHTML={{ __html: addressLines.join('<br/>') }}
        />
        {distanceText && (
          <span style={styles.distance}>&nbsp;&nbsp;&nbsp;{distanceText}</span>
        )}
      </Text>

      {/* Phone number - 8px gap above */}
      {resource.org_telephone && (
        <Text style={styles.phone}>
          {resource.org_telephone}
        </Text>
      )}

      {/* Hours - 8px gap above */}
      <Section style={styles.hoursSection}>
        <HoursTable formattedHours={formattedHours} />
        <HoursNotes notes={resource.hours_notes} />
      </Section>

      {/* Requirements */}
      {requirements.length > 0 && (
        <Section style={styles.requirementsSection}>
          <Text style={styles.requirementsTitle}>
            <u>Important Details:</u>
          </Text>
          <ul style={styles.requirementsList}>
            {requirements.map((req, idx) => (
              <li key={idx}>{req}</li>
            ))}
          </ul>
        </Section>
      )}
    </Section>
  );
}

const styles = {
  card: {
    fontFamily: 'Arial, sans-serif',
    marginBottom: '24px',
    paddingLeft: '8px',
  },
  orgName: {
    fontSize: '16px',
    fontWeight: 'bold',
    margin: '0',
  },
  orgLink: {
    color: '#0066cc',
    textDecoration: 'underline',
  },
  addressBlock: {
    fontSize: '14px',
    marginTop: '4px',
    marginBottom: '0',
    paddingLeft: '24px',
  },
  addressLink: {
    color: '#0066cc',
    textDecoration: 'underline',
  },
  distance: {
    fontStyle: 'italic',
    color: '#666666',
  },
  phone: {
    fontSize: '16px',
    fontWeight: 'bold',
    marginTop: '8px',
    marginBottom: '0',
    paddingLeft: '24px',
  },
  hoursSection: {
    fontSize: '14px',
    marginTop: '8px',
    marginBottom: '0',
    paddingLeft: '24px',
  },
  requirementsSection: {
    marginTop: '8px',
    paddingLeft: '24px',
  },
  requirementsTitle: {
    fontSize: '14px',
    margin: '0',
  },
  requirementsList: {
    margin: '4px 0 0 0',
    paddingLeft: '20px',
    fontSize: '14px',
  },
};
