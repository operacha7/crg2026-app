// src/emails/components/ResourceCard.jsx
// React Email component for displaying a single resource in email format

import { Section, Text, Link } from '@react-email/components';
import { HoursTable, HoursNotes } from './HoursTable';
import { BUS_ICON_URL } from '../../data/constants';
import { buildTransitDirectionsUrl } from '../../utils/transitUrl';
import { parsePhoneNumbers, getDisplayParent } from '../../utils/formatters';

// Bus Route pill links to Google Maps in transit mode. We intentionally call
// buildTransitDirectionsUrl WITHOUT clientCoordinates so the sender's local
// address is never embedded in outgoing email — Google Maps prompts the
// recipient for their own origin.
export function ResourceCard({
  resource,
  index,
  formattedHours,
  addressLines,
  requirements,
  distanceText,
}) {
  const transitUrl = buildTransitDirectionsUrl(resource);
  const displayParent = getDisplayParent(resource);

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

      {/* Parent org (real multi-child parents only) — bare name, muted */}
      {displayParent && <Text style={styles.parentName}>{displayParent}</Text>}

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

      {/* Bus Route pill — outlined red, opens Google Maps in transit mode.
          All inline styles so it survives email clients that strip CSS;
          falls back to a plain red link if borders are dropped. */}
      <Text style={styles.busRouteWrapper}>
        <Link href={transitUrl} target="_blank" style={styles.busRoutePill}>
          <img
            src={BUS_ICON_URL}
            alt=""
            width="16"
            height="16"
            style={styles.busRouteIcon}
          />
          <span>Bus Route</span>
        </Link>
      </Text>

      {/* Phone number(s) - 8px gap above. Multiple comma-separated numbers
          each render on their own line (comma not shown). */}
      {parsePhoneNumbers(resource.org_telephone).length > 0 && (
        <Text style={styles.phone}>
          {parsePhoneNumbers(resource.org_telephone).map((phone, i) => (
            <span key={phone}>
              {i > 0 && <br />}
              {phone}
            </span>
          ))}
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
  parentName: {
    fontSize: '14px',
    color: '#666666',
    margin: '2px 0 0 0',
    paddingLeft: '24px',
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
  busRouteWrapper: {
    marginTop: '6px',
    marginBottom: '0',
    paddingLeft: '24px',
  },
  busRoutePill: {
    display: 'inline-block',
    border: '2px solid #B8001F',
    borderRadius: '999px',
    padding: '3px 10px',
    color: '#B8001F',
    fontSize: '12px',
    fontWeight: 'bold',
    letterSpacing: '0.02em',
    textDecoration: 'none',
    lineHeight: '1',
    whiteSpace: 'nowrap',
  },
  busRouteIcon: {
    verticalAlign: 'middle',
    marginRight: '5px',
    border: '0',
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
