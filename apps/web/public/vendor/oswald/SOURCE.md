# Oswald (the poster's face)

| | |
| --- | --- |
| File | `Oswald-latin-VF.woff2`: the variable font (weights 200 to 700), the Latin subset, 28,456 bytes |
| Font | Oswald, by Vernon Adams, Kalapi Gajjar, Cyreal and the Oswald Project Authors |
| Licence | SIL Open Font License 1.1 (`LICENCE`): free to use, embed and redistribute; the name "Oswald" is not a reserved font name |
| From | Google Fonts' own distribution of the family, https://fonts.googleapis.com/css2?family=Oswald:wght@200..700 (file `v57`, the `latin` range), fetched on 1 November 2026 |
| Used by | the creative pack's poster, birthday card, comic strip and logo (apps/web/src/features/creative), drawn on a canvas on the phone and exported as a PNG, so that the picture looks the same on every phone |
| Loaded | by the `@font-face` at the end of apps/web/styles.css, only when a creative sheet draws a page (document.fonts.load); the app does not wait for it |
