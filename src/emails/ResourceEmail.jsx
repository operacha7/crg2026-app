// src/emails/ResourceEmail.jsx
// Main React Email template for resource list emails
// Converts the formatResourcesHtml() approach to React components

import {
  Html,
  Head,
  Body,
  Container,
  Section,
  Text,
  Link,
  Img,
  Hr,
} from '@react-email/components';
import { ResourceCard } from './components/ResourceCard';
import {
  formatAddress,
  formatHoursFromJson,
  formatDistance,
  parseRequirements,
} from '../utils/formatters';
import { LOGO_URL_Email } from '../data/constants';

/**
 * Sort resources by assist_id then distance
 */
function getSortedData(data) {
  return [...data].sort((a, b) => {
    const aAssistId = parseInt(a.assist_id, 10) || 999;
    const bAssistId = parseInt(b.assist_id, 10) || 999;
    if (aAssistId !== bAssistId) {
      return aAssistId - bAssistId;
    }
    const aMiles = a.distance ?? Infinity;
    const bMiles = b.distance ?? Infinity;
    return aMiles - bMiles;
  });
}

/**
 * Group resources by assistance type
 */
function groupByAssistance(data) {
  const sortedData = getSortedData(data);

  return sortedData.reduce((acc, item) => {
    const assistId = item.assist_id || '999';
    if (!acc[assistId]) {
      acc[assistId] = {
        label: item.assistance || 'Other',
        items: [],
      };
    }
    acc[assistId].items.push(item);
    return acc;
  }, {});
}

/**
 * Main email template component
 *
 * @param {Object} props
 * @param {Array} props.resources - Selected resource data
 * @param {string} props.headerText - Dynamic header (e.g., "Resources for Zip Code: 77025")
 * @param {string} props.orgPhone - Callback phone number
 * @param {string} props.previewText - Email preview text (shown in inbox)
 */
export function ResourceEmail({
  resources = [],
  headerText = 'Resources',
  orgPhone = '713-664-5350',
  previewText = 'Your requested community resources',
}) {
  const grouped = groupByAssistance(resources);

  return (
    <Html>
      <Head />
      <Body style={styles.body}>
        <Container style={styles.container}>
          {/* Header */}
          <Text style={styles.header}>
            <strong>{headerText}</strong>
          </Text>

          {/* Intro paragraph */}
          <Text style={styles.intro}>
            Thank you for reaching out to us. Here is the information that you
            requested. Please note while we strive to ensure that our information
            is current and accurate, funding levels and eligibility requirements
            can change at any time. This is an automated message and is
            unmonitored, please{' '}
            <span style={{ color: 'red', fontStyle: 'italic' }}>do not reply</span>.
          </Text>

          {/* Website link */}
          <Text style={styles.websiteLink}>
            You can also access the same information at{' '}
            <Link
              href="https://crghouston.operacha.org?utm_source=email&utm_medium=email&utm_campaign=resource_list"
              target="_blank"
              style={styles.link}
            >
              crghouston.operacha.org
            </Link>
            .
          </Text>

          {/* Resource sections grouped by assistance type */}
          {Object.values(grouped).map((group, groupIdx) => (
            <Section key={groupIdx}>
              {/* Assistance type header */}
              <Text style={styles.assistanceHeader}>
                Assistance:&nbsp;&nbsp;{group.label}
              </Text>

              {/* Resources in this group */}
              {group.items.map((resource, idx) => (
                <ResourceCard
                  key={resource.id_no || idx}
                  resource={resource}
                  index={idx}
                  formattedHours={formatHoursFromJson(resource.org_hours)}
                  addressLines={formatAddress(resource)}
                  requirements={parseRequirements(resource.requirements)}
                  distanceText={formatDistance(resource.distance)}
                />
              ))}
            </Section>
          ))}

          {/* Closing message */}
          <Text style={styles.closing}>
            We hope this information helps you secure the assistance you need.
            Please call us back at {orgPhone} if we can provide any other
            resources.
          </Text>

          {/* Footer with logo */}
          <Hr style={styles.hr} />
          <Section style={styles.footer}>
            <Link
              href="https://crghouston.operacha.org?utm_source=email&utm_medium=email&utm_campaign=resource_list"
              target="_blank"
              style={styles.footerLink}
            >
              <Img
                src={LOGO_URL_Email}
                alt="CRG Logo"
                width="25"
                height="25"
                style={styles.logo}
              />
              <span style={styles.footerText}>
                Community Resources Guide Houston
              </span>
            </Link>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

const styles = {
  body: {
    backgroundColor: '#ffffff',
    fontFamily: 'Arial, sans-serif',
  },
  container: {
    maxWidth: '700px',
    marginLeft: '20px',
    padding: '20px 0',
  },
  header: {
    fontSize: '16px',
    marginBottom: '20px',
  },
  intro: {
    fontSize: '14px',
    lineHeight: '1.6',
    marginBottom: '20px',
  },
  websiteLink: {
    fontSize: '14px',
    marginBottom: '24px',
  },
  link: {
    color: '#0066cc',
    textDecoration: 'underline',
  },
  assistanceHeader: {
    fontFamily: 'Arial, sans-serif',
    textDecoration: 'underline',
    marginTop: '24px',
    marginBottom: '16px',
    fontSize: '16px',
    fontWeight: 'bold',
  },
  closing: {
    fontSize: '14px',
    marginTop: '30px',
    lineHeight: '1.6',
  },
  hr: {
    borderTop: '1px solid #ccc',
    marginTop: '40px',
  },
  footer: {
    textAlign: 'center',
    paddingTop: '20px',
  },
  footerLink: {
    textDecoration: 'none',
    color: 'inherit',
    display: 'inline-block',
  },
  logo: {
    display: 'inline',
    verticalAlign: 'middle',
    marginRight: '8px',
  },
  footerText: {
    fontSize: '14px',
    fontFamily: 'Verdana, sans-serif',
    fontWeight: '500',
    color: '#4A4E69',
    verticalAlign: 'middle',
  },
};

// Default export for easy importing
export default ResourceEmail;
