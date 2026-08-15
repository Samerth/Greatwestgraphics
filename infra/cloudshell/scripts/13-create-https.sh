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

if [[ -z "${SITE_HOSTNAME:-}" || -z "${API_HOSTNAME:-}" ]]; then
  cat >&2 <<'EOF'
SITE_HOSTNAME and API_HOSTNAME must be set in config.env first, for example:

  SITE_HOSTNAME=staging.greatwestgraphics.com
  API_HOSTNAME=api.staging.greatwestgraphics.com

Do not use the apex or www: those serve the current live site.
EOF
  exit 1
fi

case "$SITE_HOSTNAME" in
  greatwestgraphics.com | www.greatwestgraphics.com)
    echo "Refusing to issue for $SITE_HOSTNAME: that name serves the live site." >&2
    exit 1
    ;;
esac

require_state ALB_ARN ALB_SG_ID ALB_DNS WEB_TG_ARN API_TG_ARN WEB_LISTENER_ARN

echo "Site: $SITE_HOSTNAME"
echo "API:  $API_HOSTNAME"
echo "ALB:  $ALB_DNS"

# 1. Certificate ------------------------------------------------------------
if [[ -z "${CERT_ARN:-}" ]]; then
  echo
  echo "Requesting an ACM certificate covering both names"
  CERT_ARN="$(aws acm request-certificate \
    --domain-name "$SITE_HOSTNAME" \
    --subject-alternative-names "$API_HOSTNAME" \
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
  Host records — these point the subdomains at the load balancer:
    name : $SITE_HOSTNAME
      value: $ALB_DNS
    name : $API_HOSTNAME
      value: $ALB_DNS

All four are CNAMEs. Validation usually completes within minutes of the records
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

# Port 80 sends everything to the web container, so the API needs its own name
# on 443 rather than a path prefix.
if aws elbv2 describe-rules --listener-arn "$HTTPS_LISTENER_ARN" \
  --query 'Rules[].Conditions[].HostHeaderConfig.Values[]' --output text 2>/dev/null \
  | grep -qx "$API_HOSTNAME"; then
  echo "  host rule for $API_HOSTNAME already present"
else
  aws elbv2 create-rule --listener-arn "$HTTPS_LISTENER_ARN" --priority 10 \
    --conditions "Field=host-header,HostHeaderConfig={Values=[$API_HOSTNAME]}" \
    --actions "Type=forward,TargetGroupArn=$API_TG_ARN" >/dev/null
  echo "  routed $API_HOSTNAME to the API target group"
fi

# 3. Redirect plain HTTP ----------------------------------------------------
aws elbv2 modify-listener --listener-arn "$WEB_LISTENER_ARN" \
  --default-actions \
  'Type=redirect,RedirectConfig={Protocol=HTTPS,Port=443,StatusCode=HTTP_301}' >/dev/null
echo "  port 80 now redirects to HTTPS"

cat <<EOF

HTTPS is live:
  https://$SITE_HOSTNAME
  https://$API_HOSTNAME

Remaining steps, in order:

  1. ./scripts/09-create-ecs.sh
     Re-registers the tasks so the app's own URLs use https instead of the ALB
     hostname. Until this runs, links and callbacks still point at http.
  2. ./scripts/05-create-s3.sh
     Updates the bucket CORS origin to https://$SITE_HOSTNAME.
  3. Confirm sign-in works, then close the plaintext API port:
       CLOSE_LEGACY_API_PORT=true ./scripts/13-create-https.sh
     Port 4000 is still open and unencrypted until you do. It is left until last
     because the web container talks to the API over that port until step 1
     re-points it at https://$API_HOSTNAME.
EOF

# 4. Optional teardown of the plaintext API port ----------------------------
if [[ "${CLOSE_LEGACY_API_PORT:-false}" == "true" ]]; then
  echo
  echo "Closing plaintext API port 4000"
  if [[ -n "${API_LISTENER_ARN:-}" ]]; then
    aws elbv2 delete-listener --listener-arn "$API_LISTENER_ARN" >/dev/null 2>&1 \
      && echo "  deleted the port 4000 listener" \
      || echo "  listener already gone"
  fi
  aws ec2 revoke-security-group-ingress --group-id "$ALB_SG_ID" \
    --ip-permissions '[{"IpProtocol":"tcp","FromPort":4000,"ToPort":4000,"IpRanges":[{"CidrIp":"0.0.0.0/0"}]}]' \
    >/dev/null 2>&1 && echo "  revoked 0.0.0.0/0 on 4000" || echo "  ingress rule already gone"
  echo "  the API is now reachable only as https://$API_HOSTNAME"
fi
