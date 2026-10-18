# Little's Valley Preparatory School

A responsive school website for Little's Valley Preparatory School in Chand Nagar, Delhi, with an illustrated landing page, school photo gallery, map, and a private teacher/staff dashboard for editing teacher profiles, notices, group achievements, and school details.

The frontend is plain HTML, CSS, and JavaScript. Cloudflare Workers serves the static website, D1 stores school content, and a private R2 bucket stores uploaded staff portraits.

## Local preview

Requires Node.js 22 or later.

```powershell
npm install
npm run db:migrate:local
npm run dev
```

For local admin sign-in, create a `.dev.vars` file from `.dev.vars.example`, then set a unique staff password and a randomly generated session secret there. Never commit `.dev.vars`. Open the local URL printed by Wrangler. To verify the Cloudflare bundle without deploying:

```powershell
npm run check
```

## GitHub and Cloudflare deployment

The Wrangler configuration serves `public/` as static assets and routes `/api/*` through the Worker. Keep this folder as the root of its own GitHub repository.

1. Ensure the Cloudflare resources referenced by `wrangler.jsonc` exist in the account connected to the Worker. For a new account, create them with Wrangler:

   ```powershell
   npx wrangler d1 create littles-valley-school
   npx wrangler r2 bucket create littles-valley-school-media
   ```

2. If you created a new D1 database, copy its ID into the `SCHOOL_DB` binding in `wrangler.jsonc`. The ID in this repository is for the database provisioned for this project; replace it when deploying to a different Cloudflare account.
3. Apply the production schema:

   ```powershell
   npm run db:migrate:remote
   ```

4. Set a strong staff password and an independent secret used to sign private staff sessions:

   ```powershell
   npx wrangler secret put ADMIN_PASSWORD
   npx wrangler secret put ADMIN_SESSION_SECRET
   ```

   `ADMIN_PASSWORD` must be at least 14 characters. `ADMIN_SESSION_SECRET` must be at least 32 characters. Wrangler securely prompts for each value. Never place secret values in HTML, Git, command-line arguments, or the GitHub repository.

5. Create a GitHub repository from this folder and push its `main` branch. In Cloudflare, choose **Workers & Pages → Create application → GitHub** and connect the repository. Set the Worker name to `little-velley` and deploy command to `npm run deploy`. Keep the repository root `/` and the build output directory empty.
6. Open `https://<your-worker-name>.<your-account>.workers.dev/admin.html` and sign in with the staff password. Future pushes to the production branch deploy automatically when Git integration is enabled.

An optional custom domain requires owning a domain. Check Cloudflare's current [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/), [D1 limits and pricing](https://developers.cloudflare.com/d1/platform/pricing/), and [R2 limits and pricing](https://developers.cloudflare.com/r2/pricing/) before publishing. Each currently lists a Free-tier allowance, but plan limits can change and can be shared across your account.

## Staff dashboard

Open `/admin.html` or use the keyboard-accessible **Staff login** link in the page footer.

- Update public contact information, opening status, and the family notice.
- Add, edit, unpublish, or remove teacher profiles with a JPEG, PNG, or WebP portrait (up to 5 MB).
- Publish school-wide notices and event announcements.
- Celebrate class/group milestones without exposing an individual child's records.
- Save drafts before publishing public updates. Sign-in is protected by an eight-hour HTTP-only cookie, same-origin write checks, and temporary rate limits on password attempts.

Only school-approved, consented staff photographs should be uploaded. Never publish students' names, photos, marks, report cards, or other personally identifying results. Use group-level or school-wide achievements only.

## Before publishing

- **Confirm the school’s status.** The supplied listing says “Temporarily closed.” The page makes that notice prominent and advises families to call before visiting. Update it if the school confirms a change.
- **Verify photo permission.** Three school photographs were supplied for this website with permission confirmed by the requester. The fox-and-bear artwork is original SVG illustration, not AI-generated. Teacher portraits still require each teacher's approval.
- **Replace the sample school status and contact details if needed.** The listed school status currently says “Temporarily closed”; call the school and confirm before publishing updates.
- **Verify the school details.** The name, address, and phone number are transcribed from the information supplied for this site. Confirm them, along with admissions, classes, and visiting hours, with the school.

## Design references

Two Delhi school websites were reviewed for common family-facing patterns: [Delhi Public School, R.K. Puram](https://www.dpsrkp.net/) and [Step by Step School](https://www.stepbystep.school/). The site adapts the broader idea of presenting school news and practical family information without making claims about unverified curriculum, facilities, achievements, or admissions.
