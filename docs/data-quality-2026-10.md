# Data quality audit — October 2026

Audit of the 118 published institutions on production (read from the public
API on 2026-10-30), compared with the client's latest sheet export
`ArtandCulturalSpacesDBlatest5.csv`. Fixes are applied by
`scripts/data-quality-2026-10.ts` (dry run by default, `--apply` to write; run
it after the `20261030120000_finalise_institution_types` migration).

## What the script changes

| Area | Change |
|---|---|
| Duplicates | **J. Randle Centre** renamed to the sheet's **John Randle Centre** (live row kept: it has the images). **Art House Foundation** merged into **Arthouse Contemporary** (same website, phone and address): images, exhibitions and reviews moved, duplicate soft-deleted. |
| Type / subType | 16 entries corrected to match the sheet: 7 festivals → `ART_FESTIVAL`; Obodo, Lagos Gallery Weekend, FF Projects, Fresco Gallery → `NOMADIC_SPACE`; 4 admin-added galleries given subType `ART_GALLERY`; John Randle Centre → Hub / `MUSEUM`. |
| Opening hours | Yenwa Gallery and Angels and Muse filled in from the venue's own website. Existing hours were checked: all 58 that also appear in the sheet match it. |
| Tags | `BY_APPOINTMENT`: G.A.S., Polygon, Yusuf Grillo Museum, The Treehouse. `ONLINE`: Awizzy Online Art Gallery. `LIVE_EXHIBITION`: kept in step with `hasExhibition` (16by16). |
| Address | G.A.S. address filled in from guestartistsspace.com. |

## Not changed — needs the client

**Opening hours not confirmable.** Only the venue's own website or announcement
was accepted as a source; third-party directories contradicted each other and
were not used. Still missing for:

- Galleries: A White Space, AINA, Adegbola Gallery, Affinity Gallery¹, Akóko,
  Awizzy Online Art Gallery, Brilliant Brush Gallery, Fobally Art World Africa,
  Framemaster Limited, Halal Art Gallerieo, Iwalewa Gallery of Arts, NK ART
  SPACE, Oshodi Arts Gallery², Pendulum Art Gallery, TCA Gallery, The Benin Art
  Gallery, Treasure House Fine Arts, Truview Art and Frames Gallery, Watersworth
  Gallery, Windsor Gallery, Yato Art In Autism Gallery
- Hubs: Alara, Amah Studio, Clay of Lagos, KAP Hub, MUSON Centre,
  MadhousebyTikera, MÌLÍKÍ, Olori Art Foundation, Pada Lagos, SARTCOL, Studio
  Dadas, Suudu Lagos, The Wheatbaker³, Universal Studios of Art, Vortex Central,
  John Randle Centre
- Museums: Kalakuta Museum

¹ A 2023 press release gives Tue–Sat 11am–6pm, Sun by appointment, but as
exhibition hours. ² Its own site lists two different schedules. ³ A hotel; the
sheet says "24hr hotel" but not the gallery's hours.

**Websites that no longer resolve:** Treasure House Fine Arts, Brilliant Brush
Gallery, Yato Art In Autism Gallery, Polygon, Halal Art Gallerieo, Watersworth
Gallery, Truview Art and Frames Gallery. Olori Art Foundation's site returns 404.

**Possibly closed or moved:** Windsor Gallery's site now reads "Coming soon to
Sofitel Abidjan".

**Kept separate, worth confirming:** Rele Gallery and R2 Space share a phone
number and coordinates.

**Placeholder coordinates:** the festivals, Obodo and FF Projects all sit on the
same point. The sheet has no coordinates for them; they need real locations or a
decision to show them off-map.

**Style and curation tags** (Contemporary, Photography, Our Picks, Featured…)
and **sub-categories** are unassigned on every entry. These are editorial
choices for the client. Sub-categories now overlap with `subType`, so the
client should decide whether the sub-category list is still needed.
