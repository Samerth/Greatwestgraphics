# Great West Graphics — staging test pack

Everything below runs against the staging environment, which is a full copy of
the production stack: its own database, its own catalogue, its own uploads.
Nothing you do here touches the live site, so test destructively.

**Staging URL:** https://d1so4a0f4v7ki5.cloudfront.net

---

## 1. Before you start: what is deliberately not finished

Please do not raise these — they are known and tracked. Everything else is fair
game, including wording, layout, and anything that merely feels wrong.

- **No payment is taken anywhere.** Checkout collects a payment *preference*
  (card, Interac, Net-30) and submits the order for design review. There is no
  payment processor connected, and no card fields are shown by design.
- **About a quarter of products have no category**, mostly quarter-zips and
  caps. They are reachable by search and by direct link, not by category.
  Around 265 SanMar styles are in this group.
- **Sorting only reorders the page you are on**, not the whole result set.
- **Colour swatches and feature checkboxes on the product *listing* page are
  decorative.** The ones on the product *detail* page are real.
- **The sitemap is stale** (lists ~4,900 of ~10,100 products).
- **Product photos are front, side and back only.** There is no separate left
  and right sleeve view; the vendor does not supply them.
- **Email only reaches greatwestgraphics12@gmail.com** at the moment. The
  sending domain is not verified yet, so notifications to any other address
  will not arrive. Check the contact form and proof notifications with that
  address only.

---

## 2. Accounts and how to sign in

### Staff / admin
Go to `/admin/login`. The username and password live in AWS Secrets Manager in
the staging web secret (its name begins `gwg-staging/web`), under the keys
`STAFF_ADMIN_USER` and `STAFF_ADMIN_PASSWORD`. Sam will send these to you
directly — they are deliberately not written down in this file.

There is no password reset and no one-time-code login for staff. That is
intentional.

### Retail customer
Create your own. Use the **Sign in** link in the header and register with any
email you control. Signing in on the main storefront automatically gives you a
customer account, so no invitation is needed.

### Corporate customer
Create your own at `/start`. That wizard creates a company account *and* its
branded store in one step. The store then waits for staff approval before it
opens — approving it is part of flow B below.

There is already one waiting for review from our own testing, **Acme Team
Store** (`/s/acme-3426`). You can approve that one or make your own.

---

## 3. Flow A — retail customer, browse to submitted order

This is the main journey. Do it end to end in one sitting, signed in as a
retail customer.

1. **Browse.** From the home page, open a category from the nav or the tiles.
   Check the category actually filters, that paging works, and that the counts
   at the top of `/products` agree with what is shown.
2. **Open a product.** Check the description reads as prose and bullets, with
   no visible HTML tags. SanMar images were only switched on tonight, so please
   watch for products that still show a grey tile and tell us which ones.
   Change colour and size and confirm the image and availability follow.
3. **Check the price.** The product page quotes a price that changes with
   quantity. Increase the quantity and confirm the unit price drops at the
   break points and the total is the unit price times quantity.
4. **Design it.** Open **Design** on the product. Upload a logo, add text,
   move and resize it, and switch between front and back. Then use **Export**
   and confirm the file you get back shows the *whole* design, not just the
   image you uploaded. This one is worth being fussy about.
5. **Add to cart.** Confirm the cart shows the right product, colour, size,
   quantity and price, and that your artwork is attached to the line.
6. **Checkout.** Fill in the contact and shipping details, pick a payment
   preference, and submit. You should land on a confirmation with a job number
   in the form `GWG-1005`.
7. **Check your own copy.** Go to `/portal/jobs`. Your order should be listed
   with the artwork you designed and any note you left.

Along the way, please click every link you pass. Dead links and links that go
somewhere unexpected are exactly what we need found.

---

## 4. Flow B — corporate branded store, sign-up to fulfilment

This is the newest part of the system and the least exercised. Take it slowly.

1. **Sign up a company.** As a *different* customer from flow A, go to `/start`
   and create a company account with a store name, a URL slug, and a brand
   colour. Note the slug you chose.
2. **Confirm it is not live yet.** Open `/s/<your-slug>`. It should say the
   store is not open yet rather than letting you shop.
3. **Approve it as staff.** Sign in at `/admin/login`, go to **Accounts**, find
   the store waiting for review, and approve it.
4. **Set its pricing.** Open the store from that list and set a storewide
   pricing adjustment, for example `-10` for ten percent off. Save.
5. **Curate its catalogue.** On the same screen, restrict the store to two or
   three categories and save.
6. **Shop the branded store.** Back as the company's customer, open
   `/s/<your-slug>`. You should see a banner naming the store, the brand
   colour applied, and only the categories you allowed. Compare a product's
   price here against the same product on the main site — it should be lower by
   the adjustment you set.
7. **Invite a colleague.** From `/account/team`, invite a second email address
   you control. Open the invitation link, sign in as that person, and confirm
   they can shop the store and place an order.
8. **Place an order** as that invited colleague, exactly as in flow A.
9. **Confirm staff can see it.** Sign back in as staff and open `/admin/jobs`.
   The order must appear there, labelled with the company's store name rather
   than "Main store". **This is the single most important check in this pack** —
   it was broken until today, and an order that staff cannot see is an order
   that never gets made.
10. **Leave the store.** Use the "Shop the main site instead" link in the
    banner and confirm you are back on the ordinary storefront at main-site
    pricing.

### Two things to try breaking

- Sign in as a *third* customer who was never invited, then open
  `/s/<your-slug>` and try to order. They should be stopped. If a stranger can
  order from, or see anything belonging to, a company they were not invited to,
  stop and tell us immediately.
- While signed in as the flow A customer, try to open a job belonging to the
  flow B customer by editing the URL in `/portal/jobs/<id>`. You should get a
  "not found", never somebody else's order.

---

## 5. Flow C — staff review and the proof round trip

Signed in as staff, using an order submitted in flow A or B.

1. Open the order from `/admin/jobs`. Confirm you can see the customer's
   artwork, their note, the line items, and the sizes.
2. Open the customer's design in the studio using the link on the order, make
   a change, and save it.
3. Move the order to **under review**.
4. Send a final quote with an amount and a note.
5. Upload a proof for the customer to approve.
6. As the customer, open `/portal/jobs/<id>`. The proof should be waiting with
   an **Approve** and a **Request changes** option. Request changes and leave a
   reason.
7. As staff, confirm the order now shows it is waiting on you, and that the
   customer's reason is visible.
8. Upload a corrected proof. As the customer, approve it this time.
9. Confirm the status moves on and both sides see the same history.

---

## 6. Also worth a pass

- `/quote` — the standalone quote request form.
- `/contact` — send one and confirm it arrives at
  greatwestgraphics12@gmail.com.
- `/admin/pricing/v2` — change a pricing rule, save, publish, and confirm the
  storefront price moves accordingly. Please note what you changed so we can
  put it back.
- `/admin/catalog`, `/admin/categories`, `/admin/designs`, `/admin/sync` —
  click through and report anything that errors or is obviously unfinished.
- The whole site on a phone. Header, filters, the design studio, and checkout
  are the places most likely to break.

---

## 7. How to report

For each issue please give us:

- the URL, and which account you were signed in as (retail, corporate owner,
  invited colleague, or staff);
- what you expected and what happened;
- a screenshot, and the job number if an order was involved.

Rank each one as **blocks the sale**, **wrong but survivable**, or **cosmetic**.
We would rather have twenty small honest notes than one polished summary.
