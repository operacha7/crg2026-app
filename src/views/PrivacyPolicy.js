// src/views/PrivacyPolicy.js
import React from "react";
import PageLayout from "../layout/PageLayout";

const PrivacyPolicy = () => {
  return (
    <PageLayout>
      <div className="p-6 max-w-4xl mx-auto overflow-y-auto">
        <h1 className="text-3xl font-bold text-[#4A4E69] mb-6">Privacy Policy</h1>
        
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">1. Introduction</h2>
          <p className="mb-4">
            Welcome to the Community Resources Guide ("CRG"). We are committed to protecting your privacy. This Privacy
            Policy explains how we collect, use, disclose, and safeguard your information when you use our
            application.</p>
            <p>
            CRG is an online, interactive tool to help charitable organizations
            assist clients in need access financial and other resources in the Greater Houston area.
          </p><br />
          
          <h2 className="text-xl font-semibold mb-4">2. Information We Collect & Store</h2>
          <p className="mb-4">
            There are four categories of information that we handle. This is what we do with each.
          </p>
          <ul className="list-disc pl-6 mb-4">
            <li>
                <span className="font-bold underline">Organization Resources</span><br />
                We collect publicly available data of organizations that provide assistance
                in the Greater Houston area. In addition to organization name, we collect and store
                address, phone number, hour of operation, zip codes they support, types of assistance
                and some of their primary requirements. Any organization may have their data removed by
                contacting us at crghouston1@gmail.com.
            </li><br />
            <li>
            <span className="font-bold underline">Registered Organization Data</span><br />
                For registered organizations, those with access to the tool, we collect and store
                contact information, i.e. email address and phone number. This is used to communicate
                changes to the application and any other pertinent information.
                </li><br />
            <li><span className="font-bold underline">Client Data</span><br />
                Staff and volunteers from Registered Organizations get email addresses from
                clients in order to send them a list of resources. Although initiated by 
                Registered Organizations, emails are sent from CRG's domain. <span className="font-bold text-red-600">
                We do not store any client information or other publicly identifiable information in our systems.</span>  
                Our email delivery is handled by a third party provider, Resend. They temporarily retain email metadata, recipient address
                and delivery status for operational purposes. This allows Resend and CRG to monitor
                and troubleshoot any issues, i.e. delivery failures or bounced messages. Excessive bounced
                messages have a reputational impact on CRG. Access to data maintained by Resend is restricted
                and used only to ensure reliable communication.
                </li><br />
            <li><span className="font-bold underline">Usage Data</span><br />
                We collect and store the name of the organization that made the search. We also collect zip codes, assistance types,
                organizations, and days of operation searched and the number of emails sent. We do not record the email addresses.  
                We collect this data to maintain the application and to stay ahead of capacity requirements. We also use this information
                to improve performance and mitigate any bottlenecks and manage our costs.
                
                </li><br />
          </ul>
          
          <h2 className="text-xl font-semibold mb-4">3. How We Use Your Information</h2>
          <p className="mb-4">
            We use the information we collect to:
          </p>
          <ul className="list-disc pl-6 mb-4">
            <li>Provide, maintain, and improve our services</li>
            <li>Understand how users interact with our application</li>
            <li>Generate usage statistics for registered organizations</li>
            <li>Identify popular resources and search patterns</li>
            <li>We may share non-proprietary, best practices by one organization with others but only with prior approval.</li>
          </ul>
          
          <h2 className="text-xl font-semibold mb-4">4. What We Do Not Do</h2>
          <p className="mb-4">
            We do not share client email addresses with anyone. This includes registered organizations 
            and even if they initiated the client email.  We do not share or disclose an
            organization's proprietary information with anyone.
            </p>
            <p>We do not sell anything.</p><br />
        
          
          <h2 className="text-xl font-semibold mb-4">5. Data Security</h2>
          <p className="mb-4">
            Our website and databases are hosted by third parties and while we provide oversight and review we rely on
            them for appropriate technical and organizational measures to protect the information
            we collect and store. We recognize that no method of transmission over the Internet or electronic
            storage is 100% secure.
          </p>
          
          <h2 className="text-xl font-semibold mb-4">6. Changes to This Privacy Policy</h2>
          <p className="mb-4">
            We may update our Privacy Policy from time to time. We will notify users of any changes
            by posting the new Privacy Policy on this page.
          </p>
          
          <h2 className="text-xl font-semibold mb-4">7. Contact Us</h2>
          <p className="mb-4">
            If you have any questions about this Privacy Policy, please contact us at: crghouston1@gmail.com.
          </p>
          
          <p className="text-sm text-gray-600 mt-8">
            Last updated: May 2025
          </p>
        </div>
      </div>
    </PageLayout>
  );
};

export default PrivacyPolicy;