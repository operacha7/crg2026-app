// src/views/LegalPage.js
// 2026 Redesign - Combined Privacy Policy and Terms of Service page
//
// TO UPDATE CONTENT:
// 1. Open your Google Doc
// 2. File > Download > Web Page (.html, zipped)
// 3. Extract the ZIP and open the .html file in a text editor
// 4. Copy the content inside the <> tag (not the whole file)
// 5. Paste it into PRIVACY_POLICY_HTML or TERMS_OF_SERVICE_HTML below

import React, { useState } from 'react';
import VerticalNavBar from '../layout/VerticalNavBar';
import Footer from '../layout/Footer';

// =============================================================================
// PRIVACY POLICY CONTENT - Paste your HTML here
// =============================================================================
const PRIVACY_POLICY_HTML = `
<p class="c3"><span class="c4 c12">Privacy Policy</span></p><p class="c3"><span class="c4">Effective Date:</span><span class="c0">&nbsp;January 23, 2026</span></p><hr><p class="c6"><span class="c0"></span></p><h3 class="c9" id="h.d9bmvnnguo8j"><span class="c1">1. Introduction</span></h3><p class="c3"><span class="c0">Welcome to the Community Resources Guide (&ldquo;CRG,&rdquo; &ldquo;we,&rdquo; &ldquo;our,&rdquo; or &ldquo;us&rdquo;). We are committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard information when you use the Community Resources Guide application and website (the &ldquo;Application&rdquo;).</span></p><p class="c3"><span class="c0">CRG is an online, interactive tool designed to help charitable organizations assist clients in accessing financial and other resources in the Greater Houston area.</span></p><hr><p class="c6"><span class="c0"></span></p><h3 class="c9" id="h.drpnfk2hjpkj"><span class="c1">2. Information We Collect and Store</span></h3><p class="c3"><span class="c0">We handle the following categories of information:</span></p><h4 class="c13" id="h.hshrwapoe4t5"><span class="c10">Organization Resources</span></h4><p class="c3"><span class="c0">We collect publicly available information about organizations that provide assistance in the Greater Houston area. This may include organization name, address, phone number, hours of operation, supported zip codes, types of assistance offered, and primary requirements.</span></p><p class="c3"><span class="c5">Organizations may request removal of their information by contacting us at </span><span class="c4">developer@operacha.org</span><span class="c0">.</span></p><h4 class="c13" id="h.msuaeil4qhva"><span class="c10">Registered Users</span></h4><p class="c3"><span class="c0">For registered organizations, we collect usage information associated with an assigned user ID. This includes which features are used, search criteria selected, and resources recommended to clients.</span></p><p class="c3"><span class="c5">We do </span><span class="c4">not</span><span class="c0">&nbsp;collect or track IP addresses, cookies, device identifiers, or other personal data.</span></p><h4 class="c13" id="h.fzt2dflxubmc"><span class="c10">Non-Registered Users</span></h4><p class="c3"><span class="c0">Registration is not required to use CRG. For non-registered users, we collect only aggregated usage data (e.g., which features are used and general search patterns). This data is not associated with individual users.</span></p><p class="c3"><span class="c0">Certain features, such as sending emails or generating PDFs, are available only to registered organizations.</span></p><h4 class="c13" id="h.1r42ay88ino5"><span class="c10">Client Data</span></h4><p class="c3"><span class="c0">Staff and volunteers from registered organizations may enter client email addresses in order to send resource lists. Although these emails are initiated by registered organizations, they are sent from CRG&rsquo;s domain.</span></p><p class="c3"><span class="c5">CRG does </span><span class="c4">not</span><span class="c0">&nbsp;store client email addresses or other personally identifiable client information.</span></p><p class="c3"><span class="c5">Email delivery is handled by a third-party provider, </span><span class="c4">Resend</span><span class="c0">, which temporarily retains email metadata (recipient address, delivery status, and bounce information) for operational purposes such as delivery monitoring and troubleshooting. Access to this data is restricted and used solely to ensure reliable communication and protect CRG&rsquo;s email reputation.</span></p><p class="c3"><span class="c0">Registered organizations are responsible for obtaining any necessary consent from their clients before sending emails through CRG.</span></p><h4 class="c13" id="h.flnfv6ue0uiu"><span class="c10">Usage Data</span></h4><p class="c3"><span class="c0">We collect and store:</span></p><ul class="c8 lst-kix_v6vc7sicl0dm-0 start"><li class="c2 li-bullet-0"><span class="c0">The name of the organization performing a search<br></span></li><li class="c2 li-bullet-0"><span class="c0">Zip codes, assistance types, organizations, and days of operation searched<br></span></li><li class="c2 li-bullet-0"><span class="c0">The number of emails sent<br></span></li></ul><p class="c3"><span class="c5">We do </span><span class="c4">not</span><span class="c0">&nbsp;store client email addresses.</span></p><p class="c3"><span class="c0">This information is used to maintain and improve the application, monitor capacity and performance, manage costs, and identify potential bottlenecks.</span></p><p class="c3"><span class="c0">We also log queries submitted through the LLM Search &amp; Help features. These logs are used solely to improve the Help experience and underlying language model behavior. Logs are reviewed on a regular basis to train internal models and removed when no longer needed or in 90 days, whichever comes first . These logs are not used to identify individuals and are not shared or used to train external models.</span></p><hr><p class="c6"><span class="c0"></span></p><h3 class="c9" id="h.d6j5lpsibuxc"><span class="c1">3. How We Use Information</span></h3><p class="c3"><span class="c0">We use collected information to:</span></p><ul class="c8 lst-kix_t0d8kjc05zxy-0 start"><li class="c2 li-bullet-0"><span class="c0">Provide, maintain, and improve the Application<br></span></li><li class="c2 li-bullet-0"><span class="c0">Understand how features are used<br></span></li><li class="c2 li-bullet-0"><span class="c0">Generate usage statistics for registered organizations<br></span></li><li class="c2 li-bullet-0"><span class="c0">Identify popular resources and search patterns<br></span></li></ul><p class="c3"><span class="c0">We may share non-proprietary best practices observed across organizations, but only with prior approval.</span></p><hr><p class="c6"><span class="c0"></span></p><h3 class="c9" id="h.myuug0ph7c4g"><span class="c1">4. What We Do Not Do</span></h3><ul class="c8 lst-kix_eigbl784fmm2-0 start"><li class="c2 li-bullet-0"><span class="c0">We sell nothing.</span></li><li class="c2 li-bullet-0"><span class="c0">We do not sell data, advertising, or access to the Application.<br></span></li><li class="c2 li-bullet-0"><span class="c0">We do not share client email addresses with anyone, including organizations who use this application.<br></span></li><li class="c2 li-bullet-0"><span class="c0">We do not disclose proprietary organizational data to anyone without prior approval.<br></span></li></ul><hr><p class="c6"><span class="c0"></span></p><h3 class="c9" id="h.sb6j54kdc3x7"><span class="c1">5. Data Security</span></h3><p class="c3"><span class="c0">Our Application and databases are hosted by third-party providers. While we provide oversight and conduct periodic reviews, we rely on these providers to implement appropriate technical and organizational security measures.</span></p><p class="c3"><span class="c0">No method of transmission or electronic storage is completely secure, and we cannot guarantee absolute security.</span></p><hr><p class="c6"><span class="c0"></span></p><h3 class="c9" id="h.gr5sarm31b1n"><span class="c1">6. Changes to This Privacy Policy</span></h3><p class="c3"><span class="c0">We may update this Privacy Policy from time to time. Any changes will be posted on this page with an updated effective date.</span></p><hr><p class="c6"><span class="c0"></span></p><h3 class="c9" id="h.umooe8d94oh8"><span class="c1">7. Contact Us</span></h3><p class="c3"><span class="c5">If you have questions or concerns about this Privacy Policy, you may contact us by clicking </span><span class="c4">&ldquo;Contact Support&rdquo;</span><span class="c5">&nbsp;within the Application or by emailing </span><span class="c4">developer@operacha.org</span><span class="c0">.</span></p><p class="c3"><span class="c4 c12">Omar Peracha</span></p><p class="c3"><span class="c5">January 23, 2026</span></p>
`;

// =============================================================================
// TERMS OF SERVICE CONTENT - Paste your HTML here
// =============================================================================
const TERMS_OF_SERVICE_HTML = `
<p class="c5"><span class="c2">Terms of Service</span></p><p class="c5"><span class="c3">Effective Date:</span><span class="c6">&nbsp;January 23, 2026</span></p><hr><p class="c0"><span class="c6"></span></p><h3 class="c1" id="h.vo7jwcdn52m8"><span class="c7 c3">1. Data Accuracy</span></h3><p class="c5"><span class="c6">Referral information is subject to change. Funding availability, eligibility criteria, and services offered by organizations may vary at any time. For the most current information regarding eligibility, requirements, and available services, users should contact the organization directly.</span></p><hr><p class="c0"><span class="c6"></span></p><h3 class="c1" id="h.4m3bkl32n04f"><span class="c7 c3">2. Non-Commercial Use</span></h3><p class="c5"><span class="c6">The Community Resources Guide (&ldquo;CRG&rdquo;) is a free tool designed to connect individuals and organizations with essential support services. Users are encouraged to use the Application freely and share it widely for charitable and informational purposes.</span></p><p class="c5"><span class="c6">The information provided may not be used for commercial gain or reproduced for profit-driven activities without prior written permission.</span></p><hr><p class="c0"><span class="c6"></span></p><h3 class="c1" id="h.2uwi5knfabaf"><span class="c3 c7">3. No Liability</span></h3><p class="c5"><span class="c6">While reasonable efforts are made to keep information accurate and up to date, CRG does not guarantee the completeness, accuracy, or reliability of any information provided.</span></p><p class="c5"><span class="c6">CRG assumes no liability for errors, omissions, or discrepancies in the information presented. Users are responsible for verifying all details directly with the referenced organizations before relying on the information.</span></p><hr><p class="c0"><span class="c6"></span></p><h3 class="c1" id="h.m7mh9iwv9041"><span class="c7 c3">4. Data Privacy</span></h3><p class="c5"><span class="c6">CRG does not store client contact information or other personally identifiable client data. Any client information shared between a registered organization and its clients is managed by that organization and governed by its own privacy practices.</span></p><p class="c5"><span class="c9">CRG may collect limited, non-personal usage information as described in the Privacy Policy. For additional details on how information is handled, please review the </span><span class="c3">Privacy Policy</span><span class="c6">.</span></p><hr><p class="c0"><span class="c6"></span></p><h3 class="c1" id="h.d26nc8644wi"><span class="c7 c3">5. Intellectual Property</span></h3><p class="c5"><span class="c6">The content, design, and structure of the Community Resources Guide are protected by copyright and other applicable intellectual property laws.</span></p><p class="c5"><span class="c6">This resource is provided for personal and non-commercial use only. Reproduction, distribution, modification, or reuse of the content for commercial purposes without prior written permission is prohibited.</span></p><hr><p class="c0"><span class="c6"></span></p><h3 class="c1" id="h.7vsvgkgki3t0"><span class="c7 c3">6. Contact</span></h3><p class="c5"><span class="c9">Questions or concerns regarding these Terms may be directed to the developer by clicking </span><span class="c3">&ldquo;Contact Support&rdquo;</span><span class="c9">&nbsp;within the Application or by emailing </span><span class="c3">developer@operacha.org</span><span class="c6">.</span></p><p class="c5"><span class="c2">Omar Peracha</span></p><p class="c5"><span class="c6">January 23, 2026</span></p><p class="c0"><span class="c6"></span></p><p class="c5 c8"><span class="c9 c10"></span></p>
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
