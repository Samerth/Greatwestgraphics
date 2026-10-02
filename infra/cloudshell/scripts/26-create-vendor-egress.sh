#!/usr/bin/env bash
# Creates (or reuses) ONE small always-on box with ONE fixed public address,
# used only to relay SanMar Canada / ATC calls.
#
# Why this exists: SanMar's EDI agreement asks for a static IP on file per
# account, and on 26 Sep 2026 Bulk Data refused account 161 ("You are not
# authorized user for this call", code 120) from an AWS CloudShell address
# while SanMar's own sandbox account succeeded from it at the same moment.
# ECS has no fixed outbound address (assignPublicIp: ENABLED, no NAT — a
# fresh address every deploy), so there was nothing stable to register with
# SanMar. SanMar registered this box's address on 30 Sep 2026 and Bulk then
# worked on 1 Oct 2026 — but only after the login changed too (see
# SANMAR_BULK_LOGIN_EMAIL), so whether the address was the deciding factor is
# NOT proven. See the doc comments on SanmarClientOptions.bulkLoginEmail /
# .vendorProxyUrl in services/commerce-api/src/adapters/sanmar/client.ts and
# "Bulk Data history" in docs/VENDOR_SYNC.md for the full trail.
#
# Deliberately ONE box, not one per environment. Staging and production are
# full separate VPCs (docs/AWS_DEPLOYMENT.md) — a NAT Gateway built the usual
# way lives inside one VPC and cannot also belong to the other, which would
# mean two different addresses to register with SanMar over time. This box
# sits outside both VPCs on purpose, in the account's default VPC, so one
# address covers both — matching what the project's own original
# vendor-integration scoping document proposed before this team was involved.
#
# Real, small, ongoing AWS cost: one t3.micro EC2 instance running 24/7
# (free-tier eligible on many accounts; otherwise roughly USD 7-8/month) plus
# a negligible Elastic IP charge, which is free while attached to a running
# instance. This creates real billable infrastructure — review before
# running, unlike the read-only 24-probe-sanmar.sh.
#
# Locked down two ways, not just one:
#   - The proxy itself refuses any request without the right sign-in details
#     (nothing SanMar-related is exposed just by being able to reach the
#     port — see BasicAuth below).
#   - It only forwards to SanMar's and S&S's own addresses — nothing else,
#     even with the correct sign-in details.
# The listening port stays open to any address on purpose: the whole reason
# this box exists is that ECS's own outbound address changes on every
# deploy, so there is no fixed source address to allow-list on the box's
# side either. That circle is closed by the sign-in requirement instead.
#
#   export CONFIG_FILE=config.staging.env   # or config.env for prod, later
#   ./scripts/26-create-vendor-egress.sh
#
# Safe to re-run. Reuses the existing box, address and credential rather than
# recreating or rotating them. Run it once per environment (staging now, prod
# once it exists) to wire that environment's vendor secret and running API
# task at the shared address — the box itself is only ever created once,
# the first time this runs in either environment.
set -Eeuo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/common.sh"

for command_name in aws jq python3; do require_command "$command_name"; done
require_state VENDOR_SECRET_ARN

# This box is shared across every environment on purpose, so its own state
# lives in its own file rather than the per-environment one common.sh just
# set up above (that one still holds VENDOR_SECRET_ARN etc. for this run).
SHARED_STATE_FILE="$STATE_DIR/gwg-vendor-egress.env"
touch "$SHARED_STATE_FILE"; chmod 600 "$SHARED_STATE_FILE"
EGRESS_VPC_ID="" EGRESS_SUBNET_ID="" EGRESS_SG_ID="" EGRESS_ROLE_CREATED="" \
  EGRESS_INSTANCE_ID="" EGRESS_ALLOCATION_ID="" EGRESS_PUBLIC_IP="" \
  EGRESS_PROXY_USERNAME="" EGRESS_PROXY_PASSWORD=""
if [[ -s "$SHARED_STATE_FILE" ]]; then
  # shellcheck disable=SC1090
  source "$SHARED_STATE_FILE"
fi
save_shared() {
  local key="$1" value="$2" tmp
  [[ "$key" =~ ^[A-Z][A-Z0-9_]*$ ]] || { echo "Invalid state key: $key" >&2; exit 1; }
  tmp="$(mktemp)"
  awk -F= -v key="$key" '$1 != key' "$SHARED_STATE_FILE" > "$tmp"
  printf '%s=%q\n' "$key" "$value" >> "$tmp"
  mv "$tmp" "$SHARED_STATE_FILE"
  printf -v "$key" '%s' "$value"
}

BOX_NAME="gwg-vendor-egress"
PROXY_PORT=8888
API_SECRET_NAME="$NAME_PREFIX/api"
CLUSTER="${ECS_CLUSTER:-$NAME_PREFIX}"

echo "[$BOX_NAME] shared vendor-egress box — wiring it in for $NAME_PREFIX this run"

# ---- 1. Default VPC + a subnet that auto-assigns public IPs ---------------
if [[ -z "$EGRESS_VPC_ID" ]]; then
  VPC_ID="$(aws ec2 describe-vpcs --filters Name=isDefault,Values=true \
    --query 'Vpcs[0].VpcId' --output text)"
  [[ -n "$VPC_ID" && "$VPC_ID" != "None" ]] || {
    echo "No default VPC in this account/region. This box is meant to be" >&2
    echo "simple on purpose. Tell Claude which VPC/subnet to use instead of" >&2
    echo "the account default and this script can target it directly." >&2
    exit 1
  }
  SUBNET_ID="$(aws ec2 describe-subnets \
    --filters Name=vpc-id,Values="$VPC_ID" Name=map-public-ip-on-launch,Values=true \
    --query 'Subnets[0].SubnetId' --output text)"
  [[ -n "$SUBNET_ID" && "$SUBNET_ID" != "None" ]] || {
    echo "Default VPC $VPC_ID has no subnet that auto-assigns public IPs." >&2
    exit 1
  }
  save_shared EGRESS_VPC_ID "$VPC_ID"
  save_shared EGRESS_SUBNET_ID "$SUBNET_ID"
  echo "Using default VPC $VPC_ID / subnet $SUBNET_ID"
else
  echo "Reusing default VPC $EGRESS_VPC_ID / subnet $EGRESS_SUBNET_ID"
fi

# ---- 2. Security group: proxy port open, nothing else, no SSH -------------
if [[ -z "$EGRESS_SG_ID" ]]; then
  EXISTING_SG="$(aws ec2 describe-security-groups \
    --filters Name=group-name,Values="$BOX_NAME" Name=vpc-id,Values="$EGRESS_VPC_ID" \
    --query 'SecurityGroups[0].GroupId' --output text 2>/dev/null || true)"
  if [[ -n "$EXISTING_SG" && "$EXISTING_SG" != "None" ]]; then
    SG_ID="$EXISTING_SG"
    echo "Reusing existing security group $SG_ID"
  else
    SG_ID="$(aws ec2 create-security-group --group-name "$BOX_NAME" \
      --description "Fixed-address relay for SanMar/S&S vendor calls, shared by staging and production" \
      --vpc-id "$EGRESS_VPC_ID" --query 'GroupId' --output text)"
    echo "Created security group $SG_ID"
  fi
  authorize_sg_ingress "$SG_ID" tcp "$PROXY_PORT" "$PROXY_PORT" cidr "0.0.0.0/0" \
    "Vendor proxy - open by design, gated by BasicAuth on the proxy itself (ECS has no fixed source address to allow-list)"
  save_shared EGRESS_SG_ID "$SG_ID"
else
  echo "Reusing security group $EGRESS_SG_ID"
fi

# ---- 3. IAM role for shell access via SSM, not SSH ------------------------
# No inbound port 22, no SSH key to manage or lose. If this box ever needs a
# manual look, use: aws ssm start-session --target <instance-id>
ROLE_NAME="$BOX_NAME-role"
PROFILE_NAME="$BOX_NAME-profile"
if ! aws iam get-role --role-name "$ROLE_NAME" >/dev/null 2>&1; then
  aws iam create-role --role-name "$ROLE_NAME" --assume-role-policy-document '{
    "Version":"2012-10-17",
    "Statement":[{"Effect":"Allow","Principal":{"Service":"ec2.amazonaws.com"},"Action":"sts:AssumeRole"}]
  }' >/dev/null
  aws iam attach-role-policy --role-name "$ROLE_NAME" \
    --policy-arn arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore >/dev/null
  echo "Created IAM role $ROLE_NAME (SSM access only — no S3, no Secrets Manager)"
fi
if ! aws iam get-instance-profile --instance-profile-name "$PROFILE_NAME" >/dev/null 2>&1; then
  aws iam create-instance-profile --instance-profile-name "$PROFILE_NAME" >/dev/null
  aws iam add-role-to-instance-profile --instance-profile-name "$PROFILE_NAME" --role-name "$ROLE_NAME" >/dev/null
  echo "Waiting for the new instance profile to propagate..."
  sleep 10
fi

# ---- 4. BasicAuth credential — reuse if the vendor secret already has one -
if [[ -z "$EGRESS_PROXY_PASSWORD" ]]; then
  VENDOR_JSON="$(aws secretsmanager get-secret-value --secret-id "$VENDOR_SECRET_ARN" --query SecretString --output text)"
  EXISTING_PW="$(jq -r '.SANMAR_VENDOR_PROXY_PASSWORD // empty' <<< "$VENDOR_JSON")"
  EXISTING_USER="$(jq -r '.SANMAR_VENDOR_PROXY_USERNAME // empty' <<< "$VENDOR_JSON")"
  if [[ -n "$EXISTING_PW" ]]; then
    echo "Reusing the proxy credential already on the vendor secret."
    save_shared EGRESS_PROXY_USERNAME "${EXISTING_USER:-gwg}"
    save_shared EGRESS_PROXY_PASSWORD "$EXISTING_PW"
  else
    save_shared EGRESS_PROXY_USERNAME "gwg"
    save_shared EGRESS_PROXY_PASSWORD "$(python3 -c 'import secrets; print(secrets.token_urlsafe(24))')"
    echo "Generated a new proxy credential."
  fi
  unset VENDOR_JSON EXISTING_PW EXISTING_USER
fi

# ---- 5. Launch the instance (skip if one is already running) -------------
INSTANCE_STATE=""
if [[ -n "$EGRESS_INSTANCE_ID" ]]; then
  INSTANCE_STATE="$(aws ec2 describe-instances --instance-ids "$EGRESS_INSTANCE_ID" \
    --query 'Reservations[0].Instances[0].State.Name' --output text 2>/dev/null || echo "gone")"
fi
if [[ "$INSTANCE_STATE" == "running" || "$INSTANCE_STATE" == "pending" ]]; then
  echo "Reusing existing instance $EGRESS_INSTANCE_ID ($INSTANCE_STATE)"
else
  AMI_ID="$(aws ssm get-parameter \
    --name /aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-x86_64 \
    --query 'Parameter.Value' --output text)"

  # tinyproxy is not in Amazon Linux 2023's repos ("No match for argument:
  # tinyproxy" — confirmed 28 Sep 2026 via SSM against the first attempt's
  # cloud-init log, which is also why that attempt never got past this
  # point). Python is guaranteed present instead — cloud-init itself runs on
  # it — so the relay is a small standalone Python script rather than a
  # package that may or may not exist on this image.
  USER_DATA_FILE="$(mktemp)"
  cat > "$USER_DATA_FILE" <<USERDATA
#!/bin/bash
set -e
mkdir -p /opt
cat > /opt/vendor-proxy.py <<'PYEOF'
#!/usr/bin/env python3
"""CONNECT-only forward proxy, locked to a fixed set of destination hosts and
gated by Basic Auth. Exists because SanMar registers one static address per
account and ECS has no fixed outbound address of its own — see the doc comment
on SanmarClientOptions.vendorProxyUrl in adapters/sanmar/client.ts."""
import base64
import os
import socket
import socketserver
import threading

PORT = 8888
ALLOWED_HOSTS = {"edi.atc-apparel.com", "api-ca.ssactivewear.com"}
USERNAME = os.environ.get("PROXY_USERNAME", "")
PASSWORD = os.environ.get("PROXY_PASSWORD", "")
EXPECTED_AUTH = "Basic " + base64.b64encode(f"{USERNAME}:{PASSWORD}".encode()).decode()


class ConnectHandler(socketserver.BaseRequestHandler):
    def handle(self):
        self.request.settimeout(15)
        data = b""
        try:
            while b"\r\n\r\n" not in data and len(data) < 8192:
                chunk = self.request.recv(4096)
                if not chunk:
                    return
                data += chunk
        except OSError:
            return

        try:
            request_line, header_blob = data.split(b"\r\n", 1)
            method, target, _ = request_line.decode().split(" ")
        except ValueError:
            return

        if method != "CONNECT":
            self.request.sendall(b"HTTP/1.1 405 Method Not Allowed\r\n\r\n")
            return

        headers = {}
        for line in header_blob.split(b"\r\n"):
            if b":" in line:
                key, _, value = line.partition(b":")
                headers[key.strip().lower().decode()] = value.strip().decode()

        if headers.get("proxy-authorization") != EXPECTED_AUTH:
            self.request.sendall(
                b'HTTP/1.1 407 Proxy Authentication Required\r\n'
                b'Proxy-Authenticate: Basic realm="vendor-egress"\r\n\r\n'
            )
            return

        host, _, port_text = target.partition(":")
        port = int(port_text) if port_text else 443
        if host not in ALLOWED_HOSTS:
            self.request.sendall(b"HTTP/1.1 403 Forbidden\r\n\r\n")
            return

        try:
            upstream = socket.create_connection((host, port), timeout=15)
        except OSError:
            self.request.sendall(b"HTTP/1.1 502 Bad Gateway\r\n\r\n")
            return

        self.request.sendall(b"HTTP/1.1 200 Connection Established\r\n\r\n")
        self._relay(self.request, upstream)

    @staticmethod
    def _relay(client, upstream):
        def pump(src, dst):
            try:
                while True:
                    chunk = src.recv(65536)
                    if not chunk:
                        break
                    dst.sendall(chunk)
            except OSError:
                pass
            finally:
                try:
                    dst.shutdown(socket.SHUT_WR)
                except OSError:
                    pass

        threads = [
            threading.Thread(target=pump, args=(client, upstream)),
            threading.Thread(target=pump, args=(upstream, client)),
        ]
        for t in threads:
            t.start()
        for t in threads:
            t.join()


class ThreadingServer(socketserver.ThreadingMixIn, socketserver.TCPServer):
    allow_reuse_address = True
    daemon_threads = True


if __name__ == "__main__":
    with ThreadingServer(("0.0.0.0", PORT), ConnectHandler) as httpd:
        httpd.serve_forever()
PYEOF
cat > /etc/vendor-proxy.env <<ENVEOF
PROXY_USERNAME=${EGRESS_PROXY_USERNAME}
PROXY_PASSWORD=${EGRESS_PROXY_PASSWORD}
ENVEOF
chmod 600 /etc/vendor-proxy.env
cat > /etc/systemd/system/vendor-proxy.service <<'UNITEOF'
[Unit]
Description=Vendor egress proxy (SanMar/S&S only)
After=network.target

[Service]
EnvironmentFile=/etc/vendor-proxy.env
ExecStart=/usr/bin/python3 /opt/vendor-proxy.py
Restart=always
RestartSec=3
User=nobody
Group=nobody

[Install]
WantedBy=multi-user.target
UNITEOF
systemctl daemon-reload
systemctl enable vendor-proxy
systemctl restart vendor-proxy
USERDATA

  EGRESS_INSTANCE_ID="$(aws ec2 run-instances \
    --image-id "$AMI_ID" --instance-type t3.micro \
    --subnet-id "$EGRESS_SUBNET_ID" --security-group-ids "$EGRESS_SG_ID" \
    --associate-public-ip-address \
    --iam-instance-profile Name="$PROFILE_NAME" \
    --user-data "file://$USER_DATA_FILE" \
    --tag-specifications "ResourceType=instance,Tags=[{Key=Name,Value=$BOX_NAME}]" \
    --query 'Instances[0].InstanceId' --output text)"
  rm -f "$USER_DATA_FILE"
  save_shared EGRESS_INSTANCE_ID "$EGRESS_INSTANCE_ID"
  echo "Launched instance $EGRESS_INSTANCE_ID — waiting for it to reach running..."
  aws ec2 wait instance-running --instance-ids "$EGRESS_INSTANCE_ID"
fi

# ---- 6. Elastic IP — the address SanMar actually needs on file ------------
if [[ -z "$EGRESS_ALLOCATION_ID" ]]; then
  EGRESS_ALLOCATION_ID="$(aws ec2 allocate-address --domain vpc \
    --tag-specifications "ResourceType=elastic-ip,Tags=[{Key=Name,Value=$BOX_NAME}]" \
    --query 'AllocationId' --output text)"
  save_shared EGRESS_ALLOCATION_ID "$EGRESS_ALLOCATION_ID"
  echo "Allocated Elastic IP $EGRESS_ALLOCATION_ID"
fi
aws ec2 associate-address --instance-id "$EGRESS_INSTANCE_ID" \
  --allocation-id "$EGRESS_ALLOCATION_ID" >/dev/null
EGRESS_PUBLIC_IP="$(aws ec2 describe-addresses --allocation-ids "$EGRESS_ALLOCATION_ID" \
  --query 'Addresses[0].PublicIp' --output text)"
save_shared EGRESS_PUBLIC_IP "$EGRESS_PUBLIC_IP"

PROXY_URL="http://${EGRESS_PUBLIC_IP}:${PROXY_PORT}"

# ---- 7. Verify the proxy is actually answering before touching secrets ----
echo "Waiting for tinyproxy to come up on $PROXY_URL (user-data takes a minute after first boot)..."
VERIFIED=false
for _ in $(seq 1 12); do
  if curl -sS -m 8 -o /dev/null -w '%{http_code}' \
      -x "http://${EGRESS_PROXY_USERNAME}:${EGRESS_PROXY_PASSWORD}@${EGRESS_PUBLIC_IP}:${PROXY_PORT}" \
      "https://edi.atc-apparel.com/bulk-data/BulkDataService.php?wsdl" 2>/dev/null | grep -q '^2'; then
    VERIFIED=true
    break
  fi
  sleep 10
done
if [[ "$VERIFIED" == "true" ]]; then
  echo "Verified: the proxy forwards to SanMar and the sign-in credential works."
else
  echo "Could not verify the proxy yet — it may still be finishing setup." >&2
  echo "Re-run this script in a minute; it will reuse everything and just re-check." >&2
fi

# ---- 8. Wire this environment's vendor secret and running API task -------
merge_secret_key() {
  local secret_id="$1" key="$2" value="$3" current updated
  current="$(aws secretsmanager get-secret-value --secret-id "$secret_id" --query SecretString --output text)"
  updated="$(jq -c --arg key "$key" --arg value "$value" '.[$key]=$value' <<< "$current")"
  aws secretsmanager put-secret-value --secret-id "$secret_id" --secret-string "$updated" >/dev/null
}
merge_secret_key "$VENDOR_SECRET_ARN" SANMAR_VENDOR_PROXY_URL "$PROXY_URL"
merge_secret_key "$VENDOR_SECRET_ARN" SANMAR_VENDOR_PROXY_USERNAME "$EGRESS_PROXY_USERNAME"
merge_secret_key "$VENDOR_SECRET_ARN" SANMAR_VENDOR_PROXY_PASSWORD "$EGRESS_PROXY_PASSWORD"
echo "Wrote the proxy URL and credential into $VENDOR_SECRET_ARN"

attach_secret() {
  local family="$1" env_name="$2" value_from="$3"
  python3 - "$family" "$env_name" "$value_from" "$CLUSTER" "$AWS_REGION" <<'PY'
import json, subprocess, sys
family, env_name, value_from, cluster, region = sys.argv[1:6]
raw = subprocess.check_output(
    ["aws", "ecs", "describe-task-definition", "--task-definition", family, "--region", region],
    text=True,
)
td = json.loads(raw)["taskDefinition"]
container = td["containerDefinitions"][0]
secrets = container.setdefault("secrets", [])
if any(item.get("name") == env_name for item in secrets):
    print(f"{family} already injects {env_name}")
    raise SystemExit(0)
secrets.append({"name": env_name, "valueFrom": value_from})
for k in ("taskDefinitionArn", "revision", "status", "requiresAttributes",
          "compatibilities", "registeredAt", "registeredBy", "deregisteredAt"):
    td.pop(k, None)
path = "/tmp/gwg-td-vendor-egress.json"
open(path, "w").write(json.dumps(td))
reg = subprocess.check_output(
    ["aws", "ecs", "register-task-definition", "--cli-input-json", f"file://{path}", "--region", region],
    text=True,
)
arn = json.loads(reg)["taskDefinition"]["taskDefinitionArn"]
subprocess.check_call([
    "aws", "ecs", "update-service", "--cluster", cluster, "--service", family,
    "--task-definition", arn, "--force-new-deployment", "--region", region,
    "--query", "service.serviceName", "--output", "text",
])
print(f"Attached {env_name} on {family}")
PY
}
attach_secret "$NAME_PREFIX-api" SANMAR_VENDOR_PROXY_URL "${VENDOR_SECRET_ARN}:SANMAR_VENDOR_PROXY_URL::"
attach_secret "$NAME_PREFIX-api" SANMAR_VENDOR_PROXY_USERNAME "${VENDOR_SECRET_ARN}:SANMAR_VENDOR_PROXY_USERNAME::"
attach_secret "$NAME_PREFIX-api" SANMAR_VENDOR_PROXY_PASSWORD "${VENDOR_SECRET_ARN}:SANMAR_VENDOR_PROXY_PASSWORD::"

echo
echo "Done. $NAME_PREFIX-api will pick this up once its new task is running"
echo "(check with 22-wait-ecs.sh or the ECS console — pending should return to 0)."
echo
echo "The one address to send SanMar for account 161's static-IP field:"
echo "  $EGRESS_PUBLIC_IP"
echo
echo "Do not send the proxy username/password anywhere outside AWS Secrets"
echo "Manager — they are this box's own sign-in, not a SanMar credential."
echo
echo "To wire production once it exists, re-run this exact script with"
echo "CONFIG_FILE=config.env — it will reuse this same box and address and"
echo "only add the wiring for prod's own vendor secret and API task."
