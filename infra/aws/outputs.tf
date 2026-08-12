output "aws_region" {
  value = var.aws_region
}

output "vpc_id" {
  value = aws_vpc.main.id
}

output "alb_dns_name" {
  value       = aws_lb.main.dns_name
  description = "Temporary public URL before custom domains are attached."
}

output "web_url" {
  value = local.site_url
}

output "commerce_api_base_url_internal" {
  value       = local.commerce_api_base_url
  description = "Private Cloud Map URL used by the web tasks."
}

output "ecr_web_repository_url" {
  value = aws_ecr_repository.web.repository_url
}

output "ecr_api_repository_url" {
  value = aws_ecr_repository.api.repository_url
}

output "ecs_cluster_name" {
  value = aws_ecs_cluster.main.name
}

output "ecs_web_service_name" {
  value = try(aws_ecs_service.web[0].name, null)
}

output "ecs_api_service_name" {
  value = try(aws_ecs_service.api[0].name, null)
}

output "s3_uploads_bucket" {
  value = aws_s3_bucket.uploads.bucket
}

output "secrets_manager_secret_arn" {
  value = aws_secretsmanager_secret.app.arn
}

output "cognito_user_pool_id" {
  value = aws_cognito_user_pool.customers.id
}

output "cognito_app_client_id" {
  value     = aws_cognito_user_pool_client.web.id
  sensitive = true
}

output "rds_endpoint" {
  value = aws_db_instance.main.address
}

output "github_deploy_role_arn" {
  value       = aws_iam_role.github_deploy.arn
  description = "Set this as GitHub Actions secret/var AWS_DEPLOY_ROLE_ARN."
}

output "staff_admin_user" {
  value     = var.staff_admin_user
  sensitive = true
}

output "next_steps" {
  value = <<-EOT
    1. Push images: GitHub Actions deploy-aws.yml (or docker push to the ECR URLs above).
    2. If create_ecs_services=false, re-apply with create_ecs_services=true after the first push.
    3. Run migrations from a one-off task / bastion: npm run db:migrate with DATABASE_URL from Secrets Manager.
    4. Update Secrets Manager ${aws_secretsmanager_secret.app.name} with RESEND_*/SS_*/SANMAR_* values.
    5. Set GitHub variable AWS_DEPLOY_ROLE_ARN=${aws_iam_role.github_deploy.arn}
    6. Point DNS (or set enable_https=true + route53_zone_id) at ALB ${aws_lb.main.dns_name}
  EOT
}
