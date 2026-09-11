# SanMar staging photo / colorway audit

Source: `https://d1so4a0f4v7ki5.cloudfront.net` (storefront → commerce API product detail).  
Generated: 2026-09-11T06:48:52Z UTC.

This is what **we have stored and serve**, not a live SanMar SOAP dump. Each
row is one storefront style (`vendor=sanmar`). Photos come from Media /
getProduct / Bulk after sync.

## Totals

| | Count |
|---|---:|
| Storefront styles crawled (all vendors) | 1536 |
| SanMar styles | 472 |
| SanMar colorways | 2754 |
| Colorways with a front photo | 2021 (73% of colorways) |
| Colorways with a side photo | 816 (30%) |
| Colorways with a back photo | 735 (27%) |
| Styles with at least one side | 141 (30% of styles) |
| Styles with at least one back | 133 (28%) |
| Styles with an on-model filename (`_modl_` / studio) | 61 (13%) |
| Styles with S&S `colorOnModel*` columns filled | 0 |
| Detail fetch errors | 0 |

SanMar never fills `colorOnModelFront/Side/Back`. On-model shots live in
`colorFrontImageUrl` when the filename is `_modl_` / `studio-front`.

### Unique stored photos per style

| Unique photo URLs | Styles |
|---|---:|
| 0 | 121 |
| 1 | 29 |
| 2–3 | 63 |
| 4–6 | 75 |
| 7–12 | 86 |
| 13+ | 98 |

So **most photographed SanMar styles have several images**, not one. The 121 with zero photos are a real gap (Media enrichment cap / no bag / name mismatch), not the typical case.

### Richest styles (what “good” looks like)

| Brand | Key | Colors | Fronts | Sides | Backs | Unique photos |
|---|---|---:|---:|---:|---:|---:|
| ATC Everyday | `ATC1000` | 50 | 42 | 2 | 18 | 62 |
| ATC Ringspun | `24EVER` | 38 | 23 | 23 | 0 | 46 |
| ATC Everyday | `ATC1000Y` | 34 | 29 | 0 | 17 | 46 |
| ATC Ringspun | `24EVERY` | 25 | 20 | 20 | 0 | 40 |
| AuthenticColour | `ATC1700` | 20 | 20 | 20 | 0 | 40 |

### Why some colours still miss a photo

733 colorways have no front. Common names: `Black`, `Athletic Hthr`, `Dark HthrGrey`, `MilitaryGreen`, `NightSkyNavy`, `CarharttBrown`, `TNF Black`. About 187 of those are concatenated sellable names (`NightSkyNavy`) that do not match Media filenames (`night-sky-navy`). That is a matcher gap, not a missing credential.

`Unknown Brand` (46 styles) means sellable import created the style code before `getProduct` wrote the real name. 32 of those still have photos.

## Coverage buckets

| Bucket | Styles | Meaning |
|---|---:|---|
| every_colour_has_front | 200 | Every colorway has its own front |
| most_colours_have_front | 91 | ≥70% of colors have a front |
| partial_colour_photos | 41 | Some colors photographed |
| one_colour_photographed | 9 | Only one color has a front |
| single_shared_photo | 10 | One URL for a multi-color style |
| no_photos | 121 | Style exists, zero stored photos |
| no_colorways | 0 | No colorway rows |

## Brands

| Brand | Styles |
|---|---:|
| Unknown Brand | 46 |
| Red Kap | 41 |
| Nike | 28 |
| ATC Pro Team | 27 |
| ATC Everyday | 22 |
| KOI | 20 |
| CH Sport Shirts | 17 |
| ATC Headwear | 17 |
| CH Everyday | 16 |
| CH Outerwear | 15 |
| The North Face | 14 |
| KOI Accessory | 13 |
| New Era | 13 |
| OGIO Bags | 13 |
| ATC WeRK | 12 |
| ATC Essentials | 11 |
| ATC EuroSpun | 11 |
| Penguin | 11 |
| ATC Flexfit | 9 |
| DryFrame | 9 |
| Marketing | 9 |
| CH Wovens | 8 |
| ATC Accessories | 8 |
| AuthenticColour | 8 |
| Carhartt | 8 |
| Allmade | 7 |
| ATC Earth Wash | 7 |
| Callaway | 7 |
| ATC Ringspun | 6 |
| CH Accessories | 6 |
| ATC ProSpun | 5 |
| ATC Vintage | 4 |
| ATC FleeceCore | 4 |
| OGIO Apparel | 4 |
| ATC WeRK Accsry | 3 |
| Dickies | 3 |
| OGIO Endurance | 3 |
| ATC PPE | 2 |
| ATC PTech | 1 |
| Bella | 1 |
| ATC Gameday | 1 |
| INIVI | 1 |
| Unknown | 1 |

## Styles with no photos (121)

| Brand | Style | Key | Colors | Fronts | Sides | Backs | Unique photos | Missing fronts |
|---|---|---|---:|---:|---:|---:|---:|---|
| ATC Accessories | Twill Blend Full Length Apron | `A1080` | 9 | 0 | 0 | 0 | 0 | Black, Clay, Coal Grey, Coffee, Military, Navy… |
| ATC Accessories | Twill Blend Waist Length Apron | `A1081` | 1 | 0 | 0 | 0 | 0 | Black |
| ATC EuroSpun | Vintage Thermal L/S Henley | `ATC8064` | 3 | 0 | 0 | 0 | 0 | Cardinal Hthr, Charcoal Hthr, Grey Hthr |
| ATC EuroSpun | Vintage Thermal L/S Lds'Henley | `ATC8064L` | 1 | 0 | 0 | 0 | 0 | Charcoal Hthr |
| ATC Everyday | Everyday Fleece Youth  1/4 Zip | `ATCY2700` | 6 | 0 | 0 | 0 | 0 | Athletic Hthr, Black, Team DrkHthr, Team Navy, Team Red, Team Royal |
| ATC Headwear | Earth Wash Beanie | `ATC1600` | 6 | 0 | 0 | 0 | 0 | Black, Caramel, Military, Navy, Pewter, Sand |
| ATC Headwear | Striped Cuff Pom Pom Toque | `C1202` | 3 | 0 | 0 | 0 | 0 | Black/Blk, BlkHth/BlkHth, Navy/Navy |
| ATC Headwear | Everyday TRI-Colour Trucker | `C1318TRI` | 8 | 0 | 0 | 0 | 0 | Blu/Nav/Gry, Brow/Car/Cre, Crem/Car/Gry, Crem/For/Gry, Crem/Mar/Gry, Crem/Nav/Gry… |
| ATC Headwear | Everyday 5-Panel Rope Trucker | `C1343` | 10 | 0 | 0 | 0 | 0 | BLK/BLK/BLACK, BLK/WHITE/WH, CARA/BLK/BLK, COALG/BLK/BLK, CONCRET/WH/WH, NAVY/NAVY/NVY… |
| ATC PPE | Employee Disposable Glove (Box | `EMPGLOVES` | 2 | 0 | 0 | 0 | 0 | Black, Blue |
| ATC PPE | Employee Disposable Mask | `EMPMASK` | 1 | 0 | 0 | 0 | 0 | Viva Blue |
| ATC Pro Team | ProTeam ProFormance Lds' Tee | `L3517` | 4 | 0 | 0 | 0 | 0 | Blue Wake, Cardinal, Charcoal, Graphite Hth |
| ATC Pro Team | Pro Club Team Kit | `PROCLUBKIT` | 1 | 0 | 0 | 0 | 0 | Sample |
| ATC Pro Team | Pro Club Reversible Mesh Kit | `PROMESHKIT` | 1 | 0 | 0 | 0 | 0 | Sample |
| ATC Pro Team | ProTeam ProFormance Tee | `S3517` | 1 | 0 | 0 | 0 | 0 | Cardinal |
| ATC Pro Team | Pro Mesh Reversible Yth Tank | `Y3524` | 1 | 0 | 0 | 0 | 0 | TrueRoy/White |
| ATC Vintage | Vintage TwoTone Hooded Sweat | `F2044` | 3 | 0 | 0 | 0 | 0 | Char/Black, Char/Forest, Char/Navy |
| ATC Vintage | Vintage Hooded Sweatshirt | `F2045` | 3 | 0 | 0 | 0 | 0 | Black, Charcoal, Navy |
| ATC WeRK | Heavyweight RS Ctn Womens Tee | `WERK250L` | 5 | 0 | 0 | 0 | 0 | Athletic Grey, Black, Caramel, Dark Navy, White |
| AuthenticColour | Authentic Colours LTWGHT Crew | `ATC1766` | 15 | 0 | 0 | 0 | 0 | Ant. Chambray, Berry, Black, Blossom, Blue Jean, Butter… |
| AuthenticColour | Authentic Colours LTWT WMS CRW | `ATC1766L` | 15 | 0 | 0 | 0 | 0 | Ant. Chambray, Berry, Black, Blossom, Blue Jean, Butter… |
| AuthenticColour | Authentic Colours LGTWT Hoodie | `ATC1767` | 15 | 0 | 0 | 0 | 0 | Ant. Chambray, Berry, Black, Blossom, Blue Jean, Butter… |
| AuthenticColour | Authentic Colours LTWT 1/4 Zip | `ATC1768` | 10 | 0 | 0 | 0 | 0 | Berry, Black, Blue Jean, Ivory, Moss, Orchid… |
| Bella | BASEBALLE LONGSLEEVE | `3000` | 1 | 0 | 0 | 0 | 0 | Tan/Army |
| CH Accessories | Boardroom 16" Laptop Sleeve | `CHBC1105` | 1 | 0 | 0 | 0 | 0 | Black |
| CH Accessories | Boardroom Insulated Lunch Bag | `CHBC1106` | 4 | 0 | 0 | 0 | 0 | Black, Iron Grey, Midnight Navy, Olive Green |
| CH Accessories | Boardroom Split Toiletry Bag | `CHBC1107` | 1 | 0 | 0 | 0 | 0 | Black |
| CH Accessories | Boardroom Garment Bag | `CHBC1108` | 1 | 0 | 0 | 0 | 0 | Black |
| CH Accessories | Boardroom 3-pc Packing CubeSet | `CHBC1109` | 1 | 0 | 0 | 0 | 0 | Black |
| CH Accessories | Boardroom Tech Organizer Bag | `CHBC1110` | 1 | 0 | 0 | 0 | 0 | Black |
| CH Everyday | Essential Snag Resist Lds Polo | `L4045` | 6 | 0 | 0 | 0 | 0 | Black, Iron Grey, True Navy, True Red, True Royal, White |
| CH Everyday | Essential Snag Resist Polo | `S4045` | 10 | 0 | 0 | 0 | 0 | Black, Carolina Blue, Forest Green, Iron Grey, Purple, Silver… |
| CH Everyday | Essential Snag Resist L/S Polo | `S4045LS` | 6 | 0 | 0 | 0 | 0 | Black, Iron Grey, True Navy, True Red, True Royal, White |
| CH Everyday | Essential Snag Resist Yth Polo | `Y4045` | 4 | 0 | 0 | 0 | 0 | Black, Iron Grey, True Navy, White |
| CH Sport Shirts | ProTeam Proformance Lds' Polo | `L3518` | 1 | 0 | 0 | 0 | 0 | Deep Orange |
| CH Sport Shirts | ProTeam ProFormance Polo | `S3518` | 1 | 0 | 0 | 0 | 0 | Forest Green |
| CH Wovens | Everyday EC L/S Wov Shirt | `CH6200` | 7 | 0 | 0 | 0 | 0 | Black, Dark Sand, Iron Grey, Red, True Navy, True Royal… |
| CH Wovens | Everyday EC ShrtSlv Wov Shirt | `CH6201` | 7 | 0 | 0 | 0 | 0 | Black, Dark Sand, Iron Grey, Red, True Navy, True Royal… |
| Dickies | M Dow Twl Crgo Pant RLXD | `LP60` | 1 | 0 | 0 | 0 | 0 | NAVY 30 |
| Dickies | M DICKIES CRGO WK PNT RLXD | `WP59` | 3 | 0 | 0 | 0 | 0 | BLACK 30", BLACK 32", BLACK 34" |
| KOI | Element CFF OpnBtm Lds Swtpnt | `KOI2280L` | 5 | 0 | 0 | 0 | 0 | Dusty Rose, Grey Heather, Midnight Blue, Onyx, Sahara |
| KOI | Element CFF OpnBtm Yth Swtpnt | `KOI2280Y` | 4 | 0 | 0 | 0 | 0 | Dusty Rose, Grey Heather, Midnight Blue, Onyx |
| Marketing | Opportunitee fundraiser | `DONATION` | 1 | 0 | 0 | 0 | 0 | Backpack |
| Marketing | Marketing Folders | `FOLDERS` | 1 | 0 | 0 | 0 | 0 | Black/White |
| Marketing | CF Wearable Hoodie | `HOODIECF` | 2 | 0 | 0 | 0 | 0 | English Logo, French Logo |
| Marketing | Thank you cards | `INSERT` | 4 | 0 | 0 | 0 | 0 | `2025 Gift Ta, `Bumblebee, `Owl, `Squirrel |
| Marketing | Lookbook | `LOOKBOOK` | 1 | 0 | 0 | 0 | 0 | F26 |
| Marketing | PROMOTIONAL MAGNETS | `MAGNETS` | 1 | 0 | 0 | 0 | 0 | ATC Comparabl |
| Marketing | Mint Candy | `MINTS` | 1 | 0 | 0 | 0 | 0 | Mint |
| Marketing | CF Wearable Tee | `TEECF` | 2 | 0 | 0 | 0 | 0 | English Logo, French Logo |
| New Era | Custom Cap | `NE0920` | 2 | 0 | 0 | 0 | 0 | ~Lode King, ~Mend The Gap |
| New Era | Stretch Mesh Cap | `NE1020` | 9 | 0 | 0 | 0 | 0 | Flag Blk/Blk, Flag Blk/Wht, Flag Chr/Chr, Flag DpNy/DN, Flag DpNy/Wh, Flag Grt/Grn… |
| New Era | Snapback Trucker Cap | `NE205` | 6 | 0 | 0 | 0 | 0 | Flag Blk/Blk, Flag Blk/Wht, Flag Camo/Blk, Flag DNvy/Wht, Flag Grap/Blk, Flag Roy/Wht |
| New Era | FlatBill Snapback Colorblk Cap | `NE8004C` | 5 | 0 | 0 | 0 | 0 | Black/Gold, Black/Graphit, Black/Lime, Black/Red, Black/Royal |
| Nike | Dri-FIT Smooth Hthr Lds Polo | `NKFQ4793` | 3 | 0 | 0 | 0 | 0 | AnthraciteHtr, Game RoyalHtr, Navy Hthr |
| Nike | Dri-FIT Smooth Heather Polo | `NKFQ4794` | 3 | 0 | 0 | 0 | 0 | AnthraciteHtr, Game RoyalHtr, Navy Hthr |
| Nike | MicroPique 2.0 Recycled Polo | `NKFV5507` | 8 | 0 | 0 | 0 | 0 | Anthracite, Black, Cool Grey, Game Royal, Navy, Team Red… |
| Nike | MicroPique 2.0 Recycle Lds Pol | `NKFV5510` | 8 | 0 | 0 | 0 | 0 | Anthracite, Black, Cool Grey, Game Royal, Navy, Team Red… |
| Nike | Brasilia 2.0 Medium Duffel | `NKIB4392` | 5 | 0 | 0 | 0 | 0 | Black, Game Royal, Midnight Navy, Smoke Grey, UniversityRed |
| Nike | MicroPique 2.0 L/S Polo | `NKIO8061` | 3 | 0 | 0 | 0 | 0 | Anthracite, Black, Navy |
| OGIO Bags | Rogue Backpack | `411042` | 2 | 0 | 0 | 0 | 0 | Black, Grey |
| OGIO Bags | Pursuit Backpack | `417054` | 1 | 0 | 0 | 0 | 0 | Black |
| OGIO Bags | Hatch Backpack | `91001` | 2 | 0 | 0 | 0 | 0 | Blk/HthrGrey, LaserRed/Hthr |
| OGIO Endurance | OGIO. ENDURANCE LADIES LS | `LOE321` | 1 | 0 | 0 | 0 | 0 | ELECTRIC BLUE |
| OGIO Endurance | OGIO. ENDURANCE LONG SLEEVE | `OE321` | 1 | 0 | 0 | 0 | 0 | ELECTRIC BLUE |
| Penguin | All Over Pete Printed Polo | `OGKSC0F0` | 3 | 0 | 0 | 0 | 0 | BK Iris Blue, Bright White, Caviar Black |
| Penguin | Solid Polo | `OGM0F3` | 4 | 0 | 0 | 0 | 0 | BlackIrisBlue, Bright White, Caviar Black, Quiet Shade |
| Penguin | Solid Polo | `OGMOF3` | 4 | 0 | 0 | 0 | 0 | BlackIrisBlue, Bright White, Caviar Black, Quiet Shade |
| Red Kap | WHITE COVERALL-NO BREAST POCKE | `CT16` | 1 | 0 | 0 | 0 | 0 | White |
| Red Kap | W DOW PREM TWL CRGO PANT RELAX | `FP72` | 1 | 0 | 0 | 0 | 0 | DARK NAVY 28 |
| Red Kap | UNISEX WHITE COUNTER JACKET/ES | `KK26` | 1 | 0 | 0 | 0 | 0 | WHITE |
| Red Kap | M PAINTER DUNGAREE | `PC80` | 1 | 0 | 0 | 0 | 0 | WHITE 34 |
| Red Kap | DURA KAP PANT | `PT20` | 9 | 0 | 0 | 0 | 0 | Black 30", Black 32", Black 34", Charcoal 30", Charcoal 32", Charcoal 34"… |
| Red Kap | MENS WORKPANT W/ CELLPHONE PKT | `PT2C` | 1 | 0 | 0 | 0 | 0 | Khaki 37U |
| Red Kap | MENS LIGHT WEIGHT CREW PANT | `PT2L` | 1 | 0 | 0 | 0 | 0 | KHAKI 29 |
| Red Kap | MEN'S PLEATED TWILL SLACK 34" | `PT38` | 2 | 0 | 0 | 0 | 0 | NAVY INS 33', NAVY INS 35' |
| Red Kap | MENS RED E PREST NAVY JEAN CUT | `PT50NV` | 1 | 0 | 0 | 0 | 0 | NAVY 40/32' |
| Red Kap | REDKAP WOMEN'S WORK PANT | `PT61BK` | 4 | 0 | 0 | 0 | 0 | BLACK 20/29, ~BLACK 29, ~BLACK 34U, BLACK INS 30 |
| Red Kap | MENS TWILL 65/35 WORK PANT - B | `PT62` | 1 | 0 | 0 | 0 | 0 | BLACK INS 34 |
| Red Kap | REDKAP INDUSTRIAL CARGO PANT | `PT88` | 6 | 0 | 0 | 0 | 0 | Black 30', Black 32', Black 34', Navy 30', Navy 32', Navy 34' |
| Red Kap | MEN'S CARGO PANT WITH SNAPS | `PT88BK` | 1 | 0 | 0 | 0 | 0 | Black 30/34' |
| Red Kap | WMNS CARGO POCKET PANT | `PT89` | 2 | 0 | 0 | 0 | 0 | KHAKI 2X34U, NAVY 26 |
| Red Kap | M PRO SHORT W/MIMIX &amp;CARGO PKT | `PX52` | 1 | 0 | 0 | 0 | 0 | Navy 12 |
| Red Kap | Utility Pant with Mimix | `PX60` | 1 | 0 | 0 | 0 | 0 | CHARCOAL 30 |
| Red Kap | M IQ LIGHTWEIGHT COMFORT PANT | `QP14` | 1 | 0 | 0 | 0 | 0 | NAVY 32 |
| Red Kap | F LS SOLID PERFORMANCE POLO | `SK7L` | 1 | 0 | 0 | 0 | 0 | BLACK |
| Red Kap | M PERF KNIT FLEX PRO POLO | `SK90` | 1 | 0 | 0 | 0 | 0 | Black |
| Red Kap | F SS PROFESSIONAL POLO | `SK91` | 2 | 0 | 0 | 0 | 0 | BLACK, Grey |
| Red Kap | MNS LS MOTORSPORTS SHIRT | `SP18` | 1 | 0 | 0 | 0 | 0 | Char/Black |
| Red Kap | MEN'S INDUSTRIAL STRIPE S/S | `SP20CW` | 1 | 0 | 0 | 0 | 0 | CHAR/WHITE LN |
| Red Kap | REDKAP S/S MOTORSPORTS SHIRT | `SP28` | 1 | 0 | 0 | 0 | 0 | Char/Royal |
| Red Kap | MEN LS TWILL 65/35 WORK SHIRT | `ST52` | 2 | 0 | 0 | 0 | 0 | Black, Black Tall |
| Red Kap | M LS Buick/GMC Tech Shirt | `SY14` | 1 | 0 | 0 | 0 | 0 | Char w/Grey |
| Red Kap | LS EN VIS SOLID YELLOW RIPSTOP | `SY14YE` | 1 | 0 | 0 | 0 | 0 | YELLOW |
| Red Kap | M SS Buick/GMC Tech Shirt | `SY24` | 1 | 0 | 0 | 0 | 0 | Char w/Grey |
| Red Kap | F LS AUTO OIL REPEL SHIRT | `SY31` | 1 | 0 | 0 | 0 | 0 | FIREBALL/CHAR |
| Red Kap | M LS TYPE O WORK SHIRT | `SY70` | 1 | 0 | 0 | 0 | 0 | Yellow/Char |
| Red Kap | COOLING SHORT SLEEVE POCKET TE | `TKM2` | 2 | 0 | 0 | 0 | 0 | Black, Black TALL |
| Red Kap | RED KAP QUILTED VEST POCKET | `VT22` | 1 | 0 | 0 | 0 | 0 | Navy |
| The North Face | Fall Line Backpack | `NF0A3KX7` | 1 | 0 | 0 | 0 | 0 | TNF Black |
| The North Face | DryVent Rain Jkt | `NF0A3LH4` | 1 | 0 | 0 | 0 | 0 | TNF Black |
| The North Face | DryVent Lds' Rain Jkt | `NF0A3LH5` | 1 | 0 | 0 | 0 | 0 | TNF Black |
| The North Face | Everyday Insulated Jacket FL | `NF0A7V6J` | 1 | 0 | 0 | 0 | 0 | TNF Black |
| The North Face | Everyday Insulated Ladies FL | `NF0A7V6K` | 1 | 0 | 0 | 0 | 0 | TNF Black |
| The North Face | Ridgewall Ladies SoftShell Jkt | `NF0A88D4` | 2 | 0 | 0 | 0 | 0 | TNF Black, TNF DrkGryHtr |
| The North Face | Ridgewall Soft Shell Jacket | `NF0A88D5` | 2 | 0 | 0 | 0 | 0 | TNF Black, TNF DrkGryHth |
| Unknown | Error Product | `PROMO PENS` | 1 | 0 | 0 | 0 | 0 | Black |
| Unknown Brand | Unknown Product | `0403` | 1 | 0 | 0 | 0 | 0 | White |
| Unknown Brand | Unknown Product | `ATC3704L` | 4 | 0 | 0 | 0 | 0 | Black, Coal Grey, True Navy, White |
| Unknown Brand | Unknown Product | `CHBC1102` | 4 | 0 | 0 | 0 | 0 | Black, Iron Grey, Midnight Navy, Olive Green |
| Unknown Brand | Unknown Product | `CHBC1103` | 4 | 0 | 0 | 0 | 0 | Black, Iron Grey, Midnight Navy, Olive Green |
| Unknown Brand | Unknown Product | `CHBC1104` | 4 | 0 | 0 | 0 | 0 | Black, Iron Grey, Midnight Navy, Olive Green |
| Unknown Brand | Unknown Product | `DUMMY` | 1 | 0 | 0 | 0 | 0 | Location |
| Unknown Brand | Unknown Product | `KOI2250Y` | 7 | 0 | 0 | 0 | 0 | Blue Mist, Dusty Rose, Grey Heather, Lapis Blue, Midnight Blue, Onyx… |
| Unknown Brand | Unknown Product | `L2045` | 3 | 0 | 0 | 0 | 0 | Black, Charcoal, Navy |
| Unknown Brand | Unknown Product | `NF0A52S6` | 1 | 0 | 0 | 0 | 0 | TNF Black |
| Unknown Brand | Unknown Product | `NKIB4394` | 5 | 0 | 0 | 0 | 0 | Black, Game Royal, Midnight Navy, Smoke Grey, UniversityRed |
| Unknown Brand | Unknown Product | `NKIB4408` | 5 | 0 | 0 | 0 | 0 | Black, Game Royal, Midnight Navy, Smoke Grey, UniversityRed |
| Unknown Brand | Unknown Product | `PC20` | 1 | 0 | 0 | 0 | 0 | NAVY 32" |
| Unknown Brand | Unknown Product | `SC16` | 1 | 0 | 0 | 0 | 0 | NAVY |
| Unknown Brand | Unknown Product | `WERK420L` | 5 | 0 | 0 | 0 | 0 | Athletic Grey, Black, Caramel, Dark Navy, Sand |

## Only one colour photographed (9)

| Brand | Style | Key | Colors | Fronts | Sides | Backs | Unique photos | Missing fronts |
|---|---|---|---:|---:|---:|---:|---:|---|
| ATC EuroSpun | Ring Spun Baseball Tee | `ATC0822` | 4 | 1 | 0 | 1 | 2 | AthGry/Char, AthGry/Navy, Wht/True Navy |
| ATC EuroSpun | Ring Spun Baseball Yth Tee | `ATC0822Y` | 3 | 1 | 0 | 1 | 2 | AthGry/Char, Wht/True Navy |
| ATC Pro Team | ProTeam Home &amp; Away Yth Jersey | `Y3519` | 7 | 1 | 0 | 1 | 2 | Black/Red, Carolina/Coal, Navy/Gold, Navy/White, Red/White, Royal/White |
| ATC Vintage | Vintage 1/4 Zip Sweatshirt | `F2042` | 4 | 1 | 0 | 1 | 2 | Black, Charcoal, Navy |
| CH Outerwear | Essential Fleece FZ Jacket | `F2010` | 2 | 1 | 1 | 0 | 2 | Dk Hthr Grey |
| CH Outerwear | Essential Fleece Lds FZ Jacket | `L2010` | 2 | 1 | 1 | 0 | 2 | Dk Hthr Grey |
| CH Wovens | Everyday S/S Woven Shirt | `D6021` | 5 | 1 | 0 | 5 | 6 | Black, Iron Grey, True Navy, True Royal |
| Carhartt | 28L Foundry Dual Cmprtmnt Bkpk | `CTB0000486` | 2 | 1 | 0 | 1 | 2 | CarharttBrown |
| Nike | Therma-FIT 1/4 Zip Fleece Hood | `NKFD9742` | 2 | 1 | 0 | 1 | 2 | Dk Grey Hthr |

## Single shared photo across colours (10)

| Brand | Style | Key | Colors | Fronts | Sides | Backs | Unique photos | Missing fronts |
|---|---|---|---:|---:|---:|---:|---:|---|
| ATC Everyday | Everyday Fleece Jogger | `ATCF2850` | 3 | 1 | 0 | 0 | 1 | Athletic Hthr, Dark HthrGrey |
| Carhartt | Backpack 20-Can Cooler | `CT89132109` | 2 | 1 | 0 | 0 | 1 | CarharttBrown |
| Carhartt | Foundry Series 14" Tool Bag | `CT89240105` | 2 | 1 | 0 | 0 | 1 | CarharttBrown |
| Carhartt | 25L Ripstop Backpack | `CTB0000481` | 2 | 1 | 0 | 0 | 1 | CarharttBrown |
| Carhartt | 120L Foundry Series Duffel | `CTB0000487` | 2 | 1 | 0 | 0 | 1 | CarharttBrown |
| Penguin | Lightweight Earl 1/4 Zip | `OGM100` | 2 | 1 | 0 | 0 | 1 | BlackIrisBlue |
| Penguin | Retro Geo Print Polo | `OGM105` | 2 | 1 | 0 | 0 | 1 | BlackIrisBlue |
| The North Face | Down Hybrid Jacket | `NF0A7V4F` | 2 | 1 | 0 | 0 | 1 | TNF Black |
| The North Face | Down Hybrid Ladies Jacket | `NF0A7V4G` | 2 | 1 | 0 | 0 | 1 | TNF Black |
| Unknown Brand | Unknown Product | `CTB0000564` | 2 | 1 | 0 | 0 | 1 | CarharttBrown |

## Every colour has a front (200 styles)

| Brand | Style | Key | Colors | Fronts | Sides | Backs | Unique photos | Missing fronts |
|---|---|---|---:|---:|---:|---:|---:|---|
| ATC Accessories | Performance Headband | `ATCHBAND` | 3 | 3 | 0 | 0 | 3 | — |
| ATC Accessories | Performance Wristband | `ATCWBAND` | 3 | 3 | 0 | 0 | 3 | — |
| ATC Accessories | Retro Backpack | `B1029` | 4 | 4 | 4 | 0 | 8 | — |
| ATC Accessories | Retro Barrel Duffel | `B1033` | 4 | 4 | 0 | 0 | 4 | — |
| ATC Accessories | Everyday Essential Tote | `B110` | 13 | 13 | 0 | 0 | 13 | — |
| ATC Earth Wash | Everyday Earth Wash L/S Tee | `ATC6015` | 6 | 6 | 6 | 0 | 12 | — |
| ATC Earth Wash | Everyday Earth Wash Tee | `ATC6040` | 14 | 14 | 14 | 0 | 28 | — |
| ATC Earth Wash | Everyday Earth Wash Ladies Tee | `ATC6040L` | 11 | 11 | 11 | 0 | 22 | — |
| ATC Earth Wash | Everyday Earth Wash Youth Tee | `ATC6040Y` | 11 | 11 | 10 | 0 | 21 | — |
| ATC Earth Wash | Everyday Earth Wash Crewneck | `ATCF6400` | 8 | 8 | 8 | 0 | 16 | — |
| ATC Earth Wash | Everyday Earth Wash Hood | `ATCF6500` | 11 | 11 | 11 | 0 | 22 | — |
| ATC Earth Wash | Everyday Earthwash Youth Hood | `ATCY6500` | 6 | 6 | 6 | 0 | 12 | — |
| ATC Essentials | Essential Performance Tee | `ATC3700` | 10 | 10 | 10 | 0 | 20 | — |
| ATC Essentials | Essential Performance Lds Tee | `ATC3700L` | 10 | 10 | 10 | 0 | 20 | — |
| ATC Essentials | Essential Performance Yth Tee | `ATC3700Y` | 10 | 10 | 10 | 0 | 20 | — |
| ATC Essentials | Essential Performance LS Tee | `ATC3715` | 6 | 6 | 6 | 0 | 12 | — |
| ATC Essentials | Essential Performance Yth LS T | `ATC3715Y` | 6 | 6 | 6 | 0 | 12 | — |
| ATC Essentials | Essential Perf Fleece FZ Hood | `ATCF2110` | 3 | 3 | 3 | 0 | 6 | — |
| ATC Essentials | Essential Perf Fleece 1/4 Zip | `ATCF2130` | 3 | 3 | 3 | 0 | 6 | — |
| ATC Essentials | Essential Perf Fleece Pant | `ATCF2180` | 3 | 3 | 3 | 0 | 6 | — |
| ATC Essentials | Essential Perf Youth Sweatpant | `ATCY2180` | 3 | 3 | 3 | 0 | 6 | — |
| ATC EuroSpun | Ring Spun Yth Tee | `ATC8000Y` | 11 | 11 | 0 | 10 | 21 | — |
| ATC EuroSpun | Ring Spun Tank | `ATC8004` | 1 | 1 | 0 | 1 | 2 | — |
| ATC Everyday | Everyday Pkt Tee | `ATC1000P` | 6 | 6 | 0 | 4 | 10 | — |
| ATC Flexfit | One Ten Snapback Cap | `ATC110F` | 4 | 4 | 3 | 4 | 11 | — |
| ATC Flexfit | One Ten Cool &amp; Dry Mini Pique | `ATC110P` | 3 | 3 | 0 | 3 | 6 | — |
| ATC Flexfit | Premium Classic Snapback | `ATC6089M` | 3 | 3 | 3 | 1 | 7 | — |
| ATC Flexfit | LowProfile CottonTwill Dad Hat | `ATC6245CM` | 5 | 5 | 5 | 4 | 14 | — |
| ATC Gameday | Game Day Fleece F/Z Hooded | `F2004` | 1 | 1 | 0 | 1 | 2 | — |
| ATC Headwear | Everyday Knit Skull Cap | `C105` | 3 | 3 | 0 | 0 | 3 | — |
| ATC Headwear | Everyday Twill Bucket Hat | `C1302` | 8 | 8 | 8 | 0 | 16 | — |
| ATC Headwear | Everyday Cotton Twill Dad Cap | `C1305` | 5 | 5 | 0 | 0 | 5 | — |
| ATC Headwear | 5 Panel Foam Trucker Cap | `C1327` | 6 | 6 | 6 | 0 | 12 | — |
| ATC PTech | PTech Fleece Hooded Sweatshirt | `F220` | 1 | 1 | 0 | 1 | 2 | — |
| ATC Pro Team | ProTeam S/S Lds' Tee | `L350` | 13 | 13 | 0 | 13 | 26 | — |
| ATC Pro Team | ProTeam L/S V-Neck Lds' Tee | `L3520LS` | 7 | 7 | 0 | 7 | 14 | — |
| ATC Pro Team | ProTeam Sleeveless V-Neck Lds' | `L3527` | 10 | 10 | 0 | 8 | 18 | — |
| ATC Pro Team | Pro Mesh Short | `S3525` | 2 | 2 | 0 | 2 | 4 | — |
| ATC Pro Team | Pro Team Sleeveless Tee | `S3527` | 9 | 9 | 0 | 8 | 17 | — |
| ATC Pro Team | Pro Club 7" Mesh Shorts | `S3536` | 3 | 3 | 3 | 3 | 9 | — |
| … | 160 more | | | | | | | |

## Most colours have a front (91 styles)

| Brand | Style | Key | Colors | Fronts | Sides | Backs | Unique photos | Missing fronts |
|---|---|---|---:|---:|---:|---:|---:|---|
| ATC Accessories | Everyday Cinch Pack | `B120` | 10 | 9 | 0 | 0 | 9 | Lime |
| ATC Essentials | Essential Performance Hood | `ATCF2100` | 12 | 11 | 11 | 0 | 22 | Charcoal Hthr |
| ATC Essentials | Essential Yth Performance Hood | `ATCY2100` | 12 | 11 | 11 | 0 | 22 | Charcoal Hthr |
| ATC EuroSpun | Ring Spun Tee | `ATC8000` | 19 | 14 | 0 | 14 | 28 | Charcoal Hthr, Hthr Cardinal, Hthr Forest, Hthr Navy, Hthr Teal |
| ATC EuroSpun | Ring Spun Lds' Tee | `ATC8000L` | 5 | 4 | 0 | 4 | 8 | Charcoal Hthr |
| ATC EuroSpun | Ring Spun V-Neck Lds' Tee | `ATC8001L` | 14 | 10 | 0 | 10 | 20 | Charcoal Hthr, Hthr Cardinal, Hthr Navy, Hthr Teal |
| ATC EuroSpun | Ring Spun L/S Tee | `ATC8015` | 7 | 6 | 0 | 5 | 11 | Charcoal Hthr |
| ATC Everyday | Everyday Cotton Tee | `ATC1000` | 50 | 42 | 2 | 18 | 62 | Athletic Hthr, Dark ChcBrown, Dark HthrGrey, Graphite Hthr, MilitaryGreen, Oatmeal Hthr… |
| ATC Everyday | Everyday Cotton Lds' Tee | `ATC1000L` | 26 | 23 | 1 | 16 | 40 | Athletic Hthr, Dark HthrGrey, Oatmeal Hthr |
| ATC Everyday | Everyday Cotton Tall Tee | `ATC1000T` | 9 | 8 | 0 | 0 | 8 | Athletic Hthr |
| ATC Everyday | Everyday Cotton Youth Tee | `ATC1000Y` | 34 | 29 | 0 | 17 | 46 | Athletic Hthr, Dark HthrGrey, Oatmeal Hthr, Team Drk Hthr, Team FrstGrn |
| ATC Everyday | Everyday Cotton Sleeveless Tee | `ATC1002` | 5 | 4 | 0 | 0 | 4 | Athletic Hthr |
| ATC Everyday | Everyday Cotton Tank Top | `ATC1004` | 7 | 6 | 0 | 6 | 12 | Athletic Hthr |
| ATC Everyday | Everyday Cotton Lds' Tank Top | `ATC1004L` | 7 | 6 | 0 | 6 | 12 | Athletic Hthr |
| ATC Everyday | Everyday Cotton L/S Tee | `ATC1015` | 28 | 22 | 2 | 12 | 36 | Athletic Hthr, Dark HthrGrey, Hthr Navy, Oatmeal Hthr, Team Drk Hthr, Team FrstGrn |
| ATC Everyday | Everyday Cotton L/S Yth Tee | `ATC1015Y` | 13 | 11 | 0 | 11 | 22 | Athletic Hthr, Dark HthrGrey |
| ATC Everyday | Everyday Cotton Blend LS Tee | `ATC5015` | 5 | 4 | 0 | 0 | 4 | Athletic Hthr |
| ATC Everyday | Everyday Cotton Blend Tee | `ATC5050` | 29 | 25 | 0 | 13 | 38 | Athletic Hthr, Dark HthrGrey, Team Drk Hthr, Team FrstGrn |
| ATC Everyday | Everyday Cotton Blend Yth Tee | `ATC5050Y` | 29 | 25 | 0 | 13 | 38 | Athletic Hthr, Dark HthrGrey, Team Drk Hthr, Team FrstGrn |
| ATC Everyday | Everyday Fleece F/Z Hooded | `ATCF2600` | 20 | 15 | 9 | 5 | 29 | Athletic Hthr, Dark HthrGrey, MilitaryGreen, Oatmeal Hthr, Team ForestGr |
| ATC FleeceCore | Core Hooded Sweatshirt | `F2016` | 4 | 3 | 0 | 3 | 6 | Charcoal Hthr |
| ATC FleeceCore | Core F/Z Hooded Sweatshirt | `F2018` | 4 | 3 | 0 | 3 | 6 | Charcoal Hthr |
| ATC FleeceCore | Core Hooded Yth Sweatshirt | `Y2016` | 4 | 3 | 0 | 2 | 5 | Charcoal Hthr |
| ATC Flexfit | One Ten Mesh Back Cap | `ATC110M` | 8 | 7 | 0 | 4 | 11 | Charcoal/Wht |
| ATC Flexfit | YP 5 Panel Classic Trucker Cap | `ATC6006` | 10 | 7 | 7 | 0 | 14 | Charcoal/Bk, Charcoal/Char, Charcoal/Wht |
| ATC Flexfit | Wooly Combed | `ATC6277` | 11 | 10 | 9 | 10 | 29 | Blk Multicam |
| ATC Headwear | Everyday Knit Cuff Toque | `C100` | 29 | 24 | 0 | 0 | 24 | AthleticGreen, AthleticOxfrd, DarkChocolate, MilitaryGreen, Oatmeal Hthr |
| ATC Headwear | Everyday Cotton Twill Cap | `C130` | 22 | 19 | 0 | 15 | 34 | Concrete, Dark Brown, MilitaryGreen |
| ATC Headwear | Pigment Dyed Cap | `C1321` | 9 | 8 | 1 | 0 | 9 | MilitaryGreen |
| ATC Headwear | Pigment Dyed Trucker Cap | `C1322` | 7 | 6 | 1 | 0 | 7 | MilitaryGreen |
| ATC Headwear | Everyday 5-Panel Cotton Cap | `C1340` | 12 | 10 | 10 | 0 | 20 | Dark Brown, MilitaryGreen |
| ATC Headwear | Everyday 5-Panel Trucker Cap | `C1342` | 9 | 7 | 7 | 0 | 14 | CoalGrey/Coal, Concrete/Wht |
| ATC Headwear | Everyday Youth Cuffed Toque | `Y100` | 6 | 5 | 0 | 0 | 5 | AthleticOxfrd |
| ATC Headwear | Everyday CottonTwill Youth Cap | `Y130` | 12 | 11 | 0 | 10 | 21 | Royal Blue |
| ATC Pro Team | ProTeam S/S Tee | `S350` | 17 | 15 | 0 | 12 | 27 | Extreme Orang, Extreme Yello |
| ATC Pro Team | ProTeam Shorts | `S355` | 7 | 5 | 1 | 5 | 11 | Charcoal Hth, Graphite Hth |
| ATC Pro Team | ProTeam S/S Yth Tee | `Y350` | 18 | 16 | 0 | 16 | 32 | Extreme Orang, Extreme Yello |
| ATC Ringspun | 24EVER Ringspun Cotton Lds Tee | `24EVERL` | 24 | 19 | 19 | 0 | 38 | Drk Chocolate, Drk Heather, MilitaryGreen, Oatmeal Hthr, `White |
| ATC Ringspun | 24EVER Ringspun Cotton LS Tee | `24EVERLS` | 11 | 8 | 8 | 0 | 16 | Drk Heather, Oatmeal Hthr, `White |
| ATC Ringspun | 24EVER Ringspun Cotton Yth Tee | `24EVERY` | 25 | 20 | 20 | 0 | 40 | Drk Chocolate, Drk Heather, MilitaryGreen, Oatmeal Hthr, `White |
| … | 51 more | | | | | | | |

## Partial colour photos (41 styles)

| Brand | Style | Key | Colors | Fronts | Sides | Backs | Unique photos | Missing fronts |
|---|---|---|---:|---:|---:|---:|---:|---|
| ATC EuroSpun | EuroSpun Long Sleeve Lds Tee | `ATC8015L` | 3 | 2 | 0 | 0 | 2 | Charcoal Hth |
| ATC Everyday | Everyday Fleece Tall Hood | `ATCF2500T` | 4 | 2 | 2 | 0 | 4 | Athletic Hthr, Dk Hthr Grey |
| ATC Everyday | Everyday Fleece 1/4 Zip | `ATCF2700` | 11 | 7 | 5 | 2 | 14 | Athletic Hthr, Dark HthrGrey, Oatmeal Hthr, Team DarkHthr |
| ATC Everyday | Everyday Fleece Sweatpants | `ATCF2800` | 6 | 3 | 0 | 2 | 5 | Athletic Hthr, Dark HthrGrey, Oatmeal Hthr |
| ATC Everyday | Everyday Fleece Short | `ATCF2875` | 3 | 2 | 0 | 0 | 2 | Dark Hthr Gry |
| ATC Everyday | Everyday Fleece F/Z Yth Hooded | `ATCY2600` | 11 | 7 | 3 | 4 | 14 | Athletic Hthr, Dark HthrGrey, MilitaryGreen, Team ForestGr |
| ATC Everyday | Everyday Fleece Yth Sweatpants | `ATCY2800` | 4 | 2 | 0 | 1 | 3 | Athletic Hthr, Dark HthrGrey |
| ATC FleeceCore | Core F/Z Hooded Lds'Sweatshirt | `L2018` | 3 | 2 | 0 | 2 | 4 | Charcoal Hthr |
| ATC Flexfit | YP FivePanel Retro Trucker Cap | `ATC6506` | 10 | 6 | 6 | 0 | 12 | Charcoal/Char, Charcoal/Wht, Heather/Blk, Heather/Wht |
| ATC Flexfit | YP Classics Retro Trucker Cap | `ATC6606` | 22 | 13 | 12 | 0 | 25 | Blk Multi/Blk, Caramel/BK, Charcoal/Bk, Charcoal/Char, Charcoal/Whit, Coyote Br/BK… |
| ATC Headwear | Everyday Snapback Trucker Cap | `C1318` | 24 | 16 | 0 | 15 | 31 | CoalGrey/Blk, CoalGrey/Wht, Dk Brown Sand, JasperBl/Crem, Maroon/Creme, Navy/Creme… |
| ATC Pro Team | ProTeam Home &amp; Away Jersey | `S3519` | 8 | 3 | 0 | 3 | 6 | Black/Red, Coal Grey/Bk, Lime/TrueNavy, Navy/Gold, Royal/White |
| ATC Pro Team | ProTeam Baseball Jersey | `S3526` | 10 | 3 | 0 | 3 | 6 | Char/Black, Char/Navy, Char/Red, Char/Royal, White/DpOrang, White/TrueNav… |
| ATC Pro Team | ProTeam Baseball Yth Jersey | `Y3526` | 8 | 2 | 0 | 2 | 4 | Char/Black, Char/Navy, Char/Red, Char/Royal, White/TrueNav, White/TrueRoy |
| ATC Pro Team | ProTeam Yth Shorts | `Y355` | 6 | 4 | 0 | 4 | 8 | Charcoal Hth, Graphite Hth |
| ATC Ringspun | 24EVER Ringspun Cotton Tee | `24EVER` | 38 | 23 | 23 | 0 | 46 | Dark Chocolat, Graphite Hthr, Hthr DarkGrey, Hthr Indigo, Hthr IrishGrn, Hthr Maroon… |
| ATC Vintage | Vintage Crewneck Sweatshirt | `F2046` | 4 | 2 | 0 | 2 | 4 | Charcoal, Navy |
| ATC WeRK Accsry | Fleece Lined Knit Cuff Beanie | `WERK1207` | 13 | 9 | 0 | 0 | 9 | Black.Hthr, Granite Hthr, Military Grn, Oatmeal Hthr |
| ATC WeRK Accsry | Canvas Snapback Trucker Cap | `WERK1333` | 3 | 2 | 2 | 0 | 4 | Grey |
| CH Everyday | Everyday CVC Ladies Polo | `L4047` | 7 | 4 | 4 | 0 | 8 | Dk Hthr Grey, Dk Sand, MilitaryGreen |
| CH Everyday | Everyday CVC Polo | `S4047` | 7 | 4 | 4 | 0 | 8 | Dk Hthr Grey, Dk Sand, MilitaryGreen |
| CH Sport Shirts | Snag Resist CBlock Lds' Polo | `L4001` | 4 | 2 | 0 | 2 | 4 | Black/Iron, Iron Grey/Bk |
| CH Sport Shirts | Snag Resist CBlock Polo | `S4001` | 4 | 2 | 0 | 2 | 4 | Black/Iron, Iron Grey/Bk |
| Carhartt | Canvas Backpack | `CT89241804` | 3 | 2 | 0 | 0 | 2 | CarharttBrown |
| Carhartt | Lunch 6-Can Cooler | `CT89251601` | 3 | 2 | 0 | 0 | 2 | CarharttBrown |
| Carhartt | Foundry Series Backpack | `CT89350303` | 3 | 2 | 0 | 0 | 2 | CarharttBrown |
| KOI Accessory | TwoTone Unstructured Snapback | `KOI1830` | 9 | 3 | 3 | 3 | 9 | Nat/Blue Mist, Nat/Charcoal, Nat/Cof Brown, Nat/LapisBlue, Nat/Mid Blue, Nat/Scar Red |
| KOI Accessory | KOI Matte 5-Panel Trucker Cap | `KOI1836` | 10 | 5 | 5 | 0 | 10 | BalsGreen/Bon, BlueMist/Bone, DustyRose/Bon, MidBlue/Bone, StormGr/Bone |
| New Era | Diamond Era Stretch Cap | `NE1121` | 3 | 2 | 2 | 0 | 4 | Flag Dp Navy |
| New Era | Perforated Performance Cap | `NE406` | 3 | 2 | 2 | 0 | 4 | Flag Dp Navy |
| Nike | Club Fleece Lds Pullover Hood | `NKFD9889` | 3 | 2 | 0 | 0 | 2 | Dk Grey Hthr |
| Nike | Club Fleece Lds Full Zip Hood | `NKFD9890` | 3 | 2 | 0 | 0 | 2 | Dk Grey Hthr |
| Penguin | Technical Earl Polo | `OGKSE002` | 3 | 2 | 0 | 0 | 2 | Bk Iris Blue |
| Red Kap | SHORT SLEEVE WOVEN CREW SHIRT | `SY20` | 5 | 3 | 0 | 3 | 6 | Black/Charcoa, Charcoal/Ryl |
| The North Face | Groundwork Backpack | `NF0A3KX6` | 3 | 2 | 0 | 0 | 2 | TNF Black |
| The North Face | Ultimate Trucker Cap | `NF0A4VUA` | 8 | 2 | 0 | 0 | 2 | Asphalt/White, BurntOlive/Gy, Med Grey/Blk, TNF Blue/Blck, Urban Navy/Wh, VintageWh/AGy |
| The North Face | Circular Rib Beanie | `NF0A7RGH` | 5 | 3 | 0 | 3 | 6 | Medium GrHthr, TNF Black |
| The North Face | Aim Full Zip Fleece Jacket | `NF0A8ENK` | 3 | 2 | 0 | 0 | 2 | TNF Black |
| The North Face | Aim Full Zip Fleece Ladies' Ja | `NF0A8FQJ` | 3 | 2 | 0 | 0 | 2 | TNF Black |
| Unknown Brand | Unknown Product | `ATCY2400` | 16 | 10 | 6 | 0 | 16 | Athletic Hthr, Dk Hthr Grey, MilitaryGreen, Oatmeal hthr, Team Drk Hthr, Team ForestGr |
| … | 1 more | | | | | | | |

## Files

- CSV (one row per style): `sanmar-staging-photo-audit.csv`
- Full JSON (every colorway + file names): `sanmar-staging-photo-audit.json`
