# Password recovery — 2026-10-12

One completed slice: `/forgot-password` requests reset email; `/reset-password` accepts a new password only with a Supabase session and without a callback error. PASSWORD_RECOVERY selects the reset screen even when Supabase redirects to the Site URL. The callback changes the URL to the reset path without retaining tokens, so refresh preserves the intended screen.

No new Express endpoint: email and password go directly to Supabase Auth. Passwords are not sent to the business API or logged. Request success text does not disclose account existence. Client requires at least eight characters and matching confirmation; provider remains authoritative. After update, local signout returns the user to login; this does not claim global revocation of every existing JWT.

For hosted operation, allow `http://127.0.0.1:5173/reset-password` (and the localhost equivalent if used) in Authentication → URL Configuration. Keep existing legitimate origins. Optional branded Reset password email body is `supabase/templates/reset-password.html`; retain ConfirmationURL for verification. Hosted settings/template are not updated by Git commits.

Automated coverage: reset destination, input validation before network, payload boundary and provider failures. Browser checked request form and expired callback. Live delivered email and password change require user testing; no existing credential was changed by the agent.

User confirmed signup email verification, login, organization name/username/OWNER context for the preceding slice. This is user-reported UAT evidence, not an independently observed complete hosted run.

[Supabase password reset reference](https://supabase.com/docs/reference/javascript/auth-resetpasswordforemail).
