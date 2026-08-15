#!/usr/bin/env bash
# Serve the site over HTTPS without owning a domain.
#
# An ACM certificate cannot be issued for the load balancer's own
# *.elb.amazonaws.com name, so TLS on the ALB needs a domain, and this domain's
# DNS is managed outside AWS. CloudFront sidesteps both: every distribution gets
# a *.cloudfront.net name with a certificate already attached, so HTTPS works
# with no DNS records and nothing to renew.
#
# The browser only ever talks to the Next.js container -- calls to the commerce
# API go through /api/commerce/* server-side -- so one distribution in front of
# port 80 covers the whole site with no mixed content.
set -Eeuo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/common.sh"

require_command aws
require_command jq

require_state ALB_DNS

# Caching is described inline rather than through AWS's managed policies. Those
# are referenced by ID, the IDs are not contractual, and looking them up by name
# returned nothing here, so two attempts failed on a dependency that buys
# nothing: the behaviour below is the same one the managed policies express.
#
# Forwarding every header, cookie and query string with zero TTLs disables
# caching for application responses, which is required for sign-in and server
# actions to work. Static assets are handled by a separate behaviour further
# down, since those are safe to cache and are the bulk of the bytes.
echo "Origin: $ALB_DNS"

if [[ -z "${CF_DISTRIBUTION_ID:-}" ]]; then
  CONFIG="$(jq -nc \
    --arg ref "gwg-$(date +%s)" \
    --arg origin "$ALB_DNS" \
    --arg comment "$NAME_PREFIX storefront" \
    '{
      CallerReference: $ref,
      Comment: $comment,
      Enabled: true,
      PriceClass: "PriceClass_100",
      Origins: {Quantity: 1, Items: [{
        Id: "alb",
        DomainName: $origin,
        CustomOriginConfig: {
          HTTPPort: 80,
          HTTPSPort: 443,
          OriginProtocolPolicy: "http-only",
          OriginSslProtocols: {Quantity: 1, Items: ["TLSv1.2"]},
          OriginReadTimeout: 60,
          OriginKeepaliveTimeout: 5
        }
      }]},
      DefaultCacheBehavior: {
        TargetOriginId: "alb",
        ViewerProtocolPolicy: "redirect-to-https",
        AllowedMethods: {
          Quantity: 7,
          Items: ["GET","HEAD","OPTIONS","PUT","POST","PATCH","DELETE"],
          CachedMethods: {Quantity: 2, Items: ["GET","HEAD"]}
        },
        Compress: true,
        ForwardedValues: {
          QueryString: true,
          Cookies: {Forward: "all"},
          Headers: {Quantity: 1, Items: ["*"]}
        },
        MinTTL: 0,
        DefaultTTL: 0,
        MaxTTL: 0,
        TrustedSigners: {Enabled: false, Quantity: 0}
      },
      CacheBehaviors: {Quantity: 1, Items: [{
        PathPattern: "/_next/static/*",
        TargetOriginId: "alb",
        ViewerProtocolPolicy: "redirect-to-https",
        AllowedMethods: {
          Quantity: 2,
          Items: ["GET","HEAD"],
          CachedMethods: {Quantity: 2, Items: ["GET","HEAD"]}
        },
        Compress: true,
        ForwardedValues: {
          QueryString: false,
          Cookies: {Forward: "none"},
          Headers: {Quantity: 0}
        },
        MinTTL: 0,
        DefaultTTL: 86400,
        MaxTTL: 31536000,
        TrustedSigners: {Enabled: false, Quantity: 0}
      }]},
      ViewerCertificate: {CloudFrontDefaultCertificate: true}
    }')"

  echo "Creating distribution"
  created="$(aws cloudfront create-distribution --distribution-config "$CONFIG")"
  CF_DISTRIBUTION_ID="$(jq -r '.Distribution.Id' <<<"$created")"
  CF_DOMAIN="$(jq -r '.Distribution.DomainName' <<<"$created")"
  save_state CF_DISTRIBUTION_ID "$CF_DISTRIBUTION_ID"
  save_state CF_DOMAIN "$CF_DOMAIN"
else
  CF_DOMAIN="$(aws cloudfront get-distribution --id "$CF_DISTRIBUTION_ID" \
    --query 'Distribution.DomainName' --output text)"
  save_state CF_DOMAIN "$CF_DOMAIN"
  echo "Reusing distribution $CF_DISTRIBUTION_ID"
fi

echo "Distribution: $CF_DISTRIBUTION_ID"
echo "URL:          https://$CF_DOMAIN"

echo
echo "Waiting for the distribution to deploy to the edge (usually a few minutes)"
if aws cloudfront wait distribution-deployed --id "$CF_DISTRIBUTION_ID" 2>/dev/null; then
  echo "Deployed."
else
  echo "Still deploying. Check with:"
  echo "  aws cloudfront get-distribution --id $CF_DISTRIBUTION_ID --query 'Distribution.Status' --output text"
fi

cat <<EOF

HTTPS is live at:
  https://$CF_DOMAIN

The app still advertises its old URL until its environment is updated. Point it
at CloudFront and re-run the two scripts that consume the site origin:

  sed -i 's|^SITE_HOSTNAME=.*|SITE_HOSTNAME=$CF_DOMAIN|' config.env
  sed -i 's|^API_HOSTNAME=.*|API_HOSTNAME=|' config.env
  ./scripts/05-create-s3.sh    # S3 CORS origin becomes https://$CF_DOMAIN
  ./scripts/09-create-ecs.sh   # NEXT_PUBLIC_SITE_URL becomes https://$CF_DOMAIN

API_HOSTNAME is cleared deliberately. The browser never calls the commerce API
directly, so it stays on the internal ALB address and is not published.

Two limits worth knowing. Traffic between CloudFront and the ALB is plain HTTP;
it is inside AWS, but put a certificate on the ALB before handling real card or
credential data. And the ALB remains reachable over HTTP on its own hostname,
so CloudFront is a front door rather than a lock -- restrict the ALB to
CloudFront when this stops being a staging system.
EOF
