# POS Minimal email confirmation

## Hosted Supabase setup (required)

The application publishable key and database password cannot modify hosted Auth templates. Use an authorized Supabase Dashboard session.

1. Authentication → Email Templates → Confirm signup: subject `ยืนยันอีเมลของคุณ — POS Minimal`; paste `supabase/templates/confirm-signup.html` as the HTML body and save.
2. Authentication → URL Configuration: for development set Site URL to `http://127.0.0.1:5173/`; allow `http://127.0.0.1:5173` and `http://127.0.0.1:5173/`, plus localhost variants if used. Keep legitimate existing redirect URLs. Production must use its deployed HTTPS origin.
3. Request a fresh confirmation email. Already delivered emails retain their original HTML/link. Confirm with a real test account while Local is running on the same computer.

The email button must retain `href="{{ .ConfirmationURL }}"`. A visual button remains an anchor for email-client compatibility; JavaScript buttons do not work reliably in email. Do not replace it with SiteURL or RedirectTo alone: those do not perform verification. Plain-link fallback supports clients that strip styling.

Web signup waiting screen shows the app name, entered email, mail icon, spam-folder hint and resend action with 60-second cooldown. Auth redirects with error_code display an invalid/expired confirmation message. UI does not reveal raw provider errors or store confirmation tokens.

Verification: TypeScript/tests/build; template href and label checks. Hosted template installation and delivered-email click behavior are pending Dashboard access. No cause for the reported non-responsive old email link has been conclusively established.

Sources: [Supabase email templates](https://supabase.com/docs/guides/auth/auth-email-templates), [redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls).
