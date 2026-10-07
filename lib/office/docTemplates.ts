import type { CoverOptions, TocOptions } from "@/lib/office/composeDocument";
import type { PageSettings } from "@/lib/office/pageSettings";

export interface DocTemplate {
  id: string;
  name: string;
  description: string;
  /** theme id from docThemes */
  themeId: string;
  markdown: string;
  page?: Partial<PageSettings>;
  cover?: Partial<CoverOptions>;
  toc?: Partial<TocOptions>;
}

export const BLANK_TEMPLATE_ID = "blank";

export const DOC_TEMPLATES: DocTemplate[] = [
  {
    id: BLANK_TEMPLATE_ID,
    name: "Blank",
    description: "Start from an empty page",
    themeId: "clean",
    markdown: "# Untitled document\n\nStart writing here…\n",
  },
  {
    id: "invoice",
    name: "Invoice",
    description: "Bill-to block, line items table and totals",
    themeId: "modern",
    page: { footerText: "Thank you for your business  ·  {page}/{pages}", pageNumbers: false, footerAlign: "center" },
    markdown: `# INVOICE

**Invoice no.** INV-2026-001  
**Date** {date}  
**Due** 30 days after the invoice date

| From | Bill to |
| --- | --- |
| **Your Company Ltd**<br>12 Example Street<br>City, Country<br>billing@yourcompany.com | **Client Name**<br>34 Client Avenue<br>City, Country<br>accounts@client.com |

## Items

| Description | Qty | Unit price | Amount |
| --- | ---: | ---: | ---: |
| Website design | 1 | 1,200.00 | 1,200.00 |
| Hosting (12 months) | 1 | 240.00 | 240.00 |
| Support hours | 5 | 60.00 | 300.00 |

**Subtotal** 1,740.00  
**Tax (10%)** 174.00  
**Total due** **1,914.00**

## Payment

Bank transfer to IBAN XX00 0000 0000 0000, quoting the invoice number.
`,
  },
  {
    id: "resume",
    name: "Resume / CV",
    description: "One-page résumé with experience and skills",
    themeId: "modern",
    page: { marginMm: 15, pageNumbers: false },
    markdown: `# Alex Morgan

alex.morgan@email.com · +1 555 010 2030 · City, Country · linkedin.com/in/alexmorgan

## Summary

Product-minded software engineer with 8 years of experience building fast, accessible web apps.

## Experience

### Senior Engineer — Example Corp
*2022 – present*

- Led a team of five shipping a design system used by 40 products
- Cut page load time by 45% through code-splitting and caching

### Engineer — Sample Inc.
*2018 – 2022*

- Built the billing dashboard used by 12,000 customers
- Mentored four junior developers

## Education

**B.Sc. Computer Science** — University of Example, 2018

## Skills

TypeScript · React · Node.js · PostgreSQL · Accessibility · Testing
`,
  },
  {
    id: "letter",
    name: "Business letter",
    description: "Sender, date, recipient and a formal body",
    themeId: "formal",
    markdown: `**Your Name**  
12 Example Street  
City, Country  
you@email.com

{date}

**Recipient Name**  
Company Name  
34 Client Avenue  
City, Country

Dear Recipient,

I am writing to … Explain the purpose of the letter in the first paragraph.

Add the supporting details in the second paragraph. Keep it short and specific.

Thank you for your time and consideration. I look forward to hearing from you.

Sincerely,

**Your Name**
`,
  },
  {
    id: "report",
    name: "Report",
    description: "Cover page, contents and numbered sections",
    themeId: "report",
    cover: { enabled: true, title: "Annual Report", subtitle: "Findings and recommendations" },
    toc: { enabled: true, maxLevel: 2 },
    page: { headerText: "{title}", footerText: "Page {page} of {pages}", pageNumbers: false },
    markdown: `# 1. Summary

State the main findings in a few sentences, then link them to the recommendations below.

# 2. Background

## 2.1 Scope

Describe what the report covers and what it leaves out.

## 2.2 Method

| Step | Description |
| --- | --- |
| 1 | Collect the data |
| 2 | Clean and verify it |
| 3 | Analyse and report |

# 3. Findings

- Finding one, with the evidence behind it
- Finding two
- Finding three

# 4. Recommendations

1. Do this first
2. Then this
3. Review in six months
`,
  },
  {
    id: "meeting",
    name: "Meeting notes",
    description: "Agenda, decisions and action items",
    themeId: "clean",
    markdown: `# Team sync — {date}

**Attendees:** Alex, Sam, Priya, Jordan

## Agenda

1. Status update
2. Blockers
3. Next steps

## Decisions

- Ship the beta on Friday
- Move the review to Tuesdays

## Action items

| Owner | Task | Due |
| --- | --- | --- |
| Alex | Prepare release notes | Thu |
| Sam | Fix the login bug | Wed |
| Priya | Update the roadmap | Fri |
`,
  },
  {
    id: "proposal",
    name: "Proposal",
    description: "Problem, solution, timeline and pricing",
    themeId: "report",
    cover: { enabled: true, title: "Project Proposal", subtitle: "Prepared for Client Name" },
    page: { footerText: "{title}  ·  {page}", pageNumbers: false },
    markdown: `# The problem

Describe the challenge your client faces, in their words.

# Our approach

- Discover: interviews and audit
- Design: prototypes and testing
- Deliver: build, launch and support

# Timeline

| Phase | Weeks | Deliverable |
| --- | ---: | --- |
| Discover | 2 | Findings report |
| Design | 4 | Tested prototype |
| Deliver | 6 | Launched product |

# Investment

| Item | Price |
| --- | ---: |
| Discover | 4,000 |
| Design | 9,000 |
| Deliver | 15,000 |
| **Total** | **28,000** |

# Next steps

Reply to confirm and we will send the agreement.
`,
  },
];

/** Replace {date} in a template with today's date text. Other {variables} stay for headers and footers. */
export function fillTemplateDate(markdown: string, date: string): string {
  return markdown.replace(/\{date\}/g, date);
}
