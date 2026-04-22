// src/views/LegalPage.js
// 2026 Redesign - Combined Privacy Policy and Terms of Service page
//
// TO UPDATE CONTENT:
// Edit the PRIVACY_POLICY_HTML or TERMS_OF_SERVICE_HTML strings below.
// Also update public/privacy-policy.html to keep the standalone version in sync.

import React, { useState } from 'react';
import VerticalNavBar from '../layout/VerticalNavBar';
import Footer from '../layout/Footer';

// =============================================================================
// PRIVACY POLICY CONTENT
// =============================================================================
const PRIVACY_POLICY_HTML = `
<h1>Privacy Policy</h1>
<p style="color:#666; font-size:14px;">Effective Date: April 18, 2026</p>
<hr>

<h3>1. Introduction</h3>
<p>Welcome to the Community Resources Guide ("CRG," "we," "our," or "us"). We are committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard information when you use the Community Resources Guide application and website (the "Application").</p>
<p>CRG is an online, interactive tool designed to help charitable organizations assist clients in accessing financial and other resources in the Greater Houston area.</p>
<hr>

<h3>2. Information We Collect and Store</h3>
<p>We handle the following categories of information:</p>

<h4>Organization Resources</h4>
<p>We collect publicly available information about organizations that provide assistance in the Greater Houston area. This may include organization name, address, phone number, hours of operation, supported zip codes, types of assistance offered, and primary requirements.</p>
<p>Organizations may request removal of their information by contacting us at <strong>developer@operacha.org</strong>.</p>

<h4>Registered Users</h4>
<p>For registered organizations, we collect usage information associated with an assigned user ID. This includes which features are used, search criteria selected, and resources recommended to clients.</p>
<p>We do <strong>not</strong> collect or track IP addresses, cookies, device identifiers, or other personal data.</p>

<h4>Non-Registered Users</h4>
<p>Registration is not required to use CRG. For non-registered users, we collect only aggregated usage data (e.g., which features are used and general search patterns). This data is not associated with individual users.</p>
<p>Certain features, such as sending emails or generating PDFs, are available only to registered organizations.</p>

<h4>Client Data</h4>
<p>Staff and volunteers from registered organizations may enter client email addresses or phone numbers in order to send resource lists. Although these communications are initiated by registered organizations, emails are sent from CRG's domain and text messages are composed on the user's device using their own messaging application (such as Messages or Google Voice).</p>
<p>CRG does not store client email addresses, phone numbers, or other personally identifiable client information. When using the text feature, phone numbers and message content are held temporarily in the user's browser for the duration of the session and are not transmitted to CRG's servers.</p>
<p>Email delivery is handled by a third-party provider, <strong>Resend</strong>, which temporarily retains email metadata (recipient address, delivery status, and bounce information) for operational purposes such as delivery monitoring and troubleshooting. Access to this data is restricted and used solely to ensure reliable communication and protect CRG's email reputation.</p>
<p>Users who install the optional CRG Google Voice Helper browser extension may have phone numbers and message content stored momentarily in the browser's local extension storage to facilitate auto-filling Google Voice. This data is automatically deleted within seconds and is never transmitted to CRG or any third party.</p>
<p>Registered organizations are responsible for obtaining any necessary consent from their clients before sending emails or text messages through CRG.</p>

<h4>Usage Data</h4>
<p>We collect and store:</p>
<ul>
  <li>The name of the organization performing a search</li>
  <li>Zip codes, assistance types, organizations, and days of operation searched</li>
  <li>The number of emails sent</li>
</ul>
<p>We do <strong>not</strong> store client email addresses or phone numbers.</p>
<p>This information is used to maintain and improve the application, monitor capacity and performance, manage costs, and identify potential bottlenecks.</p>
<p>We also log queries submitted through the LLM Search &amp; Help features. These logs are used solely to improve the Help experience and underlying language model behavior. Logs are reviewed on a regular basis to train internal models and removed when no longer needed or in 90 days, whichever comes first. These logs are not used to identify individuals and are not shared or used to train external models.</p>
<hr>

<h3>3. How We Use Information</h3>
<p>We use collected information to:</p>
<ul>
  <li>Provide, maintain, and improve the Application</li>
  <li>Understand how features are used</li>
  <li>Generate usage statistics for registered organizations</li>
  <li>Identify popular resources and search patterns</li>
</ul>
<p>We may share non-proprietary best practices observed across organizations, but only with prior approval.</p>
<hr>

<h3>4. What We Do Not Do</h3>
<ul>
  <li>We sell nothing.</li>
  <li>We do not sell data, advertising, or access to the Application.</li>
  <li>We only share a client's email address or phone number when explicitly requested by the client and it is for the sole purpose of providing additional resources that the client is seeking.</li>
  <li>We do not disclose proprietary organizational data to anyone without prior approval.</li>
</ul>
<hr>

<h3>5. Data Security</h3>
<p>Our Application and databases are hosted by third-party providers. While we provide oversight and conduct periodic reviews, we rely on these providers to implement appropriate technical and organizational security measures.</p>
<p>No method of transmission or electronic storage is completely secure, and we cannot guarantee absolute security.</p>
<hr>

<h3>6. Changes to This Privacy Policy</h3>
<p>We may update this Privacy Policy from time to time. Any changes will be posted on this page with an updated effective date.</p>
<hr>

<h3>7. Contact Us</h3>
<p>If you have questions or concerns about this Privacy Policy, you may contact us by clicking <strong>"Contact Support"</strong> within the Application or by emailing <strong>developer@operacha.org</strong>.</p>
<p><strong>Omar Peracha</strong></p>
<p>April 18, 2026</p>
`;

// =============================================================================
// TERMS OF SERVICE CONTENT
// =============================================================================
const TERMS_OF_SERVICE_HTML = `
<h1>Terms of Service</h1>
<p style="color:#666; font-size:14px;">Effective Date: April 18, 2026</p>
<hr>

<h3>1. Data Accuracy</h3>
<p>Referral information is subject to change. Funding availability, eligibility criteria, and services offered by organizations may vary at any time. For the most current information regarding eligibility, requirements, and available services, users should contact the organization directly.</p>
<hr>

<h3>2. Non-Commercial Use</h3>
<p>The Community Resources Guide ("CRG") is a free tool designed to connect individuals and organizations with essential support services. Users are encouraged to use the Application freely and share it widely for charitable and informational purposes.</p>
<p>The information provided may not be used for commercial gain or reproduced for profit-driven activities without prior written permission.</p>
<hr>

<h3>3. No Liability</h3>
<p>While reasonable efforts are made to keep information accurate and up to date, CRG does not guarantee the completeness, accuracy, or reliability of any information provided.</p>
<p>CRG assumes no liability for errors, omissions, or discrepancies in the information presented. Users are responsible for verifying all details directly with the referenced organizations before relying on the information.</p>
<hr>

<h3>4. Data Privacy</h3>
<p>CRG does not store client contact information or other personally identifiable client data. Any client information shared between a registered organization and its clients is managed by that organization and governed by its own privacy practices.</p>
<p>CRG may collect limited, non-personal usage information as described in the Privacy Policy. For additional details on how information is handled, please review the <strong>Privacy Policy</strong>.</p>
<hr>

<h3>5. Intellectual Property</h3>
<p>The content, design, and structure of the Community Resources Guide are protected by copyright and other applicable intellectual property laws.</p>
<p>This resource is provided for personal and non-commercial use only. Reproduction, distribution, modification, or reuse of the content for commercial purposes without prior written permission is prohibited.</p>
<hr>

<h3>6. Contact</h3>
<p>Questions or concerns regarding these Terms may be directed to the developer by clicking <strong>"Contact Support"</strong> within the Application or by emailing <strong>developer@operacha.org</strong>.</p>
<p><strong>Omar Peracha</strong></p>
<p>April 18, 2026</p>
`;

// =============================================================================
// COMPONENT CODE - No need to modify below this line
// =============================================================================

const LegalPage = ({ loggedInUser }) => {
  const [activeTab, setActiveTab] = useState('privacy'); // 'privacy' or 'terms'

  return (
    <div className="h-screen flex flex-row overflow-hidden">
      {/* Main content area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* NavBar1 - Header */}
        <nav
          className="bg-navbar1-bg flex items-center justify-between"
          style={{
            height: 'var(--height-navbar1)',
            paddingLeft: 'var(--padding-navbar1-left)',
            paddingRight: 'var(--padding-navbar1-right)',
          }}
        >
          {/* Left side - Logo and Title */}
          <div
            className="flex items-center"
            style={{ gap: 'var(--gap-navbar1-logo-title)' }}
          >
            <img
              src="/images/CRG Logo 2025.webp"
              alt="CRG Logo"
              style={{
                width: 'var(--size-navbar1-logo)',
                height: 'var(--size-navbar1-logo)',
              }}
              className="object-contain"
            />
            <h1
              className="text-navbar1-title font-comfortaa"
              style={{
                fontSize: 'var(--font-size-navbar1-title)',
                fontWeight: 'var(--font-weight-navbar1-title)',
                letterSpacing: 'var(--letter-spacing-navbar1-title)',
              }}
            >
              Community Resources Guide Houston
            </h1>
          </div>

          {/* Right side - Page label */}
          <span
            className="font-opensans"
            style={{
              color: 'var(--color-navbar1-title)',
              fontSize: 'var(--font-size-navbar1-btn)',
              fontWeight: 'var(--font-weight-navbar1-btn)',
              letterSpacing: 'var(--letter-spacing-navbar1-btn)',
            }}
          >
            Legal
          </span>
        </nav>

        {/* NavBar2 - Tab selector */}
        <nav
          className="bg-navbar2-bg flex items-center"
          style={{
            height: 'var(--height-navbar2)',
            paddingLeft: 'var(--padding-navbar2-left)',
            paddingRight: 'var(--padding-navbar2-right)',
            gap: 'var(--gap-navbar2-mode-buttons)',
          }}
        >
          {/* Privacy Policy Tab */}
          <button
            onClick={() => setActiveTab('privacy')}
            className="font-opensans transition-all duration-200 hover:brightness-125"
            style={{
              height: 'var(--height-navbar2-btn)',
              paddingLeft: 'var(--padding-navbar2-btn-x)',
              paddingRight: 'var(--padding-navbar2-btn-x)',
              borderRadius: 'var(--radius-navbar2-btn)',
              fontSize: 'var(--font-size-navbar2-btn)',
              fontWeight: 'var(--font-weight-navbar2-btn)',
              letterSpacing: 'var(--letter-spacing-navbar2-btn)',
              backgroundColor: activeTab === 'privacy' ? 'var(--color-navbar2-btn-active-bg)' : 'transparent',
              color: activeTab === 'privacy' ? 'var(--color-navbar2-btn-active-text)' : 'var(--color-navbar2-btn-inactive-text)',
            }}
          >
            Privacy Policy
          </button>

          {/* Terms of Service Tab */}
          <button
            onClick={() => setActiveTab('terms')}
            className="font-opensans transition-all duration-200 hover:brightness-125"
            style={{
              height: 'var(--height-navbar2-btn)',
              paddingLeft: 'var(--padding-navbar2-btn-x)',
              paddingRight: 'var(--padding-navbar2-btn-x)',
              borderRadius: 'var(--radius-navbar2-btn)',
              fontSize: 'var(--font-size-navbar2-btn)',
              fontWeight: 'var(--font-weight-navbar2-btn)',
              letterSpacing: 'var(--letter-spacing-navbar2-btn)',
              backgroundColor: activeTab === 'terms' ? 'var(--color-navbar2-btn-active-bg)' : 'transparent',
              color: activeTab === 'terms' ? 'var(--color-navbar2-btn-active-text)' : 'var(--color-navbar2-btn-inactive-text)',
            }}
          >
            Terms of Service
          </button>
        </nav>

        {/* Main content - Legal text */}
        <main
          className="flex-1 overflow-y-auto p-8"
          style={{ backgroundColor: 'var(--color-page-background-cream)' }}
        >
          <div
            className="legal-content max-w-4xl mx-auto bg-white rounded-lg shadow-md p-8"
            style={{ fontFamily: 'var(--font-family-body)' }}
            dangerouslySetInnerHTML={{
              __html: activeTab === 'privacy' ? PRIVACY_POLICY_HTML : TERMS_OF_SERVICE_HTML
            }}
          />
        </main>

        {/* Footer */}
        <Footer />
      </div>

      {/* Vertical nav bar */}
      <VerticalNavBar />
    </div>
  );
};

export default LegalPage;
