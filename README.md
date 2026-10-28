# Notchday

Notchday is a simulation studio and a work LARP (live action role play). Hanna Bridgham is the only CEO. You play a company simulation. It is not a job.

Yapmark, Flinttable, and Chartslate are separate company simulations. They are not jobs, not employers, and not work history. Each one has its own features and its own members. A Notchday employee option is a paid simulation membership, not employment. It includes all three companies. This app does not charge a card. Support the project opens https://rfab.ai/tip/f826f793-6969-4917-93bd-9a2275ad2943.

Yapmark, Flinttable, and Chartslate each have their own door, look, and login. Notchday stays in the footer as the studio.

A signup email stays with one company. Members on that company team can say hello, use the company room, and share a file inside the app. Yapmark has a check-in board. Flinttable has pitches, comments, and votes. Chartslate’s room is for graphs.

Members of a company can form a simulation group and other members of that company can join it themselves. Hanna can send simulation missions and tasks to a group. She can also send a company-wide simulation contest.

Members who share a company can send simulation chat and schedule a simulation meeting. A meeting can store an optional Zoom link that a member pastes in. There is no in-app video calling.

A profile can show a photo, simulation time for the current company, and a simulation address such as `name@flinttable.notchday.simulation`. That address only works inside the app. Notchday does not send email.

Hanna’s profile is the complaint box for bugs, issues, and reports about a harmful member.

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
