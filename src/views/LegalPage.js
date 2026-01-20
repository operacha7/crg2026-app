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
<h1 class="c12 c15" id="h.lj0ro75rw3qk"><span class="c6">Terms of Service</span></h1><h2 class="c2 c8" id="h.j79qr022kgx4"><span class="c9"></span></h2><h2 class="c2" id="h.a2hohc29iwf"><span class="c5">1. Data Accuracy</span></h2><p class="c2"><span class="c10">Referral information is subject to change. &nbsp;Funding, eligibility criteria, and services offered may vary. &nbsp;For the most up-to-date information on program eligibility, requirements, and available services, please contact the organization directly.</span></p><p class="c2 c11"><span class="c10"></span></p><h2 class="c2" id="h.oc0qsrw983yq"><span class="c5">2. Non-Commercial Use</span></h2><p class="c0"><span class="c4">The Community Resources Guide is a free tool designed to connect individuals and organizations with essential support services. We encourage you to use it freely and share it widely. However, we ask that the information not be used for commercial gain or reproduced for profit-driven activities.</span></p><p class="c11 c12"><span class="c16 c13"></span></p><h2 class="c2" id="h.mm186l92i30z"><span class="c5">3. No Liability</span></h2><p class="c0"><span class="c4">While we strive to ensure the information provided in this guide is accurate and up-to-date, we cannot guarantee its completeness. We accept no liability for any errors, omissions, or discrepancies. Users are encouraged to verify all details directly with the referenced organizations.</span></p><p class="c0 c11"><span class="c1"></span></p><h2 class="c2" id="h.biehl2t1e9an"><span class="c9">4. Data Privacy</span></h2><p class="c0"><span class="c4">The Community Resources Guide itself does not collect, store, or share any client or user personal data. The privacy of client information is governed by the policies and practices of the referring organizations. For questions about privacy, please contact the referring organization directly. &nbsp;For more information about how we handle privacy, please see our Privacy Policy.</span></p><p class="c0 c11"><span class="c1"></span></p><h2 class="c2" id="h.6x7c7io7eagy"><span class="c9">5. Intellectual Property</span></h2><p class="c0"><span class="c4">The content, design, and structure of the Community Resources Guide are protected by copyright and other intellectual property laws. This resource is provided for personal and non-commercial use only. Any reproduction, distribution, or modification of the content without prior written permission is prohibited.</span></p><p class="c0 c11"><span class="c1"></span></p><h2 class="c2" id="h.gprs1vctshc4"><span class="c9">6. Contact Us</span></h2><p class="c0"><span class="c4">You may message the developer by clicking on &quot;Contact Support&quot; in the bottom right hand corner of the application or sending an email to developer@operacha.org.</span></p><p class="c12 c11"><span class="c13 c16"></span></p><p class="c12"><span class="c16 c13">Omar Peracha</span></p><p class="c12"><span class="c13">January 10, 2026</span></p><p class="c12 c11"><span class="c14"></span></p><p class="c0 c11"><span class="c1"></span></p>
`;

// =============================================================================
// TERMS OF SERVICE CONTENT - Paste your HTML here
// =============================================================================
const TERMS_OF_SERVICE_HTML = `
<h1 class="c13 c21" id="h.lj0ro75rw3qk"><span class="c17">Privacy Policy</span></h1><h2 class="c2" id="h.2vog4r39olvh"><span class="c14"></span></h2><h2 class="c4" id="h.qyloz6gqy284"><span class="c6">1. Introduction</span></h2><p class="c4"><span class="c0">Welcome to the Community Resources Guide (&quot;CRG&quot;). We are committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our application.</span></p><p class="c4"><span class="c10 c24">CRG is an online, interactive tool to help charitable organizations assist clients in </span><span class="c10 c24">need access</span><span class="c0">&nbsp;financial and other resources in the Greater Houston area.</span></p><p class="c12"><span class="c3"></span></p><h2 class="c4" id="h.mpsli3a2dexq"><span class="c6">2. Information We Collect &amp; Store</span></h2><p class="c4"><span class="c3">There are four categories of information that we handle. This is what we do with each.</span></p><ul class="c1 lst-kix_xny0miokp33r-0 start"><li class="c9 li-bullet-0"><span class="c8">Organization Resources</span><span class="c11 c10"><br></span><span class="c10 c24">We collect publicly available data of organizations that provide assistance in the Greater Houston area. In addition to organization name, we collect and store address, phone number, hour of operation, zip codes they support, types of assistance and some of their primary requirements. Any organization may have their data removed by contacting us at </span><span class="c19 c27"><a class="c25" href="mailto:developer@operacha.org">developer@operacha.org</a></span><span class="c0">.</span></li></ul><p class="c7"><span class="c0"></span></p><ul class="c1 lst-kix_xny0miokp33r-0"><li class="c9 li-bullet-0"><span class="c8">Registered Users</span><span class="c11 c10"><br></span><span class="c0">For registered organizations we record what features they use, which criteria they filter on and who they recommend to their clients (see Usage Data below). &nbsp;This is recorded against the user id that they are assigned. &nbsp;We do not track, record or use anyone&rsquo;s IP address, cookies or any other personal data.</span></li></ul><p class="c7"><span class="c0"></span></p><ul class="c1 lst-kix_xny0miokp33r-0"><li class="c9 li-bullet-0"><span class="c8">Non-Registered Users</span><span class="c11 c10"><br></span><span class="c10 c24">You do not have to be registered to use this application. &nbsp;Anyone can access it without a passcode. &nbsp;For non-registered users we track nothing by specific user. &nbsp;What features are used, the filter criteria, etc. is recorded for non-registered users as a single group. &nbsp;The benefit of registering is the ability to send email and create Pdfs from the application. &nbsp;Non-registered users do not have this capability.</span></li></ul><p class="c7"><span class="c0"></span></p><ul class="c1 lst-kix_xny0miokp33r-0"><li class="c9 li-bullet-0"><span class="c8">Client Data</span><span class="c10 c11"><br></span><span class="c10 c24">Staff and volunteers from Registered Organizations get email addresses from clients in order to send them a list of resources. Although initiated by Registered Organizations, emails are sent from CRG&#39;s domain. </span><span class="c10 c29">We do not store any client information or other publicly identifiable information in our systems. &nbsp;</span><span class="c0">Our email delivery is handled by a third party provider, Resend. They temporarily retain email metadata, recipient address and delivery status for operational purposes. This allows Resend and CRG to monitor and troubleshoot any issues, i.e. delivery failures or bounced messages. Excessive bounced messages have a reputational impact on CRG. Access to data maintained by Resend is restricted and used only to ensure reliable communication. &nbsp;</span></li></ul><p class="c7"><span class="c0"></span></p><ul class="c1 lst-kix_xny0miokp33r-0"><li class="c9 li-bullet-0"><span class="c8">Usage Data</span><span class="c11 c10"><br></span><span class="c0">We collect and store the name of the organization that made the search. We also collect zip codes, assistance types, organizations, and days of operation searched and the number of emails sent. We do not record the email addresses. We collect this data to maintain the application and to stay ahead of capacity requirements. We also use this information to improve performance and mitigate any bottlenecks and manage our costs.</span></li></ul><p class="c7 c22"><span class="c3"></span></p><p class="c7 c22"><span class="c3"></span></p><h2 class="c4" id="h.u6edikh2rlx1"><span class="c6">3. How We Use Your Information</span></h2><p class="c4"><span class="c0">We use the information we collect to:</span></p><ul class="c1 lst-kix_27z1xtmk7g3a-0 start"><li class="c9 li-bullet-0"><span class="c0">Provide, maintain, and improve our services</span></li><li class="c9 li-bullet-0"><span class="c0">Understand how users interact with our application</span></li><li class="c9 li-bullet-0"><span class="c0">Generate usage statistics for registered organizations</span></li><li class="c9 li-bullet-0"><span class="c0">Identify popular resources and search patterns</span></li><li class="c9 li-bullet-0"><span class="c0">We may share non-proprietary, best practices by one organization with others but only with prior approval.</span></li></ul><p class="c7 c22"><span class="c3"></span></p><h2 class="c4" id="h.68knyiy7m4he"><span class="c6">4. What We Do Not Do</span></h2><p class="c4"><span class="c3">We do not share client email addresses with anyone. This includes registered organizations and even if they initiated the client email. We do not share or disclose an organization&#39;s proprietary information with anyone.</span></p><p class="c4"><span class="c3">We sell nothing. &nbsp;We do not sell advertising, access to the application or usage data.</span></p><p class="c7 c18"><span class="c3"></span></p><p class="c12"><span class="c3"></span></p><h2 class="c4" id="h.vk9ukb4zn8d"><span class="c6">5. Data Security</span></h2><p class="c4"><span class="c3">Our website and databases are hosted by third parties and while we provide oversight and review we rely on them for appropriate technical and organizational measures to protect the information we collect and store. We recognize that no method of transmission over the Internet or electronic storage is 100% secure.</span></p><p class="c7 c18"><span class="c3"></span></p><h2 class="c4" id="h.ncrc09xuu1hy"><span class="c6">6. Changes to This Privacy Policy</span></h2><p class="c4"><span class="c3">We may update our Privacy Policy from time to time. We will notify users of any changes by posting the new Privacy Policy on this page.</span></p><p class="c7 c18"><span class="c3"></span></p><h2 class="c4" id="h.d7w3b54asl4u"><span class="c6">7. Contact Us</span></h2><p class="c16"><span class="c20">You may message the developer by clicking on &quot;Contact Support&quot; in the bottom right hand corner of the application or sending an email to </span><span class="c19"><a class="c25" href="mailto:developer@operacha.org">developer@operacha.org</a></span><span class="c20">.</span></p><p class="c5"><span class="c3"></span></p><p class="c13"><span class="c10 c26">Omar Peracha</span></p><p class="c13"><span class="c10">January 10, 2026</span></p><p class="c13 c23"><span class="c26 c28"></span></p>
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
              color: '#F3EED9',
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
          style={{ backgroundColor: '#F3EED9' }}
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
