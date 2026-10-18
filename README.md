# Little's Valley Preparatory School

A static school website for Little's Valley Preparatory School in Chand Nagar, Delhi. It includes school information, photos, a map, and contact details.

## Local preview

Requires Node.js 22 or later.

```powershell
npm ci
npm run dev
```

To validate the deployment bundle without publishing it:

```powershell
npm run check
```

## Cloudflare deployment

This project deploys `public/` as static assets using the `little-velley` Worker name in `wrangler.jsonc`. It does not require a Worker script, D1, R2, or admin secrets.

Connect the repository's `main` branch in **Workers & Pages → Create application → GitHub**. Set the repository root to `/`, leave the build command empty, and use `npm run deploy` as the deploy command.

The staff dashboard and dynamic school updates are not included in this static version. School details and page content are maintained in `public/index.html`.

## Before publishing

- Confirm the school's current opening status, contact details, and visiting hours.
- Verify permission for any school photos before publishing.
- Do not publish students' names, photos, marks, report cards, or other personally identifying information.
- The school name, address, and phone number are transcribed from the information supplied for this site. Verify them with the school.

## Design references

Two Delhi school websites were reviewed for common family-facing patterns: [Delhi Public School, R.K. Puram](https://www.dpsrkp.net/) and [Step by Step School](https://www.stepbystep.school/). The site avoids claims about unverified curriculum, facilities, achievements, or admissions.
