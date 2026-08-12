variable "project_name" {
  type        = string
  description = "Short name used for resource prefixes (e.g. gwg)."
  default     = "gwg"
}

variable "environment" {
  type        = string
  description = "Environment label (prod, staging)."
  default     = "prod"
}

variable "aws_region" {
  type        = string
  description = "Primary AWS region. App Cognito defaults match ca-central-1."
  default     = "ca-central-1"
}

variable "vpc_cidr" {
  type    = string
  default = "10.40.0.0/16"
}

variable "availability_zones" {
  type        = list(string)
  description = "Two AZs for public/private subnets."
  default     = ["ca-central-1a", "ca-central-1b"]
}

variable "web_domain" {
  type        = string
  description = "Public hostname for the Next.js storefront (e.g. www.greatwestgraphics.com). Leave empty for HTTP-only ALB during first bring-up."
  default     = ""
}

variable "api_domain" {
  type        = string
  description = "Public hostname for commerce-api (e.g. api.greatwestgraphics.com)."
  default     = ""
}

variable "route53_zone_id" {
  type        = string
  description = "Optional hosted zone ID. When set with domains, creates A/AAAA aliases to the ALB."
  default     = ""
}

variable "enable_https" {
  type        = bool
  description = "Provision ACM certificate + HTTPS listener. Requires web_domain and api_domain."
  default     = false
}

variable "github_org_repo" {
  type        = string
  description = "GitHub repository allowed to assume the deploy role via OIDC (org/repo)."
  default     = "Samerth/Greatwestgraphics"
}

variable "github_branch" {
  type        = string
  description = "Branch allowed to deploy (refs/heads/<branch>)."
  default     = "main"
}

variable "web_desired_count" {
  type    = number
  default = 2
}

variable "api_desired_count" {
  type    = number
  default = 2
}

variable "web_cpu" {
  type    = number
  default = 512
}

variable "web_memory" {
  type    = number
  default = 1024
}

variable "api_cpu" {
  type    = number
  default = 512
}

variable "api_memory" {
  type    = number
  default = 1024
}

variable "db_instance_class" {
  type    = string
  default = "db.t4g.micro"
}

variable "db_multi_az" {
  type    = bool
  default = false
}

variable "db_name" {
  type    = string
  default = "great_west_graphics"
}

variable "db_username" {
  type    = string
  default = "gwg_app"
}

variable "image_tag" {
  type        = string
  description = "Container image tag referenced by ECS task definitions (CI pushes this tag)."
  default     = "latest"
}

variable "create_ecs_services" {
  type        = bool
  description = "Set false on the first apply so ECR exists before images are pushed; then set true."
  default     = true
}

variable "staff_admin_user" {
  type        = string
  description = "Initial staff login username stored in Secrets Manager (change after cutover)."
  default     = "admin"
  sensitive   = true
}

variable "contact_from_email" {
  type    = string
  default = "Great West Graphics <noreply@greatwestgraphics.com>"
}

variable "contact_to_email" {
  type    = string
  default = "info@greatwestgraphics.com"
}

variable "create_github_oidc_provider" {
  type        = bool
  description = "Create the GitHub Actions OIDC provider. Set false if the account already has token.actions.githubusercontent.com."
  default     = true
}

variable "github_oidc_provider_arn" {
  type        = string
  description = "Existing GitHub OIDC provider ARN when create_github_oidc_provider=false."
  default     = ""
}
