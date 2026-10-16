# Reverse engineering report

**Target:** https://linear.app/  
**Kind:** artifact  
**Started:** 2026-10-16T03:22:33.997Z


## File overview (Ghosty baseline)

- **File:** artifact.bin (1227 KB)  ·  **SHA-256:** 5117a52f89e1c94c6fefea6f971964ec78846947ce502f18038bb9c84a7bf823
- **Format:** unknown (magic 3c21444f43545950)
- **Readable strings:** 889

**URLs inside (60):**
- https://webassets.linear.app/images/ornj730p/production/f79251b06e9edeeacbf2875384defe629e000b3c-352x352.png?w=72&amp;q=95&amp;auto=format&amp;dpr=2
- https://linear.app/cdn-cgi/imagedelivery/fO02fVwohEs9s9UHFwon6A/4552f8d7-6f37-4319-68b4-12654bef4e00/f=auto,fit=scale-down,metadata=none,width=64
- https://linear.app/cdn-cgi/imagedelivery/fO02fVwohEs9s9UHFwon6A/d0a00c69-e4c9-4e2f-cff9-ec1178dd7700/f=auto,fit=scale-down,metadata=none,width=64
- https://static.linear.app/web/_next/static/css/Tpxbzi3N.css
- https://static.linear.app/web/_next/static/css/BNNY1qpD.css
- https://static.linear.app/web/_next/static/css/pcGZUK31.css
- https://static.linear.app/web/_next/static/css/BYDaMjMd.css
- https://static.linear.app/web/_next/static/css/dcAi4KbO.css
- https://static.linear.app/web/_next/static/css/Bl8l9ltc.css
- https://static.linear.app/web/_next/static/css/C-dCEHFh.css
- https://static.linear.app/web/_next/static/css/BEZjGLsi.css
- https://static.linear.app/web/_next/static/css/DCkYdNzn.css
- https://static.linear.app/web/_next/static/css/3p32EmO1.css
- https://static.linear.app/web/_next/static/css/mgHd0F-S.css
- https://static.linear.app/web/_next/static/css/ByHmXOx_.css
- https://static.linear.app/web/_next/static/css/CNiZpoOa.css
- https://static.linear.app/web/_next/static/css/mYgpGelO.css
- https://static.linear.app/web/_next/static/css/Blq4ZW3W.css
- https://static.linear.app/web/_next/static/css/Cidbg-cz.css
- https://static.linear.app/web/_next/static/css/B3f9yiOq.css
- https://static.linear.app/web/_next/static/css/BluMS353.css
- https://static.linear.app/web/_next/static/css/B6ktxgTN.css
- https://static.linear.app/web/_next/static/css/BUY_OmUN.css
- https://static.linear.app/web/_next/static/css/krMPHN5w.css
- https://static.linear.app/web/_next/static/css/BNdf6sgA.css
- https://static.linear.app/web/_next/static/css/DXpOFAO4.css
- https://static.linear.app/web/_next/static/css/CWOpLCCY.css
- https://static.linear.app/web/_next/static/css/Q6nTXUvX.css
- https://static.linear.app/web/_next/static/css/bL-CLJt9.css
- https://static.linear.app/web/_next/static/css/Bb-JNkHr.css
- https://static.linear.app/web/_next/static/css/CbcodEv9.css
- https://static.linear.app/web/_next/static/css/jAwP2tSl.css
- https://static.linear.app/web/_next/static/css/B1AV-EHC.css
- https://static.linear.app/web/_next/static/css/B78R7IPt.css
- https://static.linear.app/web/_next/static/css/Cds8fjKR.css
- https://static.linear.app/web/_next/static/css/vfNSRYu7.css
- https://static.linear.app/web/_next/static/css/DgPIODoE.css
- https://static.linear.app/web/_next/static/css/BnZAjcL1.css
- https://static.linear.app/web/_next/static/css/layout.TfwOB7lY.css
- https://static.linear.app/web/_next/static/css/Spacer.mYgpGelO.css
- https://static.linear.app/web/_next/static/css/utils.BNNY1qpD.css
- https://static.linear.app/web/_next/static/css/Layout.tvkMFESE.css
- https://static.linear.app/web/_next/static/css/Header.BNHV4lAU.css
- https://static.linear.app/web/_next/static/css/Icon.B18TDZc7.css
- https://static.linear.app/web/_next/static/css/LayoutContent.D8YYVbao.css
- https://static.linear.app/web/_next/static/css/CTA.CDNJI-Em.css
- https://static.linear.app/web/_next/static/css/Grid.Cds8fjKR.css
- https://static.linear.app/web/_next/static/css/HomepageSeparator.DAb6YYB9.css
- https://static.linear.app/web/_next/static/css/Bleed.CbcodEv9.css
- https://static.linear.app/web/_next/static/css/GlobalSidePanel.cAFbFP1F.css
- https://static.linear.app/web/_next/static/css/Changelog.C40xlRzV.css
- https://static.linear.app/web/_next/static/chunks/index-DrFM7gz5.js
- https://static.linear.app/web/_next/static/chunks/C_JJxWoe.js
- https://static.linear.app/web/_next/static/chunks/B5mLuTUC.js
- https://static.linear.app/web/_next/static/chunks/B0bTq-0n.js
- https://static.linear.app/web/_next/static/chunks/08INISxS2.js
- https://static.linear.app/web/_next/static/chunks/ChyxXR8K2.js
- https://static.linear.app/web/_next/static/chunks/BxNeMQP52.js
- https://static.linear.app/web/_next/static/chunks/wyE9wlIg.js
- https://static.linear.app/web/_next/static/chunks/CYhq9bbF.js

**Strings mentioning keys/tokens (2) — check these are not real secrets:**
- `</span></span></a></div></div></div><div class="b-30Va_illustration"><div class="show-mobile"><div class="-B0yXq_root"><div class="_5mGmSq_root" style="--height`
- `</span></span></a></div></section><section class="dYXc1G_homepagePrefooter"><h2 style="max-width:16ch" class="sc-KOGVz fkCphf dYXc1G_heading">Built for the futu`


> REA artifact (rea inspect-artifact /tmp/rea-iKOYHM/artifact.bin): rea inspect-artifact /tmp/rea-iKOYHM/artifact.bin --format json exited 1


> Native code decompiling needs Ghidra on the runner (not installed: ~1 GB per run). Ask Ghosty if you want it added.


---
_Finished 2026-10-16T03:22:36.802Z · 2 problem(s) · REA by morluto (MIT) · for lawful research only_
