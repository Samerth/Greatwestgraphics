resource "random_password" "staff_session" {
  length  = 48
  special = false
}

resource "random_password" "customer_session" {
  length  = 48
  special = false
}

resource "random_password" "staff_admin_password" {
  length  = 24
  special = false
}

resource "aws_secretsmanager_secret" "app" {
  name                    = "${local.name_prefix}/app"
  description             = "Great West Graphics application secrets (web + API)."
  recovery_window_in_days = var.environment == "prod" ? 30 : 0
}

resource "aws_secretsmanager_secret_version" "app" {
  secret_id = aws_secretsmanager_secret.app.id
  secret_string = jsonencode({
    DATABASE_URL              = local.database_url
    STAFF_ADMIN_USER          = var.staff_admin_user
    STAFF_ADMIN_PASSWORD      = random_password.staff_admin_password.result
    STAFF_SESSION_SECRET      = random_password.staff_session.result
    CUSTOMER_SESSION_SECRET   = random_password.customer_session.result
    COGNITO_REGION            = var.aws_region
    COGNITO_USER_POOL_ID      = aws_cognito_user_pool.customers.id
    COGNITO_APP_CLIENT_ID     = aws_cognito_user_pool_client.web.id
    COGNITO_APP_CLIENT_SECRET = aws_cognito_user_pool_client.web.client_secret
    AWS_S3_BUCKET             = aws_s3_bucket.uploads.bucket
    AWS_REGION                = var.aws_region
    CONTACT_FROM_EMAIL        = var.contact_from_email
    CONTACT_TO_EMAIL          = var.contact_to_email
    # Fill these in the console (or a follow-up secret version) before vendor sync:
    RESEND_API_KEY        = ""
    SS_ACCOUNT_NUMBER     = ""
    SS_API_KEY            = ""
    SANMAR_ACCOUNT_ID     = ""
    SANMAR_LOGIN_EMAIL    = ""
    SANMAR_MEDIA_PASSWORD = ""
  })
}
