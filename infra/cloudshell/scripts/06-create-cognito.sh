#!/usr/bin/env bash
set -Eeuo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/common.sh"

require_state ACCOUNT_ID
require_command aws
require_command jq

POOL_NAME="$NAME_PREFIX-customers"
CLIENT_NAME="$NAME_PREFIX-web"
SECRET_NAME="$NAME_PREFIX/cognito"

if [[ -z "${COGNITO_USER_POOL_ID:-}" ]]; then
  existing="$(aws cognito-idp list-user-pools --max-results 60 \
    --query "UserPools[?Name=='$POOL_NAME'].Id" --output text)"
  if [[ -n "$existing" && "$existing" != "None" ]]; then
    COGNITO_USER_POOL_ID="$(awk '{print $1}' <<< "$existing")"
  fi
fi

if [[ -z "${COGNITO_USER_POOL_ID:-}" ]]; then
  POLICIES="$(jq -nc '{
    PasswordPolicy: {
      MinimumLength: 8,
      RequireUppercase: true,
      RequireLowercase: true,
      RequireNumbers: true,
      RequireSymbols: false,
      TemporaryPasswordValidityDays: 7
    },
    SignInPolicy: { AllowedFirstAuthFactors: ["PASSWORD", "EMAIL_OTP"] }
  }')"
  SCHEMA="$(jq -nc '[{Name:"name",AttributeDataType:"String",Mutable:true,Required:true}]')"
  create_err="$(mktemp)"
  if COGNITO_USER_POOL_ID="$(aws cognito-idp create-user-pool \
    --pool-name "$POOL_NAME" \
    --user-pool-tier ESSENTIALS \
    --username-attributes email \
    --auto-verified-attributes email \
    --policies "$POLICIES" \
    --schema "$SCHEMA" \
    --account-recovery-setting "RecoveryMechanisms=[{Priority=1,Name=verified_email}]" \
    --query 'UserPool.Id' --output text 2>"$create_err")"; then
    rm -f "$create_err"
  else
    echo "create-user-pool with SignInPolicy/ESSENTIALS failed; retrying a compatible subset."
    cat "$create_err" >&2
    COGNITO_USER_POOL_ID="$(aws cognito-idp create-user-pool \
      --pool-name "$POOL_NAME" \
      --username-attributes email \
      --auto-verified-attributes email \
      --schema "$SCHEMA" \
      --account-recovery-setting "RecoveryMechanisms=[{Priority=1,Name=verified_email}]" \
      --query 'UserPool.Id' --output text)"
    echo "Open the Cognito console and enable USER_AUTH first factors: PASSWORD and EMAIL_OTP."
    echo "The Next.js app in lib/auth/cognito.ts requires AuthFlow=USER_AUTH."
  fi
fi
save_state COGNITO_USER_POOL_ID "$COGNITO_USER_POOL_ID"

if [[ -z "${COGNITO_APP_CLIENT_ID:-}" ]]; then
  existing_client="$(aws cognito-idp list-user-pool-clients --user-pool-id "$COGNITO_USER_POOL_ID" \
    --query "UserPoolClients[?ClientName=='$CLIENT_NAME'].ClientId" --output text)"
  if [[ -n "$existing_client" && "$existing_client" != "None" ]]; then
    COGNITO_APP_CLIENT_ID="$(awk '{print $1}' <<< "$existing_client")"
  else
    client_err="$(mktemp)"
    if CLIENT_JSON="$(aws cognito-idp create-user-pool-client \
      --user-pool-id "$COGNITO_USER_POOL_ID" \
      --client-name "$CLIENT_NAME" \
      --generate-secret \
      --explicit-auth-flows ALLOW_USER_AUTH ALLOW_REFRESH_TOKEN_AUTH \
      --prevent-user-existence-errors ENABLED \
      --enable-token-revocation \
      --output json 2>"$client_err")"; then
      COGNITO_APP_CLIENT_ID="$(jq -r '.UserPoolClient.ClientId' <<< "$CLIENT_JSON")"
      COGNITO_APP_CLIENT_SECRET="$(jq -r '.UserPoolClient.ClientSecret' <<< "$CLIENT_JSON")"
    else
      echo "ALLOW_USER_AUTH was rejected; creating a confidential client with password flows."
      cat "$client_err" >&2
      CLIENT_JSON="$(aws cognito-idp create-user-pool-client \
        --user-pool-id "$COGNITO_USER_POOL_ID" \
        --client-name "$CLIENT_NAME" \
        --generate-secret \
        --explicit-auth-flows ALLOW_USER_PASSWORD_AUTH ALLOW_REFRESH_TOKEN_AUTH \
        --prevent-user-existence-errors ENABLED \
        --enable-token-revocation \
        --output json)"
      COGNITO_APP_CLIENT_ID="$(jq -r '.UserPoolClient.ClientId' <<< "$CLIENT_JSON")"
      COGNITO_APP_CLIENT_SECRET="$(jq -r '.UserPoolClient.ClientSecret' <<< "$CLIENT_JSON")"
      echo "Enable ALLOW_USER_AUTH on this app client after the pool is on Essentials."
    fi
    rm -f "$client_err"
  fi
fi
save_state COGNITO_APP_CLIENT_ID "$COGNITO_APP_CLIENT_ID"

if [[ -n "${COGNITO_APP_CLIENT_SECRET:-}" ]]; then
  SECRET_STRING="$(jq -nc \
    --arg region "$AWS_REGION" \
    --arg pool "$COGNITO_USER_POOL_ID" \
    --arg client "$COGNITO_APP_CLIENT_ID" \
    --arg secret "$COGNITO_APP_CLIENT_SECRET" \
    '{COGNITO_REGION:$region,COGNITO_USER_POOL_ID:$pool,COGNITO_APP_CLIENT_ID:$client,COGNITO_APP_CLIENT_SECRET:$secret}')"
  if aws secretsmanager describe-secret --secret-id "$SECRET_NAME" >/dev/null 2>&1; then
    aws secretsmanager put-secret-value --secret-id "$SECRET_NAME" --secret-string "$SECRET_STRING" >/dev/null
  else
    aws secretsmanager create-secret --name "$SECRET_NAME" --secret-string "$SECRET_STRING" \
      --tags Key=Project,Value="$PROJECT" Key=Environment,Value="$ENVIRONMENT" >/dev/null
  fi
  unset COGNITO_APP_CLIENT_SECRET SECRET_STRING
fi

COGNITO_SECRET_ARN="$(aws secretsmanager describe-secret --secret-id "$SECRET_NAME" --query ARN --output text)"
save_state COGNITO_SECRET_ARN "$COGNITO_SECRET_ARN"

echo "Cognito user pool:  $COGNITO_USER_POOL_ID"
echo "App client id:      $COGNITO_APP_CLIENT_ID"
echo "Client secret:      stored in $SECRET_NAME (not printed)"
echo "Region:             $AWS_REGION"
echo "The app client is confidential (SECRET_HASH required), matching lib/auth/cognito.ts"
