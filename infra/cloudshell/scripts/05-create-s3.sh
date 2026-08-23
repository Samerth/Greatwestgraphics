#!/usr/bin/env bash
set -Eeuo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/common.sh"

require_state ACCOUNT_ID
require_command aws
require_command jq

BUCKET="${NAME_PREFIX}-uploads-${ACCOUNT_ID}"
if aws s3api head-bucket --bucket "$BUCKET" >/dev/null 2>&1; then
  echo "S3 bucket already exists: $BUCKET"
else
  aws s3api create-bucket --bucket "$BUCKET" --region "$AWS_REGION" \
    --create-bucket-configuration LocationConstraint="$AWS_REGION" >/dev/null
  echo "Created S3 bucket $BUCKET"
fi

aws s3api put-public-access-block --bucket "$BUCKET" --public-access-block-configuration \
  BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
aws s3api put-bucket-encryption --bucket "$BUCKET" --server-side-encryption-configuration \
  '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"},"BucketKeyEnabled":true}]}'
aws s3api put-bucket-versioning --bucket "$BUCKET" --versioning-configuration Status=Enabled
aws s3api put-bucket-tagging --bucket "$BUCKET" --tagging \
  "TagSet=[{Key=Project,Value=$PROJECT},{Key=Environment,Value=$ENVIRONMENT}]"

SITE_ORIGIN="http://localhost:3000"
if [[ -n "${SITE_HOSTNAME:-}" ]]; then
  SITE_ORIGIN="https://$SITE_HOSTNAME"
fi
CORS="$(jq -nc --arg origin "$SITE_ORIGIN" \
  '{CORSRules:[{AllowedHeaders:["*"],AllowedMethods:["GET","PUT","POST","HEAD"],AllowedOrigins:[$origin,"http://localhost:3000"],ExposeHeaders:["ETag"],MaxAgeSeconds:3000}]}')"
aws s3api put-bucket-cors --bucket "$BUCKET" --cors-configuration "$CORS"

save_state AWS_S3_BUCKET "$BUCKET"
echo "S3 uploads bucket: $BUCKET"
echo "Block Public Access: on"
echo "Versioning: on"
echo "CORS origin: $SITE_ORIGIN"
echo "Objects are private; the web task IAM role will PutObject/GetObject on designs/* and store-logos/*"
