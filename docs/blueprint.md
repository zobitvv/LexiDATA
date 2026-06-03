# **App Name**: LexiPulse

## Core Features:

- Intelligent Identity Verification: A search interface allowing users to input phone numbers or CNICs with automated format detection and input normalization.
- AI Insight Summarizer: A tool that uses generative AI to analyze returned record logs, providing a brief textual summary of potential data anomalies or profile consistency.
- Audit Log & History: Securely persistent history of search queries and timestamps stored in a relational database for internal oversight.
- Entity Profile Visualization: Dynamic rendering of match records into clean, agency-style identity cards featuring formatted CNICs and interactive contact nodes.
- Role-Based Security: Environment-level security protocols ensuring only authorized personnel can access the external verification endpoints.
- Cross-Referencing Router: Automated workflow that reroutes phone number queries into second-pass CNIC searches for deeper record verification.

## Style Guidelines:

- Primary color: Deep Azure (#2B5FD9). Background color: Slate Shadow (#0A0E1A), providing a focused, dark workspace suited for prolonged corporate usage.
- Accent color: Vibrant Electric Blue (#63A1FF) for critical CTAs and identification status indicators, providing strong contrast against the dark base.
- Headline and navigation font: 'Space Grotesk' for a high-tech, precise look. Body text font: 'Inter' for optimal legibility of legal data.
- Numeric data font: 'Source Code Pro' to clearly distinguish identity numbers and code-like logs from general interface text.
- A centered, column-constrained container focused on the search input to minimize distraction, with result cards appearing in an organized vertical stack.
- Precision state transitions for search processing, using smooth CSS opacity and 2px translation shifts when rendering profile matches.
- Crisp, minimalist line icons from Lucide to denote data nodes, identification documents, and historical logs.