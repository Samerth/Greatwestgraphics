import type { LocationPage, LocationSection } from "./location-pages";
import { GWG_ADDRESS, GWG_PHONE_DISPLAY } from "./phone";

/**
 * City-specific replacement copy for WordPress pages that were title-swaps
 * or empty shells. Each path has its own facts — do not genericize this.
 */
const THIN_COPY: Record<string, LocationSection[]> = {
  "/screen-printing-and-embroidery-twin-falls": [
    {
      heading: null,
      paragraphs: [
        "Twin Falls sits on the Snake River canyon in southern Idaho’s Magic Valley. Farms, food processors and the College of Southern Idaho keep a steady need for workwear and event shirts — and those orders used to mean a drive to Boise or a catalogue that never called back. Great West Graphics prints and embroiders those jobs in Vancouver and ships them to Twin Falls on a tracked carton.",
        "Screen printing is the usual choice for a bulk Twin Falls run: staff tees, rodeo and fair shirts, or a warehouse logo on a few hundred pieces. Embroidery is the better finish on polos, jackets and caps for clinics and dealerships along Blue Lakes Boulevard. You approve a digital proof before anything hits a press or a hoop.",
      ],
    },
    {
      heading: "What we decorate for Magic Valley teams",
      paragraphs: [
        "T-shirts, hoodies, hats, jackets and safety wear from the live catalogue, plus banners when an event needs both apparel and a backdrop. Typical production is 5–7 business days in Vancouver; say so if the Twin Falls in-hands date is tighter and we will confirm a rush window before you commit.",
        `Call ${GWG_PHONE_DISPLAY} or request a quote with quantity, sizes and the date you need the boxes in Twin Falls. Pickup at our showroom (${GWG_ADDRESS}) is available if someone is already coming to the coast.`,
      ],
    },
  ],
  "/screen-printing-and-embroidery-nampa": [
    {
      heading: null,
      paragraphs: [
        "Nampa is the second-largest city in Idaho and the west end of the Treasure Valley. Manufacturers along I-84, school districts and the Ford Idaho Center calendar create the same kind of branded apparel work we already run for Boise — just with a Nampa ship-to. We screen print and embroider in Vancouver and send the finished goods to your Nampa dock or office.",
        "A Nampa warehouse crew usually wants a durable screen print on a mid-weight tee. Office and dealership staff lean toward embroidered polos and jackets that still look right after a year of wash. We will say which method fits the art and the fabric before you pay for screens or digitizing.",
      ],
    },
    {
      heading: "Ordering from the Treasure Valley",
      paragraphs: [
        "Send the logo, the garment and the count. If you do not have a blank in mind, pick one from the shop or ask us to match a brand you already issue. Proofs go out by email; the carton ships to Nampa once you sign off.",
        `Questions while you are specifying a job: ${GWG_PHONE_DISPLAY}. The production floor is at ${GWG_ADDRESS}.`,
      ],
    },
  ],
  "/screen-printing-and-embroidery-swift-current": [
    {
      heading: null,
      paragraphs: [
        "Swift Current sits on the Trans-Canada in southwest Saskatchewan — a regional centre for energy, agriculture and the Broncos. Local print shops are scarce, and a Regina or Saskatoon detour is a long day for a hundred shirts. We take Swift Current orders on the same Vancouver floor that serves the rest of the Prairies and ship them west on a carrier you can track.",
        "Screen printing holds up on team and stampede tees. Embroidery is the cleaner mark on a grain-elevator polo or a toque for a winter crew. Both are proofed before production so the crest and the colours are the ones you approved, not a surprise at the rink.",
      ],
    },
    {
      heading: "Prairie timing and freight",
      paragraphs: [
        "Build a few extra days into a Swift Current in-hands date for ground freight from Vancouver. If the Broncos banquet or a harvest event cannot move, tell us the date first and we will say whether a rush run will actually make it.",
        `Start with a quote or call ${GWG_PHONE_DISPLAY}. Showroom visits are at ${GWG_ADDRESS}.`,
      ],
    },
  ],
  "/screen-printing-and-embroidery-sherbrooke": [
    {
      heading: null,
      paragraphs: [
        "Sherbrooke is the principal city of Quebec’s Eastern Townships — universities, hospitals and manufacturers that need bilingual crests as often as English ones. We do not have a Sherbrooke storefront; the work is printed and embroidered in Vancouver and shipped into Quebec with the same proofing step we use for every other city.",
        "Send art with the French and English lockups you actually use. Screen printing is efficient for a run of faculty or festival tees. Embroidery sits better on a Université de Sherbrooke polo or a clinic jacket. We will flag a stitch or ink problem on the proof, not after the boxes land on King Street.",
      ],
    },
    {
      heading: "How a Sherbrooke order runs",
      paragraphs: [
        "You pick the garment and quantity, we send a mock-up, you approve it, we decorate and ship. Customs and provincial delivery are part of the quote, not a surprise invoice.",
        `Call ${GWG_PHONE_DISPLAY} if you want to talk through a bilingual logo before you upload files. The shop is at ${GWG_ADDRESS} in Vancouver.`,
      ],
    },
  ],
  "/screen-printing-and-embroidery-richland": [
    {
      heading: null,
      paragraphs: [
        "Richland is one of Washington’s Tri-Cities, next to the Columbia and a long-standing science and energy workforce. Labs, contractors and youth sports along George Washington Way order the same crested apparel we already ship into the Northwest — they just need a Richland address on the carton, not a Portland pickup.",
        "Screen printing covers tournament tees and site-safety shirts. Embroidery is the usual request for a contractor polo or a softshell that has to look like it belongs in a badge line. We match PMS colours on ink and can digitize a crest so the stitch count stays readable at chest size.",
      ],
    },
    {
      heading: "Tri-Cities delivery",
      paragraphs: [
        "Orders leave Vancouver after the proof is signed. Ground into Richland is typically a few business days on top of production. Say so if a Hanford-area site orientation or a tournament cannot slip.",
        `Request a quote or phone ${GWG_PHONE_DISPLAY}. Visit us at ${GWG_ADDRESS} when you are in Vancouver.`,
      ],
    },
  ],
  "/t-shirt-design-richmond": [
    {
      heading: null,
      paragraphs: [
        "Richmond sits between the airport and the river — restaurants on No. 3 Road, warehouses on Bridgeport, school and club orders from Steveston to Hamilton. This page is for people who need a t-shirt designed and printed, not a blank they already art-directed. Our Vancouver studio will take a logo, a sketch or a messy export and turn it into a print-ready file you approve before we burn a screen.",
        "You can start in the design studio on a live garment, or send a file and let us place it. Richmond clients often want both a staff tee and a front-of-house polo on the same job; we will keep the mark consistent across those fabrics.",
      ],
    },
    {
      heading: "From file to a Richmond delivery",
      paragraphs: [
        "Once the art is signed off, we screen print or use another method if the colour count or fabric demands it. Metro Vancouver courier can put the boxes in Richmond the next business day after production; you can also pick up on East Kent.",
        `Call ${GWG_PHONE_DISPLAY} if you want to walk the art in. The showroom is ${GWG_ADDRESS}.`,
      ],
    },
  ],
  "/t-shirt-design-vancouver": [
    {
      heading: null,
      paragraphs: [
        "This is the Vancouver design-and-print page — for a shop that is already on East Kent Avenue South, not a mail-order template. Bring a file, a phone photo of a crest, or a brand kit and we will build a placement that fits the tee you actually picked, then print it on the floor downstairs from the showroom.",
        "Most Vancouver design jobs start with a digital mock-up the same day we have a usable file. You change the size or the chest-versus-back call before we make screens. That is the difference between a design page and a product listing.",
      ],
    },
    {
      heading: "Design in the studio or on the floor",
      paragraphs: [
        "Use the online design studio to place art on a catalogue garment, or visit the showroom, handle the blank, and sign the proof in person. Either path ends on the same presses.",
        `Book a look at samples on ${GWG_PHONE_DISPLAY}. We are at ${GWG_ADDRESS}, a short trip from the Canada Line at Marine Drive.`,
      ],
    },
  ],
  "/custom-screen-printing-everett": [
    {
      heading: null,
      paragraphs: [
        "Everett is a Puget Sound manufacturing and port city — Boeing, the naval station and a waterfront that still runs shift work. Custom screen printing for Everett crews is a volume job more often than a fashion one: durable ink, a readable mark, and a ship date that matches a shutdown or a union event. We print in Vancouver and freight the finished shirts south.",
        "If the art is a one-colour union bug or a four-colour festival mark, say so up front. Screen count drives both price and turnaround. Everett orders over a few dozen pieces are almost always screen print; we will tell you when DTF or embroidery is the better call instead of forcing a screen.",
      ],
    },
    {
      heading: "Everett freight and rush",
      paragraphs: [
        "Ground from Vancouver to Everett is a short hop once the dryer is done. Same-week in-hands dates are possible when the press calendar allows — ask before you promise a hall or a job site.",
        `Get a quote or call ${GWG_PHONE_DISPLAY}. Showroom: ${GWG_ADDRESS}.`,
      ],
    },
  ],
  "/screen-printing-in-saskatoon": [
    {
      heading: null,
      paragraphs: [
        "Saskatoon’s orders come from the university, the river-city festivals and the shops along Idylwyld and 8th Street — not from a generic “Prairie city” blurb. We screen print those tees, hoodies and tote bags in Vancouver and ship them to a Saskatoon dock with a proof you already signed.",
        "A USask club run and a Nutrien-staff picnic are different jobs. The first often wants many sizes and a tight date around Welcome Week; the second wants a clean crest and a carton that arrives before the event photographer does. Tell us which one you are, and we will plan screens and freight around it.",
      ],
    },
    {
      heading: "What “screen printing in Saskatoon” actually means here",
      paragraphs: [
        `We are not a Saskatoon storefront. We are a Vancouver decorator that already ships into Saskatchewan every week. You get the same ink, the same proof and a phone number that reaches the floor — ${GWG_PHONE_DISPLAY} — instead of a form that dead-ends.`,
        `Need to see garments first? The showroom is ${GWG_ADDRESS}. Otherwise start a quote with the Saskatoon in-hands date in the notes.`,
      ],
    },
  ],
  "/screen-printing-medicine-hat": [
    {
      heading: null,
      paragraphs: [
        "Medicine Hat — the Gas City — sits on the South Saskatchewan in Alberta’s southeast corner, closer to the Cypress Hills than to a big print market. Hockey associations, gas-plant contractors and the downtown businesses along 3rd Street still need crested shirts. We screen print them in Vancouver and put Medicine Hat on the bill of lading.",
        "Ink on a cotton tee is the usual Hat request. If you also need an embroidered toque for a winter crew, that can ride in the same shipment so you are not coordinating two vendors across the Prairies.",
      ],
    },
    {
      heading: "Dating a Medicine Hat job",
      paragraphs: [
        "Give us the event or site date before you pick a novelty blank that is on backorder. We would rather swap the garment than miss a Stampede-week or shutdown window because a colourway was empty.",
        `Call ${GWG_PHONE_DISPLAY} or send the quote. Production and pickup live at ${GWG_ADDRESS}.`,
      ],
    },
  ],
  "/screen-printing-prince-albert": [
    {
      heading: null,
      paragraphs: [
        "Prince Albert is the gateway to northern Saskatchewan — forestry, health-region work and a city that sits a four-hour drive north of Regina. Screen printing for Prince Albert is about getting a readable mark onto workwear and community tees, then surviving the extra freight leg. We print in Vancouver and book the carton through to Prince Albert, not to a locker in Saskatoon you have to fetch.",
        "High-visibility vests and mid-weight tees are common on these jobs. If the logo has to stay legal on a CSA garment, send the spec with the art so we do not put a print where the reflective tape has to live.",
      ],
    },
    {
      heading: "North-of-Saskatoon shipping",
      paragraphs: [
        "Build transit time into the quote. We will not promise a Monday delivery in Prince Albert on a proof you approved Friday afternoon. When the date is real, we will say so in writing.",
        `Phone ${GWG_PHONE_DISPLAY}. Floor and showroom: ${GWG_ADDRESS}.`,
      ],
    },
  ],
  "/screen-printing-and-embroidery-idaho-falls": [
    {
      heading: null,
      paragraphs: [
        "Idaho Falls is eastern Idaho’s commercial centre, on the Snake River and a short hop from INL and the airport. The old page for this city was an empty title. The live service is the same one we run for the rest of Idaho: screen printing and embroidery in Vancouver, shipped to an Idaho Falls street address you name on the order.",
        "Lab and contractor apparel usually wants embroidery. Tournament and fundraiser tees want screens. If you need both on one invoice — jackets for supervisors and tees for a weekend event — say so and we will keep the crest consistent.",
      ],
    },
    {
      heading: "Eastern Idaho specifics",
      paragraphs: [
        "Winter freight into Idaho Falls can add a day. Summer youth-sports weekends stack up; send the roster early if names and numbers are part of the job.",
        `Request a quote or call ${GWG_PHONE_DISPLAY}. We are at ${GWG_ADDRESS} when you want to see a stitched sample in person.`,
      ],
    },
  ],
  "/screen-printing-delta-free-shipping": [
    {
      heading: null,
      paragraphs: [
        "Delta — Ladner, Tsawwassen and North Delta — is inside our Metro Vancouver courier zone. “Free shipping” on this URL still means what the rest of the site says: orders over $300 ship free in Canada and the United States, and local Delta deliveries are quoted as Metro Vancouver courier, not a cross-country carton.",
        "This is not a Tsawwassen ferry-terminal print kiosk. The presses are in Vancouver. A Delta restaurant group or a South Delta school can still get a next-business-day handoff after production, or pick up on East Kent if that is faster than waiting on a van.",
      ],
    },
    {
      heading: "What we print for Delta",
      paragraphs: [
        "Screen-printed tees and hoodies for schools and clubs, embroidered polos for the industrial parks along Highway 99, and the occasional banner for a Tsawwassen event. Same proof, same phone number as every other Lower Mainland page.",
        `Call ${GWG_PHONE_DISPLAY}. Showroom and pickup: ${GWG_ADDRESS}.`,
      ],
    },
  ],
  "/custom-t-shirt-printing-maple-ridge": [
    {
      heading: null,
      paragraphs: [
        `Maple Ridge sits at the east end of Metro Vancouver, past Pitt Meadows on the Lougheed. Custom t-shirt printing for Ridge Meadows schools, the downtown shops along 224th and the industrial yards toward the river is a local courier job for us, not a long-haul mystery. We print in Vancouver — and the number to call is ${GWG_PHONE_DISPLAY}, not a transposed line.`,
        "Most Maple Ridge tee jobs are screen print: a club mark, a company picnic, a grad class. If the art is a full-colour photo, we will talk DTF instead of burning a dozen screens for twenty shirts. You see that recommendation on the proof.",
      ],
    },
    {
      heading: "Pickup or a Ridge delivery",
      paragraphs: [
        "After production we can courier into Maple Ridge or you can collect at the showroom. Either way the count is checked before the box is taped.",
        `Visit ${GWG_ADDRESS} or start a quote. The only shop number is ${GWG_PHONE_DISPLAY}.`,
      ],
    },
  ],
  "/t-shirt-screen-printing-vancouver": [
    {
      heading: null,
      paragraphs: [
        "Vancouver screen printing is the work this shop was built for in 1980. This URL is the t-shirt-specific version of that: cotton and tri-blend tees, a limited colour count, screens burned on East Kent, shirts through the dryer before they go in a box. It is not a leftover shop module and it is not a blog snippet.",
        "We run automatic presses for the long jobs and still have room for a 24-piece staff tee if the art is honest. You approve a mock-up that shows placement on the actual blank, not a generic silhouette.",
      ],
    },
    {
      heading: "When to pick screens over everything else",
      paragraphs: [
        "Choose screen printing when the quantity is real and the colour count is sane. Choose embroidery for a polo or a hat. Choose DTF when the art is a photograph. We will say so if you pick the wrong method for the file you sent.",
        `Walk in at ${GWG_ADDRESS} or call ${GWG_PHONE_DISPLAY}. The quote builder will price a screen-print tee if you want the number before you visit.`,
      ],
    },
  ],
  "/custom-banner-printing-richmond": [
    {
      heading: null,
      paragraphs: [
        "Richmond banner jobs are usually for a restaurant opening on No. 3 Road, a warehouse sale on Bridgeport, or a community event in Steveston — wide, weather-aware prints, not a leftover apparel paragraph. We design and print banners in the same Vancouver shop that does the shirts, so a Richmond client can order the backdrop and the staff tees on one conversation.",
        "Send the finished size, indoor versus outdoor, and whether you need grommets, pole pockets or a stand. We will not quote a fabric tee spec against a vinyl banner just because the old page sat in a t-shirt template.",
      ],
    },
    {
      heading: "Apparel is still available on the same order",
      paragraphs: [
        "If the Richmond event also needs tablecloths or tees, add them on the quote. Courier into Richmond is Metro Vancouver delivery after production.",
        `Call ${GWG_PHONE_DISPLAY} or use the contact form. Showroom: ${GWG_ADDRESS}.`,
      ],
    },
  ],
  "/decoration-processes/custom-screen-printing/vancouver": [
    {
      heading: null,
      paragraphs: [
        "This nested URL is the Vancouver screen-printing process page — the same path WordPress used under Decoration Processes. It is not a second homepage and it is not a blank. Screen printing here means mesh, ink and a squeegee on a garment you chose, done on our Vancouver floor, with a proof before we make the screens.",
        "Read the parent decoration-process pages if you are still choosing a method. Stay here if you already know you want screens and a Vancouver production slot. The catalogue and the quote builder are the next step, not a leftover shop module pasted into the article.",
      ],
    },
    {
      heading: "Screens, colours and the dryer",
      paragraphs: [
        "Each colour is a screen. That is why a one-colour crest is fast and a photographic print is the wrong tool. After print, garments go through the dryer so the ink cures — that is what keeps a Vancouver event tee readable after the wash.",
        `See the method in person at ${GWG_ADDRESS} or call ${GWG_PHONE_DISPLAY}. Related process pages: embroidery and the main decoration overview.`,
      ],
    },
  ],
};

export function uniqueThinSections(page: LocationPage): LocationSection[] {
  const written = THIN_COPY[page.path];
  if (written) return written;
  // Should not run — every thin slug is listed above — but never render an empty article.
  return [
    {
      heading: null,
      paragraphs: [
        `${page.service} for ${page.city}, ${page.region} is printed and embroidered at Great West Graphics in Vancouver and shipped to you. Typical production is 5–7 business days; rush work is quoted against the real press calendar.`,
        `Call ${GWG_PHONE_DISPLAY} or request a quote. The showroom is ${GWG_ADDRESS}.`,
      ],
    },
  ];
}

export function thinCopyPaths(): string[] {
  return Object.keys(THIN_COPY);
}
