// src/views/AboutPage.js
// Public /about page — E-E-A-T trust signal for SEO and the destination of
// the "About" links in HomeNavBar and the site-wide footer.
//
// Markup notes (these matter for SEO; layout doesn't):
//   - Single H1 ("Why I Built This") opens the page; no page-level "About …" H1.
//     The <title> in <head> handles page-level identification.
//   - H2s mark the section outline (What's in the Guide / Who It's For / Contact).
//   - All copy is real text (no images of text).

import React from "react";
import { Helmet } from "react-helmet-async";
import HomeNavBar from "../layout/HomeNavBar";
import Footer from "../layout/Footer";

const PROSE_TEXT_COLOR = "#222831";
const HEADING_COLOR = "var(--color-home-h1)";

export default function AboutPage() {
  return (
    <div className="min-h-dvh lg:h-dvh flex flex-col lg:overflow-hidden">
      <Helmet>
        <title>About | CRG Houston — Community Resources Guide</title>
        <meta
          name="description"
          content="Free directory of 1,000+ community resources from 526 organizations across the Greater Houston Area, serving clients and caseworkers since 2008."
        />
        <link rel="canonical" href="https://crghouston.org/about" />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://crghouston.org/about" />
        <meta property="og:title" content="About | CRG Houston — Community Resources Guide" />
        <meta
          property="og:description"
          content="Free directory of 1,000+ community resources from 526 organizations across the Greater Houston Area, serving clients and caseworkers since 2008."
        />
      </Helmet>

      <HomeNavBar />

      <main
        className="flex-1 flex flex-col items-center lg:overflow-y-auto"
        style={{
          backgroundColor: "var(--color-home-right-area-bg)",
          paddingTop: 40,
          paddingBottom: 40,
          paddingLeft: 16,
          paddingRight: 16,
        }}
      >
        <article
          style={{
            background: "var(--color-home-panel-bg)",
            borderRadius: 14,
            padding: "32px 36px",
            width: 800,
            maxWidth: "100%",
            boxShadow: "0 6px 24px rgba(0, 0, 0, 0.18)",
            color: PROSE_TEXT_COLOR,
            fontFamily: "var(--font-family-body)",
            lineHeight: 1.6,
            fontSize: 16,
          }}
        >
          <h1
            style={{
              color: HEADING_COLOR,
              fontSize: "clamp(24px, 2.4vw, 34px)",
              fontWeight: 700,
              lineHeight: 1.2,
              marginBottom: 18,
            }}
          >
            Why I Built This
          </h1>

          <p style={{ marginBottom: 14 }}>
            I&rsquo;m Omar Peracha. I built this guide because of a specific
            challenge I encountered while answering phone calls from neighbors
            in need.
          </p>
          <p style={{ marginBottom: 14 }}>
            After a 27-year career in finance at Chevron and Shell, I retired
            to travel and pursue long-distance hiking. Eventually I looked for
            ways to give back locally, and started volunteering with the
            Society of St. Vincent de Paul and the Christian Community Service
            Center.
          </p>
          <p style={{ marginBottom: 14 }}>
            Both organizations get constant calls for financial assistance, and
            when a caller&rsquo;s needs fell outside our service area we relied
            on paper referral directories. They had real limitations: multiple
            directories meant multiple versions of the truth, updates were
            difficult so the data went stale, and the time pressure of a phone
            call usually meant we could share only two or three resources
            before moving on.
          </p>
          <p style={{ marginBottom: 14 }}>
            At my jobs I was always drawn to solving problems through code.  Due
            to the rigidity of the companies, sometimes surreptitiously, 
            often falling back on the old adage of asking for forgiveness rather than
            permission.  So I started a Google Sheet of 100 referrals to
            do better. As it grew, it had to get more interactive: data
            validation, then scripts, then a real application with its own
            database. I&rsquo;m now on version 8. These days the actual coding
            is done by Claude Code while I focus on design, data integrity,
            and maintenance &mdash; including refreshing financial assistance
            providers at least twice a year, since their funding and program
            rules change frequently.
          </p>
          <p style={{ marginBottom: 24 }}>
            The site is free, has no ads, and exists for one reason: when
            someone reaches out for help, they should get the most
            comprehensive and current options available &mdash; not just two
            or three pulled from an out-of-date page.
          </p>

          <h2
            style={{
              color: HEADING_COLOR,
              fontSize: "clamp(20px, 1.8vw, 24px)",
              fontWeight: 700,
              marginTop: 8,
              marginBottom: 12,
            }}
          >
            What&rsquo;s in the Guide
          </h2>
          <p style={{ marginBottom: 14 }}>
            The directory contains over 1,000 resources from 526 organizations
            across the Greater Houston Area &mdash; nonprofits, government
            agencies, faith-based organizations, and community programs. When
            an organization offers more than one type of help, each is its own
            entry, so a single organization can appear as several resources.
          </p>
          <p style={{ marginBottom: 14 }}>
            Each listing shows contact details, hours of operation, eligibility
            requirements, the zip codes the resource serves, distance from your
            search zip code, and a current status &mdash; active, limited,
            inactive, or closed. Organizations are never removed from the
            directory; when a program closes, the entry stays, marked closed,
            so nothing is silently missing.
          </p>
          <p style={{ marginBottom: 8 }}>Coverage spans:</p>
          <ul style={{ marginBottom: 24, paddingLeft: 24, listStyle: "disc" }}>
            <li style={{ marginBottom: 4 }}>14 counties</li>
            <li style={{ marginBottom: 4 }}>136 cities</li>
            <li style={{ marginBottom: 4 }}>284 zip codes</li>
            <li style={{ marginBottom: 4 }}>
              30 categories of assistance, from emergency food to long-term
              housing
            </li>
          </ul>

          <h2
            style={{
              color: HEADING_COLOR,
              fontSize: "clamp(20px, 1.8vw, 24px)",
              fontWeight: 700,
              marginTop: 8,
              marginBottom: 12,
            }}
          >
            Who It&rsquo;s For
          </h2>
          <ul style={{ marginBottom: 24, paddingLeft: 24, listStyle: "disc" }}>
            <li style={{ marginBottom: 8 }}>
              <strong>Individuals and families</strong> &mdash; Anyone in the
              Greater Houston Area seeking help for themselves or a loved one.
              No account or signup required.
            </li>
            <li>
              <strong>Navigators and caseworkers</strong> &mdash; Built for
              social workers, case managers, hospital discharge planners,
              school counselors, and others helping clients access services.
              Registered partner organizations get additional features:
              emailing or texting customized resource lists to clients, and
              generating PDF handouts.
            </li>
          </ul>

          <h2
            style={{
              color: HEADING_COLOR,
              fontSize: "clamp(20px, 1.8vw, 24px)",
              fontWeight: 700,
              marginTop: 8,
              marginBottom: 12,
            }}
          >
            Contact
          </h2>
          <p style={{ marginBottom: 12 }}>
            If you represent an organization and would like to request an
            account, update resource information, or suggest a new resource,
            please reach out directly:
          </p>
          <p>
            <a
              href="mailto:info@crghouston.org"
              style={{ color: "var(--color-link)", textDecoration: "underline" }}
            >
              info@crghouston.org
            </a>
          </p>
        </article>
      </main>

      <Footer />
    </div>
  );
}
