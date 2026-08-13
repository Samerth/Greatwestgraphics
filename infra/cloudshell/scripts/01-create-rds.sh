#!/usr/bin/env bash
set -Eeuo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/common.sh"

[[ -n "${ACCOUNT_ID:-}" ]] || { echo "Run 00-preflight.sh first." >&2; exit 1; }
AZ1="$(aws ec2 describe-availability-zones --filters Name=state,Values=available --query 'AvailabilityZones[0].ZoneName' --output text)"
AZ2="$(aws ec2 describe-availability-zones --filters Name=state,Values=available --query 'AvailabilityZones[1].ZoneName' --output text)"

if [[ -z "${VPC_ID:-}" ]]; then
  VPC_ID="$(aws ec2 create-vpc --cidr-block "$VPC_CIDR" \
    --tag-specifications "ResourceType=vpc,Tags=[{Key=Name,Value=$NAME_PREFIX-db-vpc},{Key=Project,Value=$PROJECT},{Key=Environment,Value=$ENVIRONMENT},{Key=ManagedBy,Value=gwg-cloudshell}]" \
    --query 'Vpc.VpcId' --output text)"
  aws ec2 modify-vpc-attribute --vpc-id "$VPC_ID" --enable-dns-hostnames '{"Value":true}'
  aws ec2 modify-vpc-attribute --vpc-id "$VPC_ID" --enable-dns-support '{"Value":true}'
  save_state VPC_ID "$VPC_ID"
fi

create_subnet() {
  local state_key="$1" cidr="$2" az="$3" label="$4" subnet_id="${!state_key:-}"
  if [[ -z "$subnet_id" ]]; then
    subnet_id="$(aws ec2 create-subnet --vpc-id "$VPC_ID" --cidr-block "$cidr" --availability-zone "$az" \
      --tag-specifications "ResourceType=subnet,Tags=[{Key=Name,Value=$NAME_PREFIX-$label},{Key=Project,Value=$PROJECT},{Key=Environment,Value=$ENVIRONMENT}]" \
      --query 'Subnet.SubnetId' --output text)"
    aws ec2 modify-subnet-attribute --subnet-id "$subnet_id" --map-public-ip-on-launch '{"Value":false}'
    save_state "$state_key" "$subnet_id"
  fi
}
create_subnet PUBLIC_SUBNET_1_ID "$PUBLIC_SUBNET_1_CIDR" "$AZ1" db-public-a
create_subnet PUBLIC_SUBNET_2_ID "$PUBLIC_SUBNET_2_CIDR" "$AZ2" db-public-b

if [[ -z "${IGW_ID:-}" ]]; then
  IGW_ID="$(aws ec2 create-internet-gateway \
    --tag-specifications "ResourceType=internet-gateway,Tags=[{Key=Name,Value=$NAME_PREFIX-db-igw},{Key=Project,Value=$PROJECT},{Key=Environment,Value=$ENVIRONMENT}]" \
    --query 'InternetGateway.InternetGatewayId' --output text)"
  aws ec2 attach-internet-gateway --vpc-id "$VPC_ID" --internet-gateway-id "$IGW_ID"
  save_state IGW_ID "$IGW_ID"
fi

if [[ -z "${ROUTE_TABLE_ID:-}" ]]; then
  ROUTE_TABLE_ID="$(aws ec2 create-route-table --vpc-id "$VPC_ID" \
    --tag-specifications "ResourceType=route-table,Tags=[{Key=Name,Value=$NAME_PREFIX-db-public-rt},{Key=Project,Value=$PROJECT},{Key=Environment,Value=$ENVIRONMENT}]" \
    --query 'RouteTable.RouteTableId' --output text)"
  aws ec2 create-route --route-table-id "$ROUTE_TABLE_ID" --destination-cidr-block 0.0.0.0/0 --gateway-id "$IGW_ID" >/dev/null
  aws ec2 associate-route-table --route-table-id "$ROUTE_TABLE_ID" --subnet-id "$PUBLIC_SUBNET_1_ID" >/dev/null
  aws ec2 associate-route-table --route-table-id "$ROUTE_TABLE_ID" --subnet-id "$PUBLIC_SUBNET_2_ID" >/dev/null
  save_state ROUTE_TABLE_ID "$ROUTE_TABLE_ID"
fi

if [[ -z "${DB_SG_ID:-}" ]]; then
  DB_SG_ID="$(aws ec2 create-security-group --vpc-id "$VPC_ID" \
    --group-name "$NAME_PREFIX-public-rds" --description "GWG RDS restricted public access" \
    --tag-specifications "ResourceType=security-group,Tags=[{Key=Name,Value=$NAME_PREFIX-public-rds},{Key=Project,Value=$PROJECT},{Key=Environment,Value=$ENVIRONMENT}]" \
    --query GroupId --output text)"
  save_state DB_SG_ID "$DB_SG_ID"
fi
authorize_postgres_cidr "$DB_SG_ID" "$PUBLIC_DB_ALLOWED_CIDR" "Trusted external PostgreSQL client"
save_state CURRENT_ALLOWED_CIDR "$PUBLIC_DB_ALLOWED_CIDR"

DB_SUBNET_GROUP="$NAME_PREFIX-public-db-subnets"
aws rds describe-db-subnet-groups --db-subnet-group-name "$DB_SUBNET_GROUP" >/dev/null 2>&1 || \
  aws rds create-db-subnet-group --db-subnet-group-name "$DB_SUBNET_GROUP" \
    --db-subnet-group-description "GWG public RDS subnets" \
    --subnet-ids "$PUBLIC_SUBNET_1_ID" "$PUBLIC_SUBNET_2_ID" \
    --tags Key=Project,Value="$PROJECT" Key=Environment,Value="$ENVIRONMENT" >/dev/null

DB_PARAMETER_GROUP="$NAME_PREFIX-postgres16-public"
aws rds describe-db-parameter-groups --db-parameter-group-name "$DB_PARAMETER_GROUP" >/dev/null 2>&1 || \
  aws rds create-db-parameter-group --db-parameter-group-name "$DB_PARAMETER_GROUP" \
    --db-parameter-group-family postgres16 --description "GWG PostgreSQL 16 TLS enforcement" \
    --tags Key=Project,Value="$PROJECT" Key=Environment,Value="$ENVIRONMENT" >/dev/null
aws rds modify-db-parameter-group --db-parameter-group-name "$DB_PARAMETER_GROUP" \
  --parameters ParameterName=rds.force_ssl,ParameterValue=1,ApplyMethod=immediate >/dev/null

DB_INSTANCE_ID="$NAME_PREFIX-postgres"
if ! aws rds describe-db-instances --db-instance-identifier "$DB_INSTANCE_ID" >/dev/null 2>&1; then
  PG_VERSION="$(aws rds describe-db-engine-versions --engine postgres \
    --query 'DBEngineVersions[?starts_with(EngineVersion, `16.`)].EngineVersion' --output text | tr '\t' '\n' | sort -V | tail -1)"
  RDS_ARGS=(--db-instance-identifier "$DB_INSTANCE_ID" --engine postgres --engine-version "$PG_VERSION"
    --db-instance-class "$RDS_INSTANCE_CLASS" --allocated-storage "$RDS_ALLOCATED_STORAGE_GB"
    --storage-type gp3 --storage-encrypted --db-name "$DB_NAME" --master-username "$DB_USERNAME"
    --manage-master-user-password --vpc-security-group-ids "$DB_SG_ID"
    --db-subnet-group-name "$DB_SUBNET_GROUP" --db-parameter-group-name "$DB_PARAMETER_GROUP"
    --backup-retention-period "$RDS_BACKUP_RETENTION_DAYS" --copy-tags-to-snapshot
    --deletion-protection --publicly-accessible --auto-minor-version-upgrade
    --tags Key=Project,Value="$PROJECT" Key=Environment,Value="$ENVIRONMENT" Key=ManagedBy,Value=gwg-cloudshell)
  if [[ "$RDS_MULTI_AZ" == "true" ]]; then RDS_ARGS+=(--multi-az); else RDS_ARGS+=(--no-multi-az); fi
  aws rds create-db-instance "${RDS_ARGS[@]}" >/dev/null
fi

echo "Waiting for RDS to become available (often 5–10 minutes)..."
aws rds wait db-instance-available --db-instance-identifier "$DB_INSTANCE_ID"
RDS_ENDPOINT="$(aws rds describe-db-instances --db-instance-identifier "$DB_INSTANCE_ID" \
  --query 'DBInstances[0].Endpoint.Address' --output text)"
DB_SECRET_ARN="$(aws rds describe-db-instances --db-instance-identifier "$DB_INSTANCE_ID" \
  --query 'DBInstances[0].MasterUserSecret.SecretArn' --output text)"
[[ -n "$DB_SECRET_ARN" && "$DB_SECRET_ARN" != "None" ]] || {
  echo "RDS did not return its managed master-user secret ARN." >&2
  exit 1
}

save_state DB_INSTANCE_ID "$DB_INSTANCE_ID"
save_state RDS_ENDPOINT "$RDS_ENDPOINT"
save_state DB_SECRET_ARN "$DB_SECRET_ARN"

if ! aws budgets describe-budget --account-id "$ACCOUNT_ID" --budget-name "$NAME_PREFIX-monthly" >/dev/null 2>&1; then
  BUDGET_JSON="$(jq -nc --arg name "$NAME_PREFIX-monthly" --arg amount "$BUDGET_AMOUNT" --arg unit "$BUDGET_UNIT" \
    '{BudgetName:$name,BudgetLimit:{Amount:$amount,Unit:$unit},BudgetType:"COST",TimeUnit:"MONTHLY",CostTypes:{IncludeTax:true,IncludeSubscription:true,UseBlended:false,IncludeRefund:true,IncludeCredit:true,IncludeUpfront:true,IncludeRecurring:true,IncludeOtherSubscription:true,IncludeSupport:true,IncludeDiscount:true,UseAmortized:false}}')"
  NOTIFICATIONS_JSON="$(jq -nc --arg email "$BUDGET_EMAIL" \
    '[{Notification:{NotificationType:"ACTUAL",ComparisonOperator:"GREATER_THAN",Threshold:80,ThresholdType:"PERCENTAGE",NotificationState:"ALARM"},Subscribers:[{SubscriptionType:"EMAIL",Address:$email}]},{Notification:{NotificationType:"FORECASTED",ComparisonOperator:"GREATER_THAN",Threshold:100,ThresholdType:"PERCENTAGE",NotificationState:"ALARM"},Subscribers:[{SubscriptionType:"EMAIL",Address:$email}]}]')"
  aws budgets create-budget --account-id "$ACCOUNT_ID" --budget "$BUDGET_JSON" \
    --notifications-with-subscribers "$NOTIFICATIONS_JSON"
fi

BILLING_TOPIC_ARN="$(aws sns create-topic --region us-east-1 --name "$NAME_PREFIX-billing-alerts" \
  --tags Key=Project,Value="$PROJECT" Key=Environment,Value="$ENVIRONMENT" --query TopicArn --output text)"
if ! aws sns list-subscriptions-by-topic --region us-east-1 --topic-arn "$BILLING_TOPIC_ARN" --output json | \
  jq -e --arg email "$BUDGET_EMAIL" '.Subscriptions[]? | select(.Protocol == "email" and .Endpoint == $email)' >/dev/null; then
  aws sns subscribe --region us-east-1 --topic-arn "$BILLING_TOPIC_ARN" \
    --protocol email --notification-endpoint "$BUDGET_EMAIL" >/dev/null
fi
aws cloudwatch put-metric-alarm --region us-east-1 --alarm-name "$NAME_PREFIX-estimated-charges-usd" \
  --alarm-description "Approximate companion to the CAD $BUDGET_AMOUNT AWS Budget" \
  --namespace AWS/Billing --metric-name EstimatedCharges --dimensions Name=Currency,Value=USD \
  --statistic Maximum --period 21600 --evaluation-periods 1 --threshold "$BILLING_ALARM_USD" \
  --comparison-operator GreaterThanOrEqualToThreshold --treat-missing-data notBreaching \
  --alarm-actions "$BILLING_TOPIC_ARN"
save_state BILLING_TOPIC_ARN "$BILLING_TOPIC_ARN"

echo "RDS creation complete"
echo "Endpoint:       $RDS_ENDPOINT"
echo "Port:           5432"
echo "Database:       $DB_NAME"
echo "Username:       $DB_USERNAME"
echo "Allowed CIDR:   $PUBLIC_DB_ALLOWED_CIDR"
echo "TLS:            required"
echo "Password:       managed by RDS in Secrets Manager; not printed"
echo "Billing alert:  confirm the SNS email subscription sent to $BUDGET_EMAIL"
