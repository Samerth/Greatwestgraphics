resource "aws_cloudwatch_log_group" "web" {
  name              = "/ecs/${local.name_prefix}-web"
  retention_in_days = 30
}

resource "aws_cloudwatch_log_group" "api" {
  name              = "/ecs/${local.name_prefix}-api"
  retention_in_days = 30
}

resource "aws_ecs_cluster" "main" {
  name = local.name_prefix

  setting {
    name  = "containerInsights"
    value = "enabled"
  }
}

resource "aws_service_discovery_private_dns_namespace" "main" {
  name        = "${local.name_prefix}.local"
  description = "Private DNS for ECS services"
  vpc         = aws_vpc.main.id
}

resource "aws_service_discovery_service" "api" {
  name = "api"

  dns_config {
    namespace_id = aws_service_discovery_private_dns_namespace.main.id
    dns_records {
      ttl  = 10
      type = "A"
    }
    routing_policy = "MULTIVALUE"
  }

  health_check_custom_config {
    failure_threshold = 1
  }
}

locals {
  # Web talks to API over Cloud Map (private). Public api_domain is for browsers/tools.
  commerce_api_base_url = "http://api.${local.name_prefix}.local:4000"
  site_url = (
    var.web_domain != ""
    ? (var.enable_https ? "https://${var.web_domain}" : "http://${var.web_domain}")
    : "http://${aws_lb.main.dns_name}"
  )
}

resource "aws_iam_role" "ecs_execution" {
  name = "${local.name_prefix}-ecs-execution"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "ecs_execution" {
  role       = aws_iam_role.ecs_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_role_policy" "ecs_execution_secrets" {
  name = "${local.name_prefix}-ecs-execution-secrets"
  role = aws_iam_role.ecs_execution.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["secretsmanager:GetSecretValue"]
      Resource = [aws_secretsmanager_secret.app.arn]
    }]
  })
}

resource "aws_iam_role" "ecs_task" {
  name = "${local.name_prefix}-ecs-task"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy" "ecs_task_s3" {
  name = "${local.name_prefix}-ecs-task-s3"
  role = aws_iam_role.ecs_task.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:ListBucket",
      ]
      Resource = [
        aws_s3_bucket.uploads.arn,
        "${aws_s3_bucket.uploads.arn}/*",
      ]
    }]
  })
}

resource "aws_ecs_task_definition" "api" {
  family                   = "${local.name_prefix}-api"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.api_cpu
  memory                   = var.api_memory
  execution_role_arn       = aws_iam_role.ecs_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([{
    name      = "commerce-api"
    image     = "${aws_ecr_repository.api.repository_url}:${var.image_tag}"
    essential = true
    portMappings = [{
      containerPort = 4000
      hostPort      = 4000
      protocol      = "tcp"
    }]
    environment = [
      { name = "NODE_ENV", value = "production" },
      { name = "COMMERCE_API_HOST", value = "0.0.0.0" },
      { name = "COMMERCE_API_PORT", value = "4000" },
      { name = "ENABLE_DEV_ADMIN_ROUTES", value = "false" },
    ]
    secrets = [
      { name = "DATABASE_URL", valueFrom = "${aws_secretsmanager_secret.app.arn}:DATABASE_URL::" },
      { name = "SS_ACCOUNT_NUMBER", valueFrom = "${aws_secretsmanager_secret.app.arn}:SS_ACCOUNT_NUMBER::" },
      { name = "SS_API_KEY", valueFrom = "${aws_secretsmanager_secret.app.arn}:SS_API_KEY::" },
      { name = "SANMAR_ACCOUNT_ID", valueFrom = "${aws_secretsmanager_secret.app.arn}:SANMAR_ACCOUNT_ID::" },
      { name = "SANMAR_LOGIN_EMAIL", valueFrom = "${aws_secretsmanager_secret.app.arn}:SANMAR_LOGIN_EMAIL::" },
      { name = "SANMAR_MEDIA_PASSWORD", valueFrom = "${aws_secretsmanager_secret.app.arn}:SANMAR_MEDIA_PASSWORD::" },
    ]
    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = aws_cloudwatch_log_group.api.name
        "awslogs-region"        = var.aws_region
        "awslogs-stream-prefix" = "api"
      }
    }
    healthCheck = {
      command     = ["CMD-SHELL", "node -e \"fetch('http://127.0.0.1:4000/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))\""]
      interval    = 30
      timeout     = 5
      retries     = 3
      startPeriod = 20
    }
  }])
}

resource "aws_ecs_task_definition" "web" {
  family                   = "${local.name_prefix}-web"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.web_cpu
  memory                   = var.web_memory
  execution_role_arn       = aws_iam_role.ecs_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([{
    name      = "web"
    image     = "${aws_ecr_repository.web.repository_url}:${var.image_tag}"
    essential = true
    portMappings = [{
      containerPort = 3000
      hostPort      = 3000
      protocol      = "tcp"
    }]
    environment = [
      { name = "NODE_ENV", value = "production" },
      { name = "PORT", value = "3000" },
      { name = "HOSTNAME", value = "0.0.0.0" },
      { name = "COMMERCE_API_BASE_URL", value = local.commerce_api_base_url },
      { name = "NEXT_PUBLIC_SITE_URL", value = local.site_url },
      { name = "AWS_S3_BUCKET", value = aws_s3_bucket.uploads.bucket },
      { name = "AWS_REGION", value = var.aws_region },
      { name = "COGNITO_REGION", value = var.aws_region },
      { name = "CONTACT_FROM_EMAIL", value = var.contact_from_email },
      { name = "CONTACT_TO_EMAIL", value = var.contact_to_email },
    ]
    secrets = [
      { name = "STAFF_ADMIN_USER", valueFrom = "${aws_secretsmanager_secret.app.arn}:STAFF_ADMIN_USER::" },
      { name = "STAFF_ADMIN_PASSWORD", valueFrom = "${aws_secretsmanager_secret.app.arn}:STAFF_ADMIN_PASSWORD::" },
      { name = "STAFF_SESSION_SECRET", valueFrom = "${aws_secretsmanager_secret.app.arn}:STAFF_SESSION_SECRET::" },
      { name = "CUSTOMER_SESSION_SECRET", valueFrom = "${aws_secretsmanager_secret.app.arn}:CUSTOMER_SESSION_SECRET::" },
      { name = "COGNITO_USER_POOL_ID", valueFrom = "${aws_secretsmanager_secret.app.arn}:COGNITO_USER_POOL_ID::" },
      { name = "COGNITO_APP_CLIENT_ID", valueFrom = "${aws_secretsmanager_secret.app.arn}:COGNITO_APP_CLIENT_ID::" },
      { name = "COGNITO_APP_CLIENT_SECRET", valueFrom = "${aws_secretsmanager_secret.app.arn}:COGNITO_APP_CLIENT_SECRET::" },
      { name = "RESEND_API_KEY", valueFrom = "${aws_secretsmanager_secret.app.arn}:RESEND_API_KEY::" },
    ]
    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = aws_cloudwatch_log_group.web.name
        "awslogs-region"        = var.aws_region
        "awslogs-stream-prefix" = "web"
      }
    }
    healthCheck = {
      command     = ["CMD-SHELL", "node -e \"fetch('http://127.0.0.1:3000/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))\""]
      interval    = 30
      timeout     = 5
      retries     = 3
      startPeriod = 40
    }
  }])
}

resource "aws_ecs_service" "api" {
  count = var.create_ecs_services ? 1 : 0

  name            = "${local.name_prefix}-api"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.api.arn
  desired_count   = var.api_desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = aws_subnet.private[*].id
    security_groups  = [aws_security_group.api.id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.api.arn
    container_name   = "commerce-api"
    container_port   = 4000
  }

  service_registries {
    registry_arn = aws_service_discovery_service.api.arn
  }

  deployment_minimum_healthy_percent = 50
  deployment_maximum_percent         = 200

  depends_on = [
    aws_lb_listener.http,
    aws_iam_role_policy.ecs_execution_secrets,
  ]

  lifecycle {
    ignore_changes = [desired_count]
  }
}

resource "aws_ecs_service" "web" {
  count = var.create_ecs_services ? 1 : 0

  name            = "${local.name_prefix}-web"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.web.arn
  desired_count   = var.web_desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = aws_subnet.private[*].id
    security_groups  = [aws_security_group.web.id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.web.arn
    container_name   = "web"
    container_port   = 3000
  }

  deployment_minimum_healthy_percent = 50
  deployment_maximum_percent         = 200

  depends_on = [
    aws_lb_listener.http,
    aws_ecs_service.api,
    aws_iam_role_policy.ecs_execution_secrets,
  ]

  lifecycle {
    ignore_changes = [desired_count]
  }
}
