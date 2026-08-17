#!/usr/bin/env bash
# Put TLS in front of the ALB using an ACM certificate.
#
# DNS for greatwestgraphics.com lives at Microsoft and carries the live site
# plus Microsoft 365 mail, so nothing here touches Route 53 or the apex. ACM
# validates over DNS with a CNAME and an ALB can be reached by CNAME, so a
# subdomain is delegated by adding two records at the existing DNS host and the
# rest of the zone is left alone.
#
# Run it twice. The first run requests the certificate and prints the records to
# add; the second, once those records resolve, attaches the listener. Safe to
# re-run at any point.
set -Eeuo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/common.sh"

require_command aws
require_command jq

if [[ -z "${SITE_HOSTNAME:-}" ]]; then
  cat >&2 <<'EOF'
SITE_HOSTNAME must be set in config.env first, for example:

  SITE_HOSTNAME=staging.greatwestgraphics.com

Do not use the apex or www: those serve the current live site.
EOF
  exit 1
fi

# API_HOSTNAME used to be required here, because the API was published on the
# same public balancer and needed its own name on 443. It is now served by an
# internal balancer with no public address, so giving it a public hostname would
# put it back on the internet — the exposure that move was meant to end. The
# variable is refused rather than ignored, so an environment still carrying it
# from the old topology says so instead of quietly doing nothing.
if [[ -n "${API_HOSTNAME:-}" ]]; then
  cat >&2 <<'EOF'
API_HOSTNAME is set, but the commerce API is no longer published publicly.
Nothing in a browser calls it: the Next.js server is its only client, and it
reaches the API over the internal load balancer created by 09-create-ecs.sh.
Remove API_HOSTNAME from config.env and re-run.

If you genuinely need a public API endpoint, that is a deliberate decision to
make on its own, not a side effect of issuing the storefront certificate.
EOF
  exit 1
fi

case "$SITE_HOSTNAME" in
  greatwestgraphics.com | www.greatwestgraphics.com)
    echo "Refusing to issue for $SITE_HOSTNAME: that name serves the live site." >&2
    exit 1
    ;;
esac

require_state ALB_ARN ALB_SG_ID ALB_DNS WEB_TG_ARN WEB_LISTENER_ARN

echo "Site: $SITE_HOSTNAME"
echo "ALB:  $ALB_DNS"

# 1. Certificate ------------------------------------------------------------
if [[ -z "${CERT_ARN:-}" ]]; then
  echo
  echo "Requesting an ACM certificate covering both names"
  CERT_ARN="$(aws acm request-certificate \
    --domain-name "$SITE_HOSTNAME" \
    --validation-method DNS \
    --tags Key=Project,Value="$PROJECT" Key=Environment,Value="$ENVIRONMENT" \
    --query CertificateArn --output text)"
  save_state CERT_ARN "$CERT_ARN"
  # The validation records are not attached to the certificate immediately.
  for _ in 1 2 3 4 5 6; do
    sleep 5
    if aws acm describe-certificate --certificate-arn "$CERT_ARN" \
      --query 'Certificate.DomainValidationOptions[0].ResourceRecord.Name' \
      --output text 2>/dev/null | grep -q .; then
      break
    fi
  done
fi

cert="$(aws acm describe-certificate --certificate-arn "$CERT_ARN")"
CERT_STATUS="$(jq -r '.Certificate.Status' <<<"$cert")"
echo "Certificate: $CERT_ARN"
echo "Status:      $CERT_STATUS"

if [[ "$CERT_STATUS" != "ISSUED" ]]; then
  echo
  echo "Add these CNAME records at your DNS host (Microsoft), then re-run this script."
  echo
  echo "  Validation records — ACM will not issue until these resolve:"
  # ACM attaches ResourceRecord a moment after the request, so say so plainly
  # rather than printing a null name that looks like a record.
  jq -r '.Certificate.DomainValidationOptions[]
         | if .ResourceRecord then
             "    \(.DomainName)\n      name : \(.ResourceRecord.Name)\n      value: \(.ResourceRecord.Value)\n"
           else
             "    \(.DomainName)\n      (record not published yet — re-run in a minute)\n"
           end' <<<"$cert"
  cat <<EOF
  Host record — this points the subdomain at the load balancer:
    name : $SITE_HOSTNAME
      value: $ALB_DNS

Both are CNAMEs. Validation usually completes within minutes of the records
resolving, but DNS propagation can take longer. Check progress with:

  dig +short CNAME $SITE_HOSTNAME
  aws acm describe-certificate --certificate-arn $CERT_ARN \\
    --query 'Certificate.Status' --output text

Nothing on the load balancer has changed yet, so the current HTTP URLs keep
working while you wait.
EOF
  exit 0
fi

# 2. Listener ---------------------------------------------------------------
echo
echo "Certificate is issued. Attaching HTTPS to the load balancer."

authorize_sg_ingress "$ALB_SG_ID" tcp 443 443 cidr 0.0.0.0/0 "HTTPS storefront"

if [[ -z "${HTTPS_LISTENER_ARN:-}" ]]; then
  HTTPS_LISTENER_ARN="$(aws elbv2 create-listener \
    --load-balancer-arn "$ALB_ARN" --protocol HTTPS --port 443 \
    --certificates "CertificateArn=$CERT_ARN" \
    --ssl-policy ELBSecurityPolicy-TLS13-1-2-2021-06 \
    --default-actions "Type=forward,TargetGroupArn=$WEB_TG_ARN" \
    --query 'Listeners[0].ListenerArn' --output text)"
  save_state HTTPS_LISTENER_ARN "$HTTPS_LISTENER_ARN"
  echo "  created HTTPS listener on 443"
else
  aws elbv2 modify-listener --listener-arn "$HTTPS_LISTENER_ARN" \
    --certificates "CertificateArn=$CERT_ARN" \
    --ssl-policy ELBSecurityPolicy-TLS13-1-2-2021-06 \
    --default-actions "Type=forward,TargetGroupArn=$WEB_TG_ARN" >/dev/null
  echo "  updated existing HTTPS listener"
fi

# There is deliberately no host rule forwarding an API name to the API target
# group. That rule used to live here, and it cannot come back: a target group
# belongs to exactly one load balancer, and the API's now belongs to the
# internal one, so this listener has nothing to forward to even if we wanted it.

# 3. Redirect plain HTTP ----------------------------------------------------
aws elbv2 modify-listener --listener-arn "$WEB_LISTENER_ARN" \
  --default-actions \
  'Type=redirect,RedirectConfig={Protocol=HTTPS,Port=443,StatusCode=HTTP_301}' >/dev/null
echo "  port 80 now redirects to HTTPS"

cat <<EOF

HTTPS is live:
  https://$SITE_HOSTNAME

The commerce API has no public URL. It answers on the internal load balancer
only, which is why there is no api.* name to certify here.

Remaining steps, in order:

  1. ./scripts/09-create-ecs.sh
     Re-registers the tasks so the app's own URLs use https instead of the ALB
     hostname. Until this runs, links and callbacks still point at http.
  2. ./scripts/05-create-s3.sh
     Updates the bucket CORS origin to https://$SITE_HOSTNAME.
EOF

# 4. Legacy plaintext API port ----------------------------------------------
# This used to be a manual last step, deferred until sign-in was confirmed
# because the web container still talked to the API over port 4000. Closing the
# port is no longer optional or separate: 09-create-ecs.sh moves the listener to
# the internal balancer and revokes the public rule in the same run that
# re-points the web container, so there is no window where one has happened and
# the other has not.
if [[ "${CLOSE_LEGACY_API_PORT:-false}" == "true" ]]; then
  cat <<'EOF'

CLOSE_LEGACY_API_PORT is no longer needed and has been ignored. Port 4000 is
closed to the internet by 09-create-ecs.sh. Honouring it here would delete the
internal listener the web tier depends on, which is the opposite of what the
flag was for. Drop it from your command.
EOF
fi
