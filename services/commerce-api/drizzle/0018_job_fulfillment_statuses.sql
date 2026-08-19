ALTER TYPE "job_request_status" ADD VALUE IF NOT EXISTS 'in_production';
ALTER TYPE "job_request_status" ADD VALUE IF NOT EXISTS 'ready_for_pickup';
ALTER TYPE "job_request_status" ADD VALUE IF NOT EXISTS 'shipped';
ALTER TYPE "job_request_status" ADD VALUE IF NOT EXISTS 'completed';
ALTER TYPE "job_request_status" ADD VALUE IF NOT EXISTS 'cancelled';
