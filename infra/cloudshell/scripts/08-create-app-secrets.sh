#!/usr/bin/env bash
set -Eeuo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/common.sh"

require_state ACCOUNT_ID DB_SECRET_ARN RDS_ENDPOINT AWS_S3_BUCKET COGNITO_USER_POOL_ID COGNITO_APP_CLIENT_ID COGNITO_SECRET_ARN
require_command aws
require_command jq
require_command python3

WEB_SECRET_NAME="$NAME_PREFIX/web"
API_SECRET_NAME="$NAME_PREFIX/api"

COGNITO_JSON="$(aws secretsmanager get-secret-value --secret-id "$COGNITO_SECRET_ARN" --query SecretString --output text)"
COGNITO_APP_CLIENT_SECRET="$(jq -r .COGNITO_APP_CLIENT_SECRET <<< "$COGNITO_JSON")"

DATABASE_URL="$(rds_database_url)"

if aws secretsmanager describe-secret --secret-id "$WEB_SECRET_NAME" >/dev/null 2>&1; then
  echo "Web secret $WEB_SECRET_NAME already exists; not rotating passwords."
else
  STAFF_ADMIN_PASSWORD="$(python3 -c 'import secrets; print(secrets.token_urlsafe(18))')"
  STAFF_SESSION_SECRET="$(python3 -c 'import secrets; print(secrets.token_urlsafe(48))')"
  CUSTOMER_SESSION_SECRET="$(python3 -c 'import secrets; print(secrets.token_urlsafe(48))')"
  WEB_JSON="$(jq -nc \
    --arg user "$STAFF_ADMIN_USER" \
    --arg password "$STAFF_ADMIN_PASSWORD" \
    --arg staff_session "$STAFF_SESSION_SECRET" \
    --arg customer_session "$CUSTOMER_SESSION_SECRET" \
    --arg region "$AWS_REGION" \
    --arg pool "$COGNITO_USER_POOL_ID" \
    --arg client "$COGNITO_APP_CLIENT_ID" \
    --arg cognito_secret "$COGNITO_APP_CLIENT_SECRET" \
    --arg bucket "$AWS_S3_BUCKET" \
    --arg from "$CONTACT_FROM_EMAIL" \
    --arg to "$CONTACT_TO_EMAIL" \
    '{
      STAFF_ADMIN_USER:$user,
      STAFF_ADMIN_PASSWORD:$password,
      STAFF_SESSION_SECRET:$staff_session,
      CUSTOMER_SESSION_SECRET:$customer_session,
      COGNITO_REGION:$region,
      COGNITO_USER_POOL_ID:$pool,
      COGNITO_APP_CLIENT_ID:$client,
      COGNITO_APP_CLIENT_SECRET:$cognito_secret,
      AWS_S3_BUCKET:$bucket,
      AWS_REGION:$region,
      CONTACT_FROM_EMAIL:$from,
      CONTACT_TO_EMAIL:$to,
      RESEND_API_KEY:""
    }')"
  aws secretsmanager create-secret --name "$WEB_SECRET_NAME" --secret-string "$WEB_JSON" \
    --tags Key=Project,Value="$PROJECT" Key=Environment,Value="$ENVIRONMENT" >/dev/null
  unset STAFF_ADMIN_PASSWORD STAFF_SESSION_SECRET CUSTOMER_SESSION_SECRET WEB_JSON
fi

if aws secretsmanager describe-secret --secret-id "$API_SECRET_NAME" >/dev/null 2>&1; then
  echo "API secret $API_SECRET_NAME already exists; not rotating DATABASE_URL."
else
  API_JSON="$(jq -nc --arg url "$DATABASE_URL" \
    '{DATABASE_URL:$url,SS_ACCOUNT_NUMBER:"",SS_API_KEY:"",SANMAR_ACCOUNT_ID:"",SANMAR_LOGIN_EMAIL:""}')"
  aws secretsmanager create-secret --name "$API_SECRET_NAME" --secret-string "$API_JSON" \
    --tags Key=Project,Value="$PROJECT" Key=Environment,Value="$ENVIRONMENT" >/dev/null
  unset API_JSON
fi
unset DATABASE_URL COGNITO_APP_CLIENT_SECRET COGNITO_JSON

WEB_SECRET_ARN="$(aws secretsmanager describe-secret --secret-id "$WEB_SECRET_NAME" --query ARN --output text)"
API_SECRET_ARN="$(aws secretsmanager describe-secret --secret-id "$API_SECRET_NAME" --query ARN --output text)"
save_state WEB_SECRET_ARN "$WEB_SECRET_ARN"
save_state API_SECRET_ARN "$API_SECRET_ARN"

echo "Created/reused application secrets:"
echo "  $WEB_SECRET_NAME  (staff password + session + Cognito client secret)"
echo "  $API_SECRET_NAME  (DATABASE_URL + empty vendor placeholders)"
echo "Retrieve the staff password only in a trusted CloudShell session:"
echo "  aws secretsmanager get-secret-value --secret-id $WEB_SECRET_NAME --query SecretString --output text | jq -r .STAFF_ADMIN_PASSWORD"
echo "Put RESEND_API_KEY / SS_* / SANMAR_* into those JSON secrets when you have them."
