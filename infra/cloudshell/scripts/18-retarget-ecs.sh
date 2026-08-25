#!/usr/bin/env bash
# Point the web and API task definitions at an existing ECR tag, then deploy.
# Does not rebuild images. Does not run migrations.
#
#   CLUSTER=gwg-staging IMAGE_TAG=<sha> ./scripts/18-retarget-ecs.sh
#   CLUSTER=gwg-prod    IMAGE_TAG=<sha> ./scripts/18-retarget-ecs.sh
#
# Families are ${CLUSTER}-web and ${CLUSTER}-api (gwg-staging-web, …).
set -Eeuo pipefail

CLUSTER="${CLUSTER:?set CLUSTER to gwg-staging or gwg-prod}"
IMAGE_TAG="${IMAGE_TAG:?set IMAGE_TAG to the ECR image tag (usually a full Git SHA)}"
AWS_REGION="${AWS_REGION:-ca-central-1}"

case "$CLUSTER" in
  gwg-staging|gwg-prod) ;;
  *)
    echo "CLUSTER must be gwg-staging or gwg-prod, not $CLUSTER" >&2
    exit 1
    ;;
esac

if ! [[ "$IMAGE_TAG" =~ ^[0-9a-f]{40}$ ]] && [[ "$IMAGE_TAG" != "latest" ]]; then
  echo "IMAGE_TAG must be a 40-character lowercase Git SHA (or latest). Got: $IMAGE_TAG" >&2
  exit 1
fi

require_aws() {
  command -v aws >/dev/null 2>&1 || { echo "aws CLI is required" >&2; exit 1; }
  command -v python3 >/dev/null 2>&1 || { echo "python3 is required" >&2; exit 1; }
}
require_aws

ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text --region "$AWS_REGION")"
REGISTRY="${ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"

for repo in gwg-web gwg-commerce-api; do
  # BatchGetImage is on the existing OIDC role; DescribeImages is not.
  found="$(aws ecr batch-get-image \
    --repository-name "$repo" \
    --image-ids "imageTag=$IMAGE_TAG" \
    --region "$AWS_REGION" \
    --query 'images[0].imageId.imageTag' \
    --output text)"
  if [[ -z "$found" || "$found" == "None" ]]; then
    echo "No image $repo:$IMAGE_TAG in ECR" >&2
    exit 1
  fi
done

retarget() {
  local family="$1"
  local image="$2"
  local service="$3"
  python3 - "$family" "$image" "$service" "$CLUSTER" "$AWS_REGION" <<'PY'
import json, subprocess, sys

family, image, service, cluster, region = sys.argv[1:6]
raw = subprocess.check_output(
    ["aws", "ecs", "describe-task-definition", "--task-definition", family, "--region", region],
    text=True,
)
td = json.loads(raw)["taskDefinition"]
if not td.get("containerDefinitions"):
    sys.exit(f"{family} has no container definitions")
container = td["containerDefinitions"][0]
container["image"] = image

# Staging/prod already inject SANMAR_ACCOUNT_ID from the vendor secret, but
# SANMAR_MEDIA_PASSWORD was never mapped. Attach it when the JSON key exists
# so a retarget (not only a full 09 re-run) actually gives Media to the API.
# Do not print secret values. Skip quietly if the key is absent or unreadable.
if family.endswith("-api"):
    secrets = container.setdefault("secrets", [])
    if not any(item.get("name") == "SANMAR_MEDIA_PASSWORD" for item in secrets):
        candidates = []
        for item in secrets:
            name = item.get("name") or ""
            value_from = item.get("valueFrom") or ""
            for key in ("SANMAR_ACCOUNT_ID", "DATABASE_URL"):
                suffix = f":{key}::"
                if name == key and value_from.endswith(suffix):
                    candidates.append(value_from[: -len(suffix)])
        seen = set()
        for secret_id in candidates:
            if secret_id in seen:
                continue
            seen.add(secret_id)
            try:
                payload = subprocess.check_output(
                    [
                        "aws", "secretsmanager", "get-secret-value",
                        "--secret-id", secret_id,
                        "--region", region,
                        "--query", "SecretString",
                        "--output", "text",
                    ],
                    text=True,
                )
                data = json.loads(payload)
            except (subprocess.CalledProcessError, json.JSONDecodeError):
                continue
            password = data.get("SANMAR_MEDIA_PASSWORD")
            if isinstance(password, str) and password.strip():
                secrets.append({
                    "name": "SANMAR_MEDIA_PASSWORD",
                    "valueFrom": f"{secret_id}:SANMAR_MEDIA_PASSWORD::",
                })
                print(f"{family} will inject SANMAR_MEDIA_PASSWORD from an existing secret")
                break

for k in (
    "taskDefinitionArn",
    "revision",
    "status",
    "requiresAttributes",
    "compatibilities",
    "registeredAt",
    "registeredBy",
    "deregisteredAt",
):
    td.pop(k, None)
path = "/tmp/gwg-td.json"
open(path, "w").write(json.dumps(td))
reg = subprocess.check_output(
    ["aws", "ecs", "register-task-definition", "--cli-input-json", f"file://{path}", "--region", region],
    text=True,
)
arn = json.loads(reg)["taskDefinition"]["taskDefinitionArn"]
print(arn)
subprocess.check_call(
    [
        "aws", "ecs", "update-service",
        "--cluster", cluster,
        "--service", service,
        "--task-definition", arn,
        "--force-new-deployment",
        "--region", region,
        "--query", "service.serviceName",
        "--output", "text",
    ]
)
PY
}

echo "Retargeting $CLUSTER web+api to $IMAGE_TAG"
retarget "$CLUSTER-web" "$REGISTRY/gwg-web:$IMAGE_TAG" "$CLUSTER-web"
retarget "$CLUSTER-api" "$REGISTRY/gwg-commerce-api:$IMAGE_TAG" "$CLUSTER-api"
echo "Deployments started. Wait until running=desired and pending=0, or run 22-wait-ecs.sh."
