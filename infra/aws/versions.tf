terraform {
  required_version = ">= 1.6.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }

  # Optional remote state — uncomment after creating the bucket/table once:
  #
  # backend "s3" {
  #   bucket         = "gwg-terraform-state"
  #   key            = "prod/terraform.tfstate"
  #   region         = "ca-central-1"
  #   dynamodb_table = "gwg-terraform-locks"
  #   encrypt        = true
  # }
}
