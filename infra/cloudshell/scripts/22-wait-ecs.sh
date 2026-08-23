#!/usr/bin/env bash
# Wait until CLUSTER-web and CLUSTER-api have one healthy PRIMARY deployment
# each (running == desired, pending == 0).
#
#   CLUSTER=gwg-staging ./scripts/22-wait-ecs.sh
#   CLUSTER=gwg-staging JOIN_OR_ROLL=1 ./scripts/22-wait-ecs.sh
#
# JOIN_OR_ROLL=1 is for Deploy to Staging. AWS ECR already retargets the SHA
# (or bounces :latest). A second force-new-deployment on that in-flight roll is
# what trips `aws ecs wait services-stable` (40 × 15s = 10 minutes). This joins
# an in-progress or already-stable rollout and only bounces when a service is
# stuck or the last rollout failed.
#
# Does not source common.sh — GitHub Actions has no CloudShell config.env.
# Production promote does not call this; it stays a manual SHA retarget.
set -Eeuo pipefail

CLUSTER="${CLUSTER:?set CLUSTER to gwg-staging or gwg-prod}"
AWS_REGION="${AWS_REGION:-ca-central-1}"
TIMEOUT_SECONDS="${TIMEOUT_SECONDS:-1200}"
JOIN_OR_ROLL="${JOIN_OR_ROLL:-0}"
POLL_SECONDS="${POLL_SECONDS:-15}"

case "$CLUSTER" in
  gwg-staging|gwg-prod) ;;
  *)
    echo "CLUSTER must be gwg-staging or gwg-prod, not $CLUSTER" >&2
    exit 1
    ;;
esac

if ! [[ "$TIMEOUT_SECONDS" =~ ^[0-9]+$ ]] || (( TIMEOUT_SECONDS < 15 )); then
  echo "TIMEOUT_SECONDS must be an integer >= 15" >&2
  exit 1
fi

command -v aws >/dev/null 2>&1 || { echo "aws CLI is required" >&2; exit 1; }
command -v python3 >/dev/null 2>&1 || { echo "python3 is required" >&2; exit 1; }

SERVICES=("$CLUSTER-web" "$CLUSTER-api")
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HELPER="$SCRIPT_DIR/ecs_service_state.py"

describe_services() {
  aws ecs describe-services \
    --cluster "$CLUSTER" \
    --services "${SERVICES[@]}" \
    --region "$AWS_REGION" \
    --output json
}

print_states() {
  describe_services | python3 "$HELPER" summarize "${SERVICES[@]}"
}

aggregate_kind() {
  describe_services | python3 "$HELPER" kind "${SERVICES[@]}"
}

dump_failure() {
  echo "Timed out after ${TIMEOUT_SECONDS}s waiting for $CLUSTER (${SERVICES[*]}) to stabilize." >&2
  describe_services | python3 "$HELPER" dump "${SERVICES[@]}" >&2
}

force_roll() {
  echo "Bouncing $CLUSTER services (stuck or failed rollout)."
  for svc in "${SERVICES[@]}"; do
    aws ecs update-service \
      --cluster "$CLUSTER" \
      --service "$svc" \
      --force-new-deployment \
      --region "$AWS_REGION" \
      --query 'service.serviceName' \
      --output text
  done
}

if [ "$JOIN_OR_ROLL" = "1" ]; then
  print_states
  case "$(aggregate_kind)" in
    stuck)
      force_roll
      ;;
    rolling)
      echo "ECS already rolling; joining that deployment instead of stacking another."
      ;;
    stable)
      echo "ECS already stable; not stacking another force-new-deployment."
      ;;
    *)
      echo "Could not classify ECS service state; bouncing to recover." >&2
      force_roll
      ;;
  esac
fi

echo "Waiting up to ${TIMEOUT_SECONDS}s for ${SERVICES[*]} on $CLUSTER to stabilize."
start="$SECONDS"
while (( SECONDS - start < TIMEOUT_SECONDS )); do
  print_states
  kind="$(aggregate_kind)"
  if [ "$kind" = "stable" ]; then
    echo "Services stable."
    exit 0
  fi
  if [ "$kind" = "stuck" ]; then
    echo "Service reported stuck mid-wait; will keep polling until timeout."
  fi
  sleep "$POLL_SECONDS"
done

dump_failure
exit 1
