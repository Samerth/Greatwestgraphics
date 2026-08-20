#!/usr/bin/env bash
# Restart the web and API services so they pull the image tag already on the
# task definition (usually :latest). Does not create a cluster, change env
# vars, or touch production unless CONFIG_FILE points at it.
set -Eeuo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/common.sh"

require_command aws

CLUSTER="${ECS_CLUSTER:-$NAME_PREFIX}"

for svc in "$NAME_PREFIX-web" "$NAME_PREFIX-api"; do
  echo "Rolling $svc on $CLUSTER"
  aws ecs update-service \
    --cluster "$CLUSTER" \
    --service "$svc" \
    --force-new-deployment \
    --query 'service.{name:serviceName,td:taskDefinition,desired:desiredCount,running:runningCount,pending:pendingCount}' \
    --output table
done

echo
echo "Wait until pending is 0 and running equals desired, then hard-refresh the site."
echo "  aws ecs describe-services --cluster $CLUSTER --services $NAME_PREFIX-web $NAME_PREFIX-api \\"
echo "    --query 'services[].{name:serviceName,running:runningCount,desired:desiredCount,pending:pendingCount}'"
