# Wedgewood Swim Club Check-In — The Plan

**For:** Ryan
**From:** Amarnath
**Goal:** Launch a working check-in system for Wedgewood by Memorial Day weekend (May 22).

---

## What you'll see in the mockup

A working web demo of two screens, in your browser:

**1. The member screen** — what a member sees on their phone when they scan the QR code at the gate. They fill in their info, hit Check In, and immediately see a green "Welcome, [family]!" or a red "Membership not found." Email confirmation arrives a few seconds later.

**2. The staff dashboard** — what lifeguards see on an iPad at the front desk. Live feed of who just checked in (newest at the top), a search box for walk-ups, and a few "how busy is today" tiles. Updates in real-time.

Try it: open `wedgewood-mockup.html`, type "Smith" as a last name and hit Check In to see the success path. Type any other name to see the failure path. Switch to the Staff Dashboard tab and watch the check-in you just submitted appear in the live feed.

---

## What's already done (in Wedgewood's GoHighLevel)

I went through Wedgewood's GHL sub-account in detail. **A lot of the system already exists.** You've been building this.

- ✅ Pool Sign In form is live, with the right fields (Name, Phone, Membership Name, attendance count, guests, payment).
- ✅ The "New - Form Submission Membership Check" workflow is published and has fired 4 times already. It correctly checks for the `2026_membership` tag and routes members vs. non-members.
- ✅ Membership signup flow is wired up — new members get the tag automatically.
- ✅ Contact records for all 44 paying members exist.
- ✅ Stripe is set up for payments.

**My job is mostly to connect what you have to a small AWS service and a staff dashboard.** Not rebuild from scratch.

---

## What we propose to add (small additions)

### 1. Inside your existing GHL workflow — 4 new actions

In the "New - Form Submission Membership Check" workflow, we add to each branch:

**To the "member" branch:**
- Send Email: "Welcome to Wedgewood, [name]!" (so the member knows they're checked in)
- Custom Webhook: POSTs the check-in event to our AWS Lambda (so the staff dashboard sees it)

**To the "not a member" branch:**
- Send Email: "Membership not found. Please see the desk OR sign up here."
- Custom Webhook: logs the failed attempt so staff can spot it.

You're the one who clicks these into place in GHL. Total time: ~30 minutes of clicking. I'll send you the exact email text + webhook URL.

### 2. A small AWS backend

One Lambda function + a DynamoDB table. Cost: ~$4/month.

What it does:
- Receives check-in events from your GHL workflow
- Stores them as a log
- Serves the staff dashboard with live feed + search + insights

We don't sync your member data to AWS. GoHighLevel stays the source of truth — AWS just stores check-in events (who came when).

### 3. The staff dashboard webpage

Lives inside Wedgewood's GHL account as a new password-protected Funnel page. Lifeguards open it on an iPad in Safari. Updates every 3 seconds. No app to install.

---

## What we ask from you

Just **three decisions** so we can build:

**1. Path for member feedback — Path A or Path B?**

- **Path A** (faster): Keep your existing Pool Sign In form. After submit, member sees a generic "Thanks!" page. Email confirmation arrives a few seconds later with green/red answer.
- **Path B** (better UX): We build a slightly different version of the form as a custom page. Member sees the green/red answer instantly on the same screen, no waiting for email. ~6 hours more work for us.

**Our recommendation: Path B.** A teenager filling out a form at the gate while a line builds up should know in 1 second, not 10. Worth the extra effort.

**2. Guest fee for the Stripe Payment Link**

What does Wedgewood charge per guest visit? ($5? $7? $10?) Or is there a punch card? Need the exact number to wire the payment.

**3. Pool Sign-Out — ship for launch or defer?**

Your Pool Sign-Out workflow is still in draft, and it checks a different tag than Pool Sign-In. Do we ship sign-out for Memorial Day, or defer it to later? (Recommend: defer. It's a nice-to-have for Phase 2.)

---

## What I do next

The moment you give me the three answers above, I start building. Timeline:

| Day | What I do | What you do |
|---|---|---|
| Wed May 14 | Build AWS Lambda + DynamoDB | Add the 4 actions to your workflow |
| Thu May 15 | Connect Lambda to your workflow, test end-to-end | Confirm test members work |
| Fri May 16 | Build the staff dashboard page | — |
| Mon May 18 | Polish + insights tiles | — |
| Tue May 19 | End-to-end testing | — |
| Wed May 20 | Dress rehearsal at Wedgewood | Be on-site with me |
| Thu May 21 | Buffer / hot fixes | — |
| **Fri May 22** | **Launch — Memorial Day open** | On-call together |

Two full days of buffer before opening day.

---

## What I deliberately won't build

For Memorial Day, we focus on the core: validate members at the gate, give staff a dashboard, log every check-in. Out of scope:

- ❌ Mirroring all member data into AWS (GHL stays source of truth)
- ❌ Standalone guests (assumes every guest comes with a member)
- ❌ Multi-club admin panel
- ❌ SMS to members (email instead, because GHL phone isn't connected)
- ❌ Advanced analytics

All of these are valid Phase 2 work once Wedgewood is running smoothly.

---

## Bottom line

Memorial Day is reachable. You've done most of the GHL work already. I add a small AWS service and a dashboard, you add 4 workflow actions, and Wedgewood opens the season with a real check-in system. Two days of buffer before launch.

Just need your three answers and we're off.
