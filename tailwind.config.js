// tailwind.config.js
// Colors and other tokens reference CSS custom properties from src/styles/tokens.css
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Footer
        'footer-bg': 'var(--color-footer-bg)',
        'footer-text': 'var(--color-footer-text)',
        // Vertical Nav Bar
        'vertical-nav-accent': 'var(--color-vertical-nav-accent)',
        'vertical-nav-bg': 'var(--color-vertical-nav-bg)',
        // NavBar 1
        'navbar1-bg': 'var(--color-navbar1-bg)',
        'navbar1-title': 'var(--color-navbar1-title)',
        'navbar1-counter-text-filtered': 'var(--color-navbar1-counter-text-filtered)',
        'navbar1-counter-text-selected': 'var(--color-navbar1-counter-text-selected)',
        'navbar1-counter-filtered': 'var(--color-navbar1-counter-filtered)',
        'navbar1-counter-selected': 'var(--color-navbar1-counter-selected)',
        'navbar1-btn-email-bg': 'var(--color-navbar1-btn-email-bg)',
        'navbar1-btn-email-text': 'var(--color-navbar1-btn-email-text)',
        'navbar1-btn-pdf-bg': 'var(--color-navbar1-btn-pdf-bg)',
        'navbar1-btn-pdf-text': 'var(--color-navbar1-btn-pdf-text)',
        // NavBar 2
        'navbar2-bg': 'var(--color-navbar2-bg)',
        'navbar2-btn-inactive-bg': 'var(--color-navbar2-btn-inactive-bg)',
        'navbar2-btn-inactive-text': 'var(--color-navbar2-btn-inactive-text)',
        'navbar2-btn-inactive-border': 'var(--color-navbar2-btn-inactive-border)',
        'navbar2-btn-active-bg': 'var(--color-navbar2-btn-active-bg)',
        'navbar2-btn-active-text': 'var(--color-navbar2-btn-active-text)',
        'navbar2-dropdown-bg': 'var(--color-navbar2-dropdown-bg)',
        'navbar2-dropdown-text': 'var(--color-navbar2-dropdown-text)',
        'navbar2-link': 'var(--color-navbar2-link)',
        // NavBar 3
        'navbar3-bg': 'var(--color-navbar3-bg)',
        'navbar3-chip-active-bg': 'var(--color-navbar3-chip-active-bg)',
        'navbar3-chip-active-text': 'var(--color-navbar3-chip-active-text)',
        'navbar3-chip-inactive-bg': 'var(--color-navbar3-chip-inactive-bg)',
        'navbar3-chip-inactive-text': 'var(--color-navbar3-chip-inactive-text)',
        // Panel / Modal
        'panel-header-bg': 'var(--color-panel-header-bg)',
        'panel-body-bg': 'var(--color-panel-body-bg)',
        'panel-title': 'var(--color-panel-title)',
        'panel-subtitle': 'var(--color-panel-subtitle)',
        'panel-btn-cancel-bg': 'var(--color-panel-btn-cancel-bg)',
        'panel-btn-ok-bg': 'var(--color-panel-btn-ok-bg)',
        'panel-btn-text': 'var(--color-panel-btn-text)',
        // Assistance Panel
        'assistance-group1': 'var(--color-assistance-group1)',
        'assistance-group2': 'var(--color-assistance-group2)',
        'assistance-group3': 'var(--color-assistance-group3)',
        'assistance-group4': 'var(--color-assistance-group4)',
        'assistance-group5': 'var(--color-assistance-group5)',
        'assistance-group6': 'var(--color-assistance-group6)',
        'assistance-selected-bg': 'var(--color-assistance-selected-bg)',
        'assistance-text': 'var(--color-assistance-text)',
        // Results Header
        'results-header-bg': 'var(--color-results-header-bg)',
        'results-header-text': 'var(--color-results-header-text)',
        // Results Row
        'results-row-bg': 'var(--color-results-row-bg)',
        'results-row-even-bg': 'var(--color-results-row-even-bg)',
        'results-row-odd-bg': 'var(--color-results-row-odd-bg)',
        'results-row-selected-bg': 'var(--color-results-row-selected-bg)',
        'results-row-hover-bg': 'var(--color-results-row-hover-bg)',
        'results-row-border': 'var(--color-results-row-border)',
        'results-row-text': 'var(--color-results-row-text)',
        'results-hours-notes-bg': 'var(--color-results-hours-notes-bg)',
        'results-status-active-bg': 'var(--color-results-status-active-bg)',
        'results-status-limited-bg': 'var(--color-results-status-limited-bg)',
        'results-status-inactive-bg': 'var(--color-results-status-inactive-bg)',
        'results-assistance-icon': 'var(--color-results-assistance-icon)',
        // Reports (uses results tokens for consistency)
        'reports-row-hover': 'var(--color-results-row-hover-bg)',
      },
      fontFamily: {
        body: ["Lexend", "sans-serif"],
        lexend: ["Lexend", "sans-serif"],
        comfortaa: ["Comfortaa", "cursive"],
        label: ['"Montserrat"', "sans-serif"],
        opensans: ['"Open Sans"', "sans-serif"],
        handlee: ['"Marcellus SC"', "sans-serif"],
      },
      fontSize: {
        'footer': 'var(--font-size-footer)',
      },
      height: {
        'footer': 'var(--height-footer)',
      },
      scale: {
        '175': '1.75',
        '200': '2',
        '250': '2.5'
      },
      backgroundImage: {
        'mexico-gradient': 'linear-gradient(to right, #006847, white, #C90016)',
        'usa-gradient': 'linear-gradient(to right, #3C3B6E, white, #B22234)'
      }
    }
  }
};