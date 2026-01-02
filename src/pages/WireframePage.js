import React, { useState } from "react";
import SwingingSign from "../components/SwingingSign";
import LanguageSwitcher from "../components/LanguageSwitcher";
import ZipCodeSearch from "../components/ZipCodeSearch";
import ContactForm from "../components/ContactForm";
import SearchResults from "../components/SearchResults";
import EmailDialog from "../components/EmailDialog";
import { TourProvider } from "../Contexts/TourProvider";

// 🔧 Optional: Dummy zip list for ZipCodeSearch
const mockZips = ["77001", "77002", "77003", "77004"];

export default function WireframePage() {
  const [selectedZip, setSelectedZip] = useState("");
  const [showEmailDialog, setShowEmailDialog] = useState(false);

  const mockSearchResults = [
    {
      id: "r1",
      priority: "01",
      organization: "ABC Charities",
      assistanceType: "Rent",
      address: "123 Main St",
      phone: "555-1234",
      hours: "Mon–Fri 9am–5pm",
      requirements: ["Photo ID", "Proof of Income"],
      status: "Confirmed Open",
    },
    {
      id: "r2",
      priority: "02",
      organization: "Helping Hands",
      assistanceType: "Utilities",
      address: "456 Oak St",
      phone: "555-6789",
      hours: "Tue–Sat 10am–4pm",
      requirements: ["Bill Copy", "Proof of Residence"],
      status: "Confirmed Open",
    },
  ];

  const mockUser = { registered_organization: "ABC Charities" };
  const mockSelectedData = mockSearchResults.map((r) => ({
    ...r,
    isChecked: true,
  }));

  console.log("showEmailDialog:", showEmailDialog);

  return (
    <TourProvider>
      <div className="max-w-3xl mx-auto p-6 space-y-10 bg-white shadow rounded">
        {/* Header */}
        <SwingingSign organizationName="ABC Charities" />

        {/* Language Switcher */}
        <div className="flex justify-end">
          <LanguageSwitcher />
        </div>

        {/* Zip Code Search */}
        <ZipCodeSearch
          zips={mockZips}
          selectedZip={selectedZip}
          setSelectedZip={setSelectedZip}
        />

        {/* Contact Form */}
        <ContactForm loggedInUser={mockUser} />

        {/* Search Results */}
        <SearchResults
          records={mockSearchResults}
          section="Zip"
          selectedRecords={mockSelectedData}
          setSelectedRecords={() => {}}
        />

        {/* Trigger Email Dialog */}
        <div className="text-center">
          <button
            onClick={() => setShowEmailDialog(true)}
            className="mt-6 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded"
          >
            Open Email Dialog
          </button>
        </div>

        {/* Email Dialog */}
        {showEmailDialog && (
          <EmailDialog
            onClose={() => setShowEmailDialog(false)}
            onSuccess={() => alert("Success")}
            selectedData={mockSelectedData}
            userDetails={{ name: "John Doe", email: "john@example.com" }}
            selectedZip="77001"
            loggedInUser={mockUser}
            isPdfMode={false}
          />
        )}
      </div>
    </TourProvider>
  );
}