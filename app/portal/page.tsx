import { redirect } from "next/navigation";

// The portal nav, the sign-in flow and the notification emails all point people
// at a specific view, so /portal itself was only ever reached by trimming a URL
// or guessing -- and it answered 404. Jobs is the portal's primary view, so send
// them there rather than adding a dashboard that repeats it.
export default function PortalIndexPage() {
  redirect("/portal/jobs");
}
