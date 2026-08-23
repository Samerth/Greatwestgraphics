#!/usr/bin/env bash
set -Eeuo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/common.sh"

require_state ACCOUNT_ID VPC_ID PUBLIC_SUBNET_1_ID PUBLIC_SUBNET_2_ID DB_SG_ID \
  WEB_ECR_URI API_ECR_URI WEB_SECRET_ARN API_SECRET_ARN AWS_S3_BUCKET
require_command aws
require_command jq

# Every value below is optional so a bare environment still provisions, but each
# one that is missing removes a capability rather than failing loudly. They come
# from config.env (or the per-environment config named by CONFIG_FILE) and from
# state written by the earlier scripts.
CONTACT_TO_EMAIL="${CONTACT_TO_EMAIL:-info@greatwestgraphics.com}"

# Which build to run. `latest` only ever moves on a push to main, so staging
# would always have tracked main and there was no way to exercise a branch
# before merging it. Setting IMAGE_TAG to a commit SHA deploys that exact build,
# which is how a change should be tried on staging first.
IMAGE_TAG="${IMAGE_TAG:-latest}"

if ! aws iam get-role --role-name AWSServiceRoleForECS >/dev/null 2>&1; then
  echo "Creating ECS service-linked role (required once per account)..."
  aws iam create-service-linked-role --aws-service-name ecs.amazonaws.com >/dev/null
  sleep 10
fi

LOG_WEB="/ecs/$NAME_PREFIX-web"
LOG_API="/ecs/$NAME_PREFIX-api"
aws logs create-log-group --log-group-name "$LOG_WEB" >/dev/null 2>&1 || true
aws logs create-log-group --log-group-name "$LOG_API" >/dev/null 2>&1 || true

if [[ -z "${ALB_SG_ID:-}" ]]; then
  ALB_SG_ID="$(aws ec2 create-security-group --vpc-id "$VPC_ID" \
    --group-name "$NAME_PREFIX-alb" --description "GWG public ALB" \
    --tag-specifications "ResourceType=security-group,Tags=[{Key=Name,Value=$NAME_PREFIX-alb},{Key=Project,Value=$PROJECT}]" \
    --query GroupId --output text)"
  save_state ALB_SG_ID "$ALB_SG_ID"
fi
authorize_sg_ingress "$ALB_SG_ID" tcp 80 80 cidr 0.0.0.0/0 "HTTP storefront"
# Port 4000 used to be published here, which put the commerce API on the public
# internet over plain HTTP. Nothing in a browser calls the API — the Next.js
# server is the only client — so the listener existed purely for smoke tests,
# and the price of that convenience was COMMERCE_SERVICE_TOKEN crossing the
# internet in cleartext on every server-rendered page. The API now answers on
# the internal load balancer below instead. The revoke matters as much as the
# missing authorize: environments built before this change still carry the open
# rule, and only an explicit revoke closes it.
revoke_sg_ingress "$ALB_SG_ID" tcp 4000 4000 cidr 0.0.0.0/0

if [[ -z "${WEB_SG_ID:-}" ]]; then
  WEB_SG_ID="$(aws ec2 create-security-group --vpc-id "$VPC_ID" \
    --group-name "$NAME_PREFIX-web" --description "GWG Next.js tasks" \
    --tag-specifications "ResourceType=security-group,Tags=[{Key=Name,Value=$NAME_PREFIX-web},{Key=Project,Value=$PROJECT}]" \
    --query GroupId --output text)"
  save_state WEB_SG_ID "$WEB_SG_ID"
fi
authorize_sg_ingress "$WEB_SG_ID" tcp 3000 3000 sg "$ALB_SG_ID" "ALB to web"

# A second, internal load balancer for the API.
#
# The scheme of a load balancer is fixed when it is created, so the public one
# above cannot simply be made private. Splitting them is what allows the API to
# keep a stable DNS name for the web tier while never resolving to a public
# address. It also makes the security group reference below actually work: a web
# task talking to an internet-facing balancer reaches it by public IP and
# arrives looking like any other internet client, so the ALB sees an internet
# source rather than WEB_SG_ID and a group-to-group rule silently matches
# nothing. Against an internal balancer the traffic stays on private addresses
# and the reference holds.
if [[ -z "${API_ALB_SG_ID:-}" ]]; then
  API_ALB_SG_ID="$(aws ec2 create-security-group --vpc-id "$VPC_ID" \
    --group-name "$NAME_PREFIX-api-alb" --description "GWG internal API ALB" \
    --tag-specifications "ResourceType=security-group,Tags=[{Key=Name,Value=$NAME_PREFIX-api-alb},{Key=Project,Value=$PROJECT}]" \
    --query GroupId --output text)"
  save_state API_ALB_SG_ID "$API_ALB_SG_ID"
fi
authorize_sg_ingress "$API_ALB_SG_ID" tcp 4000 4000 sg "$WEB_SG_ID" "web to internal API ALB"

if [[ -z "${API_SG_ID:-}" ]]; then
  API_SG_ID="$(aws ec2 create-security-group --vpc-id "$VPC_ID" \
    --group-name "$NAME_PREFIX-api" --description "GWG commerce-api tasks" \
    --tag-specifications "ResourceType=security-group,Tags=[{Key=Name,Value=$NAME_PREFIX-api},{Key=Project,Value=$PROJECT}]" \
    --query GroupId --output text)"
  save_state API_SG_ID "$API_SG_ID"
fi
authorize_sg_ingress "$API_SG_ID" tcp 4000 4000 sg "$API_ALB_SG_ID" "internal ALB to api"
authorize_sg_ingress "$API_SG_ID" tcp 4000 4000 sg "$WEB_SG_ID" "web to api"
# The public balancer no longer forwards to the API, so its reach into the API
# tasks is left over from the old topology.
revoke_sg_ingress "$API_SG_ID" tcp 4000 4000 sg "$ALB_SG_ID"
authorize_sg_ingress "$DB_SG_ID" tcp 5432 5432 sg "$API_SG_ID" "api to RDS"

EXEC_ROLE_NAME="$NAME_PREFIX-ecs-execution"
TASK_ROLE_NAME="$NAME_PREFIX-ecs-task"
ASSUME="$(jq -nc '{Version:"2012-10-17",Statement:[{Effect:"Allow",Principal:{Service:"ecs-tasks.amazonaws.com"},Action:"sts:AssumeRole"}]}')"

create_role() {
  local name="$1"
  if ! aws iam get-role --role-name "$name" >/dev/null 2>&1; then
    aws iam create-role --role-name "$name" --assume-role-policy-document "$ASSUME" \
      --tags Key=Project,Value="$PROJECT" Key=Environment,Value="$ENVIRONMENT" >/dev/null
  fi
  aws iam get-role --role-name "$name" --query 'Role.Arn' --output text
}

EXEC_ROLE_ARN="$(create_role "$EXEC_ROLE_NAME")"
TASK_ROLE_ARN="$(create_role "$TASK_ROLE_NAME")"
aws iam attach-role-policy --role-name "$EXEC_ROLE_NAME" \
  --policy-arn arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy >/dev/null 2>&1 || true
# Secrets beyond the two base ones are optional, so an environment that has not
# been given vendor credentials or an email key still provisions. Each one that
# IS set has to appear here: the execution role is scoped to an explicit list,
# and a task referencing a secret missing from it fails to start rather than
# starting degraded.
SECRET_ARNS=("$WEB_SECRET_ARN" "$API_SECRET_ARN")
for optional in SERVICE_TOKEN_SECRET_ARN ADMIN_TOKEN_SECRET_ARN VENDOR_SECRET_ARN EMAIL_SECRET_ARN; do
  value="${!optional:-}"
  [ -n "$value" ] && SECRET_ARNS+=("$value")
done

aws iam put-role-policy --role-name "$EXEC_ROLE_NAME" --policy-name secrets \
  --policy-document "$(jq -nc --args \
    '{Version:"2012-10-17",Statement:[{Effect:"Allow",Action:["secretsmanager:GetSecretValue"],Resource:($ARGS.positional|unique)}]}' \
    "${SECRET_ARNS[@]}")"
aws iam put-role-policy --role-name "$TASK_ROLE_NAME" --policy-name s3-uploads \
  --policy-document "$(jq -nc --arg bucket "$AWS_S3_BUCKET" \
    '{Version:"2012-10-17",Statement:[{Effect:"Allow",Action:["s3:PutObject","s3:GetObject"],Resource:["arn:aws:s3:::\($bucket)/designs/*","arn:aws:s3:::\($bucket)/store-logos/*"]},{Effect:"Allow",Action:["s3:ListBucket"],Resource:"arn:aws:s3:::\($bucket)",Condition:{StringLike:{ "s3:prefix":["designs/*","store-logos/*"]}}}]}')"
save_state ECS_EXEC_ROLE_ARN "$EXEC_ROLE_ARN"
save_state ECS_TASK_ROLE_ARN "$TASK_ROLE_ARN"
# IAM roles are not immediately assumable after create.
sleep 12

if [[ -z "${ALB_ARN:-}" ]]; then
  ALB_ARN="$(aws elbv2 create-load-balancer --name "$NAME_PREFIX-alb" --type application --scheme internet-facing \
    --subnets "$PUBLIC_SUBNET_1_ID" "$PUBLIC_SUBNET_2_ID" --security-groups "$ALB_SG_ID" \
    --tags Key=Project,Value="$PROJECT" Key=Environment,Value="$ENVIRONMENT" \
    --query 'LoadBalancers[0].LoadBalancerArn' --output text)"
  save_state ALB_ARN "$ALB_ARN"
fi
ALB_DNS="$(aws elbv2 describe-load-balancers --load-balancer-arns "$ALB_ARN" --query 'LoadBalancers[0].DNSName' --output text)"
save_state ALB_DNS "$ALB_DNS"

if [[ -z "${API_ALB_ARN:-}" ]]; then
  API_ALB_ARN="$(aws elbv2 create-load-balancer --name "$NAME_PREFIX-api-alb" --type application --scheme internal \
    --subnets "$PUBLIC_SUBNET_1_ID" "$PUBLIC_SUBNET_2_ID" --security-groups "$API_ALB_SG_ID" \
    --tags Key=Project,Value="$PROJECT" Key=Environment,Value="$ENVIRONMENT" \
    --query 'LoadBalancers[0].LoadBalancerArn' --output text)"
  save_state API_ALB_ARN "$API_ALB_ARN"
fi
# The subnets are the same ones the public balancer uses; "internal" is about
# the addresses the balancer answers on, not about which subnet it sits in, so
# this needs no private subnet or NAT gateway to be introduced first.
API_ALB_DNS="$(aws elbv2 describe-load-balancers --load-balancer-arns "$API_ALB_ARN" --query 'LoadBalancers[0].DNSName' --output text)"
save_state API_ALB_DNS "$API_ALB_DNS"

SITE_URL="http://$ALB_DNS"
API_URL="http://$API_ALB_DNS:4000"
if [[ -n "${SITE_HOSTNAME:-}" ]]; then SITE_URL="https://$SITE_HOSTNAME"; fi
# Plain HTTP is acceptable on API_URL only because it never leaves the VPC.
# API_HOSTNAME is deliberately not honoured any more: it used to point the web
# container at a public https://api.* name on the shared balancer, and script 13
# now refuses to create that name at all. Leaving the branch here would let a
# stale config.env quietly send API traffic back out to the internet.
if [[ -n "${API_HOSTNAME:-}" ]]; then
  echo "API_HOSTNAME is set but ignored: the API is internal-only. Remove it from config.env." >&2
fi
save_state SITE_URL "$SITE_URL"
save_state API_URL "$API_URL"

create_tg() {
  local state_key="$1" name="$2" port="$3" path="$4"
  local tg
  tg="$(get_state "$state_key")"
  if [[ -z "$tg" ]]; then
    tg="$(aws elbv2 create-target-group --name "$name" --protocol HTTP --port "$port" --vpc-id "$VPC_ID" \
      --target-type ip --health-check-path "$path" --health-check-interval-seconds 30 \
      --healthy-threshold-count 2 --unhealthy-threshold-count 3 --matcher HttpCode=200 \
      --query 'TargetGroups[0].TargetGroupArn' --output text)"
    save_state "$state_key" "$tg"
  fi
}
create_tg WEB_TG_ARN "$NAME_PREFIX-web" 3000 /api/health
create_tg API_TG_ARN "$NAME_PREFIX-api" 4000 /health

if [[ -z "${WEB_LISTENER_ARN:-}" ]]; then
  WEB_LISTENER_ARN="$(aws elbv2 create-listener --load-balancer-arn "$ALB_ARN" --protocol HTTP --port 80 \
    --default-actions "Type=forward,TargetGroupArn=$WEB_TG_ARN" --query 'Listeners[0].ListenerArn' --output text)"
  save_state WEB_LISTENER_ARN "$WEB_LISTENER_ARN"
fi
# An environment provisioned before the API moved has this listener on the
# public balancer, and leaving it there would keep port 4000 answering from the
# internet no matter what the security groups say. Deleting and recreating is
# safe here because the target group is unchanged: the ECS service references
# the target group, not the listener, so the API service is not disturbed and
# does not need a redeploy.
if [[ -n "${API_LISTENER_ARN:-}" ]]; then
  CURRENT_API_LB="$(aws elbv2 describe-listeners --listener-arns "$API_LISTENER_ARN" \
    --query 'Listeners[0].LoadBalancerArn' --output text 2>/dev/null || echo "")"
  if [[ "$CURRENT_API_LB" != "$API_ALB_ARN" ]]; then
    [[ -n "$CURRENT_API_LB" && "$CURRENT_API_LB" != "None" ]] &&
      aws elbv2 delete-listener --listener-arn "$API_LISTENER_ARN" >/dev/null
    API_LISTENER_ARN=""
  fi
fi
if [[ -z "${API_LISTENER_ARN:-}" ]]; then
  API_LISTENER_ARN="$(aws elbv2 create-listener --load-balancer-arn "$API_ALB_ARN" --protocol HTTP --port 4000 \
    --default-actions "Type=forward,TargetGroupArn=$API_TG_ARN" --query 'Listeners[0].ListenerArn' --output text)"
  save_state API_LISTENER_ARN "$API_LISTENER_ARN"
fi

secret_ref() {
  local arn="$1" key="$2"
  printf '%s:%s::' "$arn" "$key"
}

# Stripe keys live in the existing web/api JSON secrets. Only reference them
# when the key is already present — ECS fails to start if valueFrom points at
# a missing JSON field.
secret_has_key() {
  local arn="$1" key="$2"
  aws secretsmanager get-secret-value --secret-id "$arn" --query SecretString --output text \
    | jq -e --arg key "$key" '.[$key] | type == "string" and length > 0' >/dev/null
}
WEB_HAS_STRIPE_WEBHOOK=false
API_HAS_STRIPE_SECRET=false
secret_has_key "$WEB_SECRET_ARN" STRIPE_WEBHOOK_SECRET && WEB_HAS_STRIPE_WEBHOOK=true
secret_has_key "$API_SECRET_ARN" STRIPE_SECRET_KEY && API_HAS_STRIPE_SECRET=true

WEB_TASK="$(jq -nc \
  --arg family "$NAME_PREFIX-web" \
  --arg exec "$EXEC_ROLE_ARN" \
  --arg task "$TASK_ROLE_ARN" \
  --arg image "$WEB_ECR_URI:$IMAGE_TAG" \
  --arg logs "$LOG_WEB" \
  --arg region "$AWS_REGION" \
  --arg api "$API_URL" \
  --arg site "$SITE_URL" \
  --arg bucket "$AWS_S3_BUCKET" \
  --arg web_secret "$WEB_SECRET_ARN" \
  --arg contact_to "$CONTACT_TO_EMAIL" \
  --arg tenant "${COMMERCE_DEFAULT_TENANT_ID:-}" \
  --arg account "${COMMERCE_DEFAULT_ACCOUNT_ID:-}" \
  --arg store "${COMMERCE_DEFAULT_STORE_ID:-}" \
  --arg store_slug "${COMMERCE_DEFAULT_STORE_SLUG:-}" \
  --arg store_name "${COMMERCE_DEFAULT_STORE_NAME:-}" \
  --arg service_token "${SERVICE_TOKEN_SECRET_ARN:-}" \
  --arg admin_token "${ADMIN_TOKEN_SECRET_ARN:-}" \
  --arg email_secret "${EMAIL_SECRET_ARN:-}" \
  --arg stripe_webhook "$WEB_HAS_STRIPE_WEBHOOK" \
  '{
    family:$family,
    networkMode:"awsvpc",
    requiresCompatibilities:["FARGATE"],
    cpu:"512",
    memory:"1024",
    executionRoleArn:$exec,
    taskRoleArn:$task,
    containerDefinitions:[{
      name:"web",
      image:$image,
      essential:true,
      portMappings:[{containerPort:3000,protocol:"tcp"}],
      environment:([
        {name:"NODE_ENV",value:"production"},
        {name:"COMMERCE_API_BASE_URL",value:$api},
        {name:"NEXT_PUBLIC_SITE_URL",value:$site},
        {name:"AWS_S3_BUCKET",value:$bucket},
        {name:"AWS_REGION",value:$region},
        {name:"COGNITO_REGION",value:$region},
        {name:"CONTACT_TO_EMAIL",value:$contact_to}
      ]
      # Which store this environment serves. Without these the storefront has no
      # store to be and falls back to a marketing shell with an empty tenant id,
      # which renders a healthy-looking page with no catalogue behind it.
      # 16-create-store.sh writes them into state; it has to have been run.
      + (if $tenant     != "" then [{name:"COMMERCE_DEFAULT_TENANT_ID",value:$tenant}]      else [] end)
      + (if $account    != "" then [{name:"COMMERCE_DEFAULT_ACCOUNT_ID",value:$account}]    else [] end)
      + (if $store      != "" then [{name:"COMMERCE_DEFAULT_STORE_ID",value:$store}]        else [] end)
      + (if $store_slug != "" then [{name:"COMMERCE_DEFAULT_STORE_SLUG",value:$store_slug}] else [] end)
      + (if $store_name != "" then [{name:"COMMERCE_DEFAULT_STORE_NAME",value:$store_name}] else [] end)),
      secrets:([
        {name:"STAFF_ADMIN_USER",valueFrom:($web_secret+":STAFF_ADMIN_USER::")},
        {name:"STAFF_ADMIN_PASSWORD",valueFrom:($web_secret+":STAFF_ADMIN_PASSWORD::")},
        {name:"STAFF_SESSION_SECRET",valueFrom:($web_secret+":STAFF_SESSION_SECRET::")},
        {name:"CUSTOMER_SESSION_SECRET",valueFrom:($web_secret+":CUSTOMER_SESSION_SECRET::")},
        {name:"COGNITO_USER_POOL_ID",valueFrom:($web_secret+":COGNITO_USER_POOL_ID::")},
        {name:"COGNITO_APP_CLIENT_ID",valueFrom:($web_secret+":COGNITO_APP_CLIENT_ID::")},
        {name:"COGNITO_APP_CLIENT_SECRET",valueFrom:($web_secret+":COGNITO_APP_CLIENT_SECRET::")}
      ]
      # The commerce API refuses tenant-scoped requests in production without a
      # service token, so a web tier that cannot present one gets nothing back.
      + (if $service_token != "" then [{name:"COMMERCE_SERVICE_TOKEN",valueFrom:($service_token+":COMMERCE_SERVICE_TOKEN::")}] else [] end)
      + (if $admin_token   != "" then [{name:"ADMIN_API_TOKEN",valueFrom:($admin_token+":ADMIN_API_TOKEN::")}]                 else [] end)
      # Absent this the contact form silently logs submissions instead of
      # sending them, which reads as success to the customer.
      + (if $email_secret  != "" then [{name:"RESEND_API_KEY",valueFrom:($email_secret+":RESEND_API_KEY::")}]                  else [] end)
      + (if $stripe_webhook == "true" then [{name:"STRIPE_WEBHOOK_SECRET",valueFrom:($web_secret+":STRIPE_WEBHOOK_SECRET::")}] else [] end)),
      logConfiguration:{
        logDriver:"awslogs",
        options:{"awslogs-group":$logs,"awslogs-region":$region,"awslogs-stream-prefix":"web"}
      }
    }]
  }')"

API_TASK="$(jq -nc \
  --arg family "$NAME_PREFIX-api" \
  --arg exec "$EXEC_ROLE_ARN" \
  --arg task "$TASK_ROLE_ARN" \
  --arg image "$API_ECR_URI:$IMAGE_TAG" \
  --arg logs "$LOG_API" \
  --arg region "$AWS_REGION" \
  --arg api_secret "$API_SECRET_ARN" \
  --arg service_token "${SERVICE_TOKEN_SECRET_ARN:-}" \
  --arg admin_token "${ADMIN_TOKEN_SECRET_ARN:-}" \
  --arg vendor_secret "${VENDOR_SECRET_ARN:-}" \
  --arg sanmar_base "${SANMAR_API_BASE_URL:-}" \
  --arg ss_base "${SS_API_BASE_URL:-}" \
  --arg email_secret "${EMAIL_SECRET_ARN:-}" \
  --arg site "$SITE_URL" \
  --arg staff_email "${STAFF_NOTIFICATION_EMAIL:-}" \
  --arg from_email "${NOTIFICATIONS_FROM_EMAIL:-}" \
  --arg store_base_domain "${COMMERCE_STOREFRONT_BASE_DOMAIN:-}" \
  --arg stripe_secret "$API_HAS_STRIPE_SECRET" \
  '{
    family:$family,
    networkMode:"awsvpc",
    requiresCompatibilities:["FARGATE"],
    cpu:"256",
    memory:"512",
    executionRoleArn:$exec,
    taskRoleArn:$task,
    containerDefinitions:[{
      name:"api",
      image:$image,
      essential:true,
      portMappings:[{containerPort:4000,protocol:"tcp"}],
      environment:([
        {name:"NODE_ENV",value:"production"},
        {name:"COMMERCE_API_HOST",value:"0.0.0.0"},
        {name:"COMMERCE_API_PORT",value:"4000"},
        {name:"ENABLE_DEV_ADMIN_ROUTES",value:"false"},
        # Fargate has no writable public directory, so S&S images are kept as
        # CDN URLs rather than downloaded during a sync.
        {name:"SS_IMAGE_STORAGE",value:"remote"},
        # Links inside notification emails point back at the storefront.
        {name:"SITE_BASE_URL",value:$site}
      ]
      + (if $sanmar_base != "" then [{name:"SANMAR_API_BASE_URL",value:$sanmar_base}] else [] end)
      + (if $ss_base     != "" then [{name:"SS_API_BASE_URL",value:$ss_base}]         else [] end)
      # Without a staff address, customer proof activity is delivered nowhere.
      + (if $staff_email != "" then [{name:"STAFF_NOTIFICATION_EMAIL",value:$staff_email}] else [] end)
      + (if $from_email  != "" then [{name:"NOTIFICATIONS_FROM_EMAIL",value:$from_email}]   else [] end)
      # Only set on a stack that serves several stores off one wildcard domain.
      # Absent, a host resolves only against a registered stores.custom_domain.
      + (if $store_base_domain != "" then [{name:"COMMERCE_STOREFRONT_BASE_DOMAIN",value:$store_base_domain}] else [] end)),
      secrets:([
        {name:"DATABASE_URL",valueFrom:($api_secret+":DATABASE_URL::")}
      ]
      + (if $stripe_secret == "true" then [{name:"STRIPE_SECRET_KEY",valueFrom:($api_secret+":STRIPE_SECRET_KEY::")}] else [] end)
      # Admin routes are only mounted when ADMIN_API_TOKEN is present, which is
      # what replaces the development-only flag in production.
      + (if $service_token  != "" then [{name:"COMMERCE_SERVICE_TOKEN",valueFrom:($service_token+":COMMERCE_SERVICE_TOKEN::")}] else [] end)
      + (if $admin_token    != "" then [{name:"ADMIN_API_TOKEN",valueFrom:($admin_token+":ADMIN_API_TOKEN::")}]                 else [] end)
      # The API drains the outbox, so the mail key belongs here as well as on
      # the web tier. Without it proof notifications stay queued.
      + (if $email_secret   != "" then [{name:"RESEND_API_KEY",valueFrom:($email_secret+":RESEND_API_KEY::")}] else [] end)
      # Vendor credentials drive catalogue sync; without them the storefront
      # has no products at all.
      + (if $vendor_secret  != "" then [
          {name:"SANMAR_ACCOUNT_ID",valueFrom:($vendor_secret+":SANMAR_ACCOUNT_ID::")},
          {name:"SANMAR_LOGIN_EMAIL",valueFrom:($vendor_secret+":SANMAR_LOGIN_EMAIL::")},
          {name:"SANMAR_API_PASSWORD",valueFrom:($vendor_secret+":SANMAR_API_PASSWORD::")},
          {name:"SS_ACCOUNT_NUMBER",valueFrom:($vendor_secret+":SS_ACCOUNT_NUMBER::")},
          {name:"SS_API_KEY",valueFrom:($vendor_secret+":SS_API_KEY::")}
        ] else [] end)),
      logConfiguration:{
        logDriver:"awslogs",
        options:{"awslogs-group":$logs,"awslogs-region":$region,"awslogs-stream-prefix":"api"}
      }
    }]
  }')"

WEB_TD="$(aws ecs register-task-definition --cli-input-json "$WEB_TASK" --query 'taskDefinition.taskDefinitionArn' --output text)"
API_TD="$(aws ecs register-task-definition --cli-input-json "$API_TASK" --query 'taskDefinition.taskDefinitionArn' --output text)"
save_state WEB_TASK_DEFINITION_ARN "$WEB_TD"
save_state API_TASK_DEFINITION_ARN "$API_TD"

if [[ -z "${ECS_CLUSTER:-}" ]]; then
  aws ecs create-cluster --cluster-name "$NAME_PREFIX" \
    --tags key=Project,value="$PROJECT" key=Environment,value="$ENVIRONMENT" >/dev/null
  save_state ECS_CLUSTER "$NAME_PREFIX"
fi

HAS_WEB_IMAGE=false
HAS_API_IMAGE=false
aws ecr describe-images --repository-name gwg-web --image-ids "imageTag=$IMAGE_TAG" >/dev/null 2>&1 && HAS_WEB_IMAGE=true
aws ecr describe-images --repository-name gwg-commerce-api --image-ids "imageTag=$IMAGE_TAG" >/dev/null 2>&1 && HAS_API_IMAGE=true
DESIRED=0
if [[ "$HAS_WEB_IMAGE" == "true" && "$HAS_API_IMAGE" == "true" ]]; then
  DESIRED=1
fi

upsert_service() {
  local name="$1" td="$2" sg="$3" tg="$4" container="$5" port="$6"
  local net
  net="$(jq -nc --arg sg "$sg" --arg s1 "$PUBLIC_SUBNET_1_ID" --arg s2 "$PUBLIC_SUBNET_2_ID" \
    '{awsvpcConfiguration:{subnets:[$s1,$s2],securityGroups:[$sg],assignPublicIp:"ENABLED"}}')"
  if aws ecs describe-services --cluster "$ECS_CLUSTER" --services "$name" \
      --query 'services[?status==`ACTIVE`].serviceName' --output text | grep -q "$name"; then
    aws ecs update-service --cluster "$ECS_CLUSTER" --service "$name" \
      --task-definition "$td" --desired-count "$DESIRED" >/dev/null
  else
    aws ecs create-service --cluster "$ECS_CLUSTER" --service-name "$name" \
      --task-definition "$td" --desired-count "$DESIRED" --launch-type FARGATE \
      --network-configuration "$net" \
      --load-balancers "targetGroupArn=$tg,containerName=$container,containerPort=$port" \
      --health-check-grace-period-seconds 60 >/dev/null
  fi
}

upsert_service "$NAME_PREFIX-web" "$WEB_TD" "$WEB_SG_ID" "$WEB_TG_ARN" web 3000
upsert_service "$NAME_PREFIX-api" "$API_TD" "$API_SG_ID" "$API_TG_ARN" api 4000

echo "ECS cluster:     $ECS_CLUSTER"
echo "ALB DNS:         $ALB_DNS"
echo "Storefront URL:  $SITE_URL"
echo "API URL:         $API_URL  (internal to the VPC)"
echo "Health checks:   $SITE_URL/api/health"
echo "                 $API_URL/health is only reachable from inside the VPC;"
echo "                 the storefront health check covers the API behind it."
if [[ "$DESIRED" == "0" ]]; then
  echo "No images tagged $IMAGE_TAG in ECR yet — services are created at desired count 0."
  echo "Push images with .github/workflows/aws-ecr.yml (or a laptop Docker build), then re-run this script."
else
  echo "Services desired count is 1. Give the ALB a couple of minutes, then curl the health URLs."
fi
echo "This first pass is HTTP on the ALB DNS. Add ACM + Route 53 before production HTTPS."
echo "ENABLE_DEV_ADMIN_ROUTES is false. COMMERCE_DEV_* IDs are not set."
# Said out loud because the storefront will not say it. With no store to be, it
# renders a marketing shell and returns 200 for every page, so an environment
# missing this looks deployed and sells nothing.
if [[ -z "${COMMERCE_DEFAULT_STORE_ID:-}" ]]; then
  echo
  echo "WARNING: no store identity for this environment, so the storefront will" >&2
  echo "serve a marketing shell with an empty catalogue. Run:" >&2
  echo "  ./scripts/16-create-store.sh" >&2
  echo "then run this script again." >&2
fi
