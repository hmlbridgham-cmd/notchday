# Daymark

Daymark is a simulation studio. Hanna Bridgham is CEO. The studio contact number is 253-241-7270.

Copperline, Kindling, and Quarry are simulations. They are not jobs, not employers, and not work history. Support is an optional donation. There is no subscription and no paywall.

Copperline, Kindling, and Quarry each have their own door, look, and login. Daymark stays in the footer as the studio.

Members in the same simulation can send practice chat and schedule a practice meeting. A meeting can store an optional Zoom link that a member pastes in. There is no in-app video calling.

A profile can show a photo, practice time for the current simulation, and a simulation address such as `name@kindling.daymark.simulation`. That address only works inside the app. Daymark does not send email.

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

That follows `docs/rfab-api.md` and writes `public/logos/daymark.png`, `public/logos/copperline.png`, `public/logos/kindling.png`, and `public/logos/quarry.png`.

## Banner

`banner/hanna-bridgham-linkedin-banner.png` is Hanna Bridgham’s LinkedIn cover image, 1584×396. It has no words, because LinkedIn already shows her name and headline. Upload it with the camera icon on the profile banner. The uncropped generation is `banner/hanna-bridgham-linkedin-banner-source.png`.
