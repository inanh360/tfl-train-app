export default function PrivacyPage() {
  return (
    <div style={{ maxWidth: 640, fontSize: 14, lineHeight: 1.6, color: "var(--text)" }}>
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: 13, color: "var(--text-dim)", fontWeight: 500, marginBottom: 20 }}>
        PRIVACY POLICY
      </h1>

      <p style={{ color: "var(--text-dim)", fontSize: 12, marginBottom: 24 }}>Last updated August 2026</p>

      <Section title="Who runs this">
        <p>
          Line Status is a personal project, not a company. If you have any question about your data, contact the
          person running this site directly.
        </p>
      </Section>

      <Section title="What data is collected">
        <p>If you create an account, the following is stored:</p>
        <ul>
          <li>Your email address, used to sign you in.</li>
          <li>Any lines or stations you choose to favourite.</li>
          <li>Notifications generated when a line or station you favourited is disrupted.</li>
        </ul>
        <p>
          If you use the app without signing in, none of the above applies. The live status board and journey
          planner do not require an account.
        </p>
      </Section>

      <Section title="Why this data is collected">
        <p>
          Your email is used only to identify your account and sign you in. Favourites and notifications exist
          purely so the app can tell you when something you care about is disrupted. None of this data is used for
          advertising, and none of it is sold or shared with anyone for marketing purposes.
        </p>
      </Section>

      <Section title="Who else sees this data">
        <p>A small number of services are used to run the app, and each has access to only what it needs.</p>
        <ul>
          <li>Supabase stores your account and app data, and handles signing in.</li>
          <li>Resend sends account related emails, such as confirming your email address.</li>
          <li>Transport for London&apos;s public API provides live train status and journey data. No account data is sent to TfL.</li>
        </ul>
      </Section>

      <Section title="How long data is kept">
        <p>
          Your data is kept for as long as your account exists. Deleting your account removes your favourites and
          notification history immediately and permanently.
        </p>
      </Section>

      <Section title="Your rights">
        <p>You can, at any time:</p>
        <ul>
          <li>See what favourites and notifications are attached to your account by viewing the app itself.</li>
          <li>Delete your account and all associated data from the Account page.</li>
          <li>Ask, by contacting the site owner, what data is held about you.</li>
        </ul>
      </Section>

      <Section title="Cookies">
        <p>
          This app uses only the minimum needed to keep you signed in. There is no advertising or tracking, and no
          analytics beyond what is needed to keep the service running.
        </p>
      </Section>

      <Section title="Changes to this policy">
        <p>If this policy changes, the date at the top of this page will be updated.</p>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>{title}</h2>
      {children}
    </div>
  );
}
