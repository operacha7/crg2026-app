# React Email Templates

This folder contains React Email templates for the CRG Houston application.

## Structure

```
src/emails/
├── ResourceEmail.jsx       # Main email template
├── components/
│   ├── ResourceCard.jsx    # Individual resource display
│   └── HoursTable.jsx      # Hours formatting component
├── index.js                # Exports
└── README.md               # This file
```

## Installation

First, install the React Email package:

```bash
npm install @react-email/components
```

## Usage

### Option 1: Render in the browser (simple integration)

Update `src/services/emailService.js`:

```javascript
import { render } from '@react-email/render';
import { ResourceEmail } from '../emails';

export async function sendEmail({
  recipient,
  selectedData,
  searchContext,
  loggedInUser,
  orgPhone,
}) {
  const headerText = generateSearchHeader(searchContext);

  // Render React Email template to HTML string
  const emailHtml = await render(
    <ResourceEmail
      resources={selectedData}
      headerText={headerText}
      orgPhone={orgPhone}
    />
  );

  // Send via existing Cloudflare Function
  const payload = {
    recipient,
    subject: 'Resources & Support Information',
    htmlBody: emailHtml,
    organization: loggedInUser?.reg_organization,
  };

  const res = await fetch('/sendEmail', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const result = await res.json();
  if (!result.success) {
    throw new Error('Email failed to send.');
  }

  return { success: true, recipient, count: selectedData.length };
}
```

### Option 2: Preview emails during development

Install the React Email CLI:

```bash
npm install react-email --save-dev
```

Add a script to package.json:

```json
{
  "scripts": {
    "email:dev": "email dev --dir src/emails"
  }
}
```

Run `npm run email:dev` to open a preview server at http://localhost:3001

## Benefits over raw HTML strings

1. **Component reusability** - Share components between email and PDF templates
2. **Type safety** - Props are validated
3. **Better DX** - JSX is easier to read/maintain than template literals
4. **Cross-client compatibility** - React Email handles quirks in Gmail, Outlook, etc.
5. **Preview server** - See changes instantly during development
6. **Spam score checking** - React Email can analyze your emails for spam triggers

## Migration Notes

The original `formatResourcesHtml()` function in `emailService.js` is ~170 lines of template literals. The React Email equivalent is:

- `ResourceEmail.jsx` - ~180 lines (main template)
- `ResourceCard.jsx` - ~100 lines (resource display)
- `HoursTable.jsx` - ~80 lines (hours formatting)

Total: ~360 lines, but much more maintainable and reusable.
