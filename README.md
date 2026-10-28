# Notchday

Notchday is a simulation studio and a work LARP (live action role play). The only CEO is shown as the CEO, the mysterious leader. You play a company simulation. It is not a job.

Yapmark Corp., Flinttable Inc., and Chartslate Ltd. are separate company teams. They are not jobs, not employers, and not work history. Signup pledges permanently to one of those three. That pledge is the member's main purpose. Notchday is its own private team, for subscribers or invited members. A normal signup cannot join Notchday. This app does not charge a card. Support the project opens https://rfab.ai/tip/f826f793-6969-4917-93bd-9a2275ad2943.

Members of every team can use the tools and groups. Teams can compete, and the work stays collaborative. Yapmark has a check-in board. Flinttable has pitches, comments, and votes. Chartslate’s room is for graphs. A profile, chat, and message show the other person's team logo and team name. A Notchday member also shows the Notchday logo.

Members of any team can form a simulation group. The creator picks one join rule: Open, so anyone from any team can join; Members accept, so a current member must accept the request; or Team lead accepts, so only the team lead can accept. The rule is inside the work LARP, not a job. The CEO can send simulation missions and tasks to a group, and can also send a company-wide simulation contest.

On the scoreboard, the CEO sets companies to compete, sends a simulation competition assignment, and can later announce a winner. The tally is a joke score inside the work LARP, not a prize from an employer.

A member of a group can post a simulation opening with a position title, a description, the group, and their simulation profile. Another member applies by a private simulation message, with a simulation resume or another note. The poster can interview them for that group or a simulation team. It is inside the work LARP, not real hiring and not a resume.

Members can send simulation chat and schedule a simulation meeting across teams. A meeting can store an optional Zoom link that a member pastes in. There is no in-app video calling.

A profile can show a photo, simulation time for the current company, and a simulation address such as `name@flinttable.notchday.simulation`. That address only works inside the app. Notchday does not send email.

The CEO profile is the complaint box for bugs, issues, and reports about a harmful member. Bug reports are stored for that account.

## Run

```bash
npm install
npm start
```

Open http://localhost:3000

The local seed login is Hanna Bridgham, `hanna.bridgham@example.com`, password `daymark-practice`. That password is only for this local database.

```bash
npm test
```

## Deploy

The public GitHub repo is https://github.com/hmlbridgham-cmd/notchday. Render uses `render.yaml` on branch `cursor/daymark-simulation-studio-2caf`. The service runs Node 22, keeps the database, profile photos, and shared files on a disk, and marks the session cookie Secure. `.env` stays out of git. Set the logo key in the Render dashboard only if you regenerate logos there.

## Logos

Logo slots are on the pages. When `RFAB_API_KEY` is in the environment or in `.env`, generate the four marks with:

```bash
npm run logos
```

That follows `docs/rfab-api.md` and writes `public/logos/notchday.png`, `public/logos/yapmark.png`, `public/logos/flinttable.png`, and `public/logos/chartslate.png`.

## Names

daymark.com, copperline.com, kindling.com, and quarry.com were already registered. The studio is Notchday. The companies are Yapmark, Flinttable, and Chartslate. notchday.com, yapmark.com, flinttable.com, and chartslate.com were available at Verisign RDAP when those names were chosen.

## Banner

`banner/hanna-bridgham-linkedin-banner.png` is Hanna Bridgham’s LinkedIn cover image, 1584×396. It has no words, because LinkedIn already shows her name and headline. Upload it with the camera icon on the profile banner. The uncropped generation is `banner/hanna-bridgham-linkedin-banner-source.png`.
