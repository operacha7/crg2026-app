// src/views/TermsOfService.js
import React from "react";
import PageLayout from "../layout/PageLayout";

const TermsOfService = () => {
  return (
    <PageLayout>
      <div className="p-6 max-w-4xl mx-auto overflow-y-auto">
        <h1 className="text-3xl font-bold text-[#4A4E69] mb-6">Terms of Service</h1>
        
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">1. Agreement to Terms</h2>
          <p className="mb-4">
            By accessing or using the Community Resources Guide ("CRG"), you agree to be bound by these Terms of Service
            and all applicable laws and regulations. If you do not agree with any of these terms, you are prohibited from
            using this application.
          </p>
          
          <h2 className="text-xl font-semibold mb-4">2. Use License</h2>
          <p className="mb-4">
            Permission is granted to temporarily use the CRG for personal or organizational, non-commercial purposes only.
            This is the grant of a license, not a transfer of title, and under this license you may not:
          </p>
          <ul className="list-disc pl-6 mb-4">
            <li>Modify, copy or scrape the materials</li>
            <li>Use the materials for any commercial purpose</li>
            <li>Attempt to reverse engineer any software contained in the CRG</li>
            <li>Remove any copyright or other proprietary notations from the materials</li>
            <li>Transfer the materials to another person or "mirror" the materials on any other server</li>
          </ul>
          
          <h2 className="text-xl font-semibold mb-4">3. Disclaimer</h2>
          <p className="mb-4">
            The materials on the CRG are provided "as is". We make no warranties, expressed or implied, and hereby
            disclaim and negate all other warranties, including without limitation, implied warranties or conditions of
            merchantability, fitness for a particular purpose, or non-infringement of intellectual property or other
            violation of rights.
          </p>
          <p className="mb-4">
            Further, we do not warrant or make any representations concerning the accuracy, likely results, or reliability
            of the use of the materials on the application or otherwise relating to such materials or on any resources
            linked to this application.
          </p>
          
          <h2 className="text-xl font-semibold mb-4">4. Limitations</h2>
          <p className="mb-4">
            In no event shall CRG or its suppliers be liable for any damages (including, without limitation, damages for
            loss of data or profit, or due to business interruption) arising out of the use or inability to use the materials
            on the CRG, even if CRG or a CRG authorized representative has been notified orally or in writing of the
            possibility of such damage.
          </p>
          
          <h2 className="text-xl font-semibold mb-4">5. Accuracy of Materials</h2>
          <p className="mb-4">
            The materials appearing in the CRG could include technical, typographical, or photographic errors. CRG does
            not warrant that any of the materials on its application are accurate, complete, or current. CRG may make
            changes to the materials contained on its application at any time without notice.
          </p>
          
          <h2 className="text-xl font-semibold mb-4">6. Links</h2>
          <p className="mb-4">
            CRG has not reviewed all of the sites linked to its application and is not responsible for the contents of
            any such linked site. The inclusion of any link does not imply endorsement by CRG of the site. Use of any
            such linked website is at the user's own risk.
          </p>
          
          <h2 className="text-xl font-semibold mb-4">7. Modifications to Terms of Service</h2>
          <p className="mb-4">
            CRG may revise these terms of service for its application at any time without notice. By using this application
            you are agreeing to be bound by the then current version of these terms of service.
          </p>
          
          <h2 className="text-xl font-semibold mb-4">8. Governing Law</h2>
          <p className="mb-4">
            These terms and conditions are governed by and construed in accordance with the laws of the State of Texas
            and you irrevocably submit to the exclusive jurisdiction of the courts in that State.
          </p>
          
          <p className="text-sm text-gray-600 mt-8">
            Last updated: May 2025
          </p>
        </div>
      </div>
    </PageLayout>
  );
};

export default TermsOfService;