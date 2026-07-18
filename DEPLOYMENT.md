# AWS ECS Fargate Deployment

This guide explains how to deploy the React frontend and FastAPI backend to AWS ECS Fargate using CloudFormation YAML templates and the provided deployment scripts.

## Architecture

The deployment creates two CloudFormation stacks:

1. **ECR stack** from `cloudformation/ecr.yml`
   - Frontend ECR repository
   - Backend ECR repository
   - Image scan-on-push configuration
   - Lifecycle policies that retain the most recent images

2. **ECS application stack** from `cloudformation/ecs-fargate.yml`
   - ECS Fargate cluster
   - Internet-facing Application Load Balancer
   - HTTP listener on port `80`
   - Frontend target group
   - Backend target group
   - Path-based routing rules for `/api/*` and `/uploads/*` to the backend
   - Default routing to the frontend
   - Separate frontend and backend ECS services
   - Separate frontend and backend task definitions
   - CloudWatch log groups
   - ECS task execution role and task role
   - ALB and ECS service security groups

The frontend is reachable through the ALB DNS name. Browser requests for frontend routes go to the frontend service. Browser requests for `/api/*` and `/uploads/*` go through the same ALB and are routed to the backend service.

## Prerequisites

Install and configure:

- AWS CLI v2
- Docker
- Bash, macOS/Linux/WSL, or PowerShell 7+
- AWS credentials with permissions for CloudFormation, ECS, ECR, ELBv2, IAM, EC2, and CloudWatch Logs

Confirm your AWS identity:

```bash
aws sts get-caller-identity
```

## Required environment variables

Set these before running a deployment:

```bash
export MONGO_URL='mongodb+srv://user:password@example.mongodb.net/?retryWrites=true&w=majority'
export DB_NAME='dental_app'
export JWT_SECRET='replace-with-a-strong-production-secret'
```

PowerShell:

```powershell
$env:MONGO_URL = 'mongodb+srv://user:password@example.mongodb.net/?retryWrites=true&w=majority'
$env:DB_NAME = 'dental_app'
$env:JWT_SECRET = 'replace-with-a-strong-production-secret'
```

## Optional environment variables

Deployment controls:

| Variable | Default | Description |
| --- | --- | --- |
| `AWS_REGION` | `us-east-1` | AWS region for stacks, ECR, and ECS. |
| `PROJECT_NAME` | `implant` | Prefix for AWS resource names. |
| `ENVIRONMENT_NAME` | `prod` | Environment suffix for AWS resource names. |
| `IMAGE_TAG` | Current Git SHA | Docker image tag. |
| `ECR_STACK_NAME` | `${PROJECT_NAME}-${ENVIRONMENT_NAME}-ecr` | ECR CloudFormation stack name. |
| `APP_STACK_NAME` | `${PROJECT_NAME}-${ENVIRONMENT_NAME}-ecs` | ECS CloudFormation stack name. |
| `VPC_ID` | Default VPC | VPC for ALB and ECS services. |
| `SUBNET_IDS` | Default public subnets | Comma-separated subnet IDs. |

Backend runtime configuration:

| Variable | Default |
| --- | --- |
| `APP_ENV` | `production` |
| `CORS_ORIGINS` | `*` |
| `JWT_ALGORITHM` | `HS256` |
| `JWT_EXPIRE_DAYS` | `7` |
| `WEB_CONCURRENCY` | `2` |
| `GUNICORN_TIMEOUT` | `120` |
| `TWILIO_ACCOUNT_SID` | empty |
| `TWILIO_AUTH_TOKEN` | empty |
| `TWILIO_WHATSAPP_FROM` | empty |
| `TWILIO_TEMPLATE_SID` | empty |
| `EMERGENT_LLM_KEY` | empty |
| `OPENAI_API_KEY` | empty |
| `SPEECH_TO_TEXT_PROVIDER` | `openai_whisper` |
| `SPEECH_TO_TEXT_MODEL` | `whisper-1` |
| `SPEECH_TO_TEXT_LANGUAGE` | empty |
| `SPEECH_TO_TEXT_TIMEOUT_SECONDS` | `30` |
| `SPEECH_TO_TEXT_MAX_BYTES` | `25000000` |
| `INTENT_ENGINE` | `openai` |
| `INTENT_ENGINE_PROVIDER` | `openai` |
| `INTENT_ENGINE_MODEL` | `gpt-5.4` |
| `INTENT_ENGINE_TIMEOUT_SECONDS` | `15` |
| `VOICE_CONFIDENCE_THRESHOLD` | empty |
| `FILE_STORAGE_DRIVER` | `local` |
| `LOCAL_UPLOADS_DIR` | `/app/uploads` |

Frontend runtime configuration:

| Variable | Default | Description |
| --- | --- | --- |
| `REACT_APP_BACKEND_URL` | empty | Leave empty for same-origin ALB `/api` routing. Set only when the frontend should call a separate backend origin. |
| `REACT_APP_POSTHOG_KEY` | empty | PostHog project API key. |
| `REACT_APP_POSTHOG_HOST` | `https://us.i.posthog.com` | PostHog host. |
| `REACT_APP_DEMO_MODE` | `false` | Enables demo mode when set to `true`. |

## Deploy from macOS, Linux, or WSL

```bash
chmod +x deploy.sh
./deploy.sh
```

The script is idempotent. It can be run repeatedly to rebuild images, push a new image tag, update CloudFormation stacks, and wait for ECS services to stabilize.

## Deploy from PowerShell

```powershell
./deploy.ps1
```

The PowerShell script performs the same workflow as `deploy.sh`.

## What the scripts do

1. Validate required tools and required environment variables.
2. Discover the AWS account ID.
3. Discover the default VPC and default public subnets unless `VPC_ID` and `SUBNET_IDS` are provided.
4. Deploy or update the ECR CloudFormation stack.
5. Read the ECR repository URIs from stack outputs.
6. Authenticate Docker to ECR.
7. Build the frontend and backend Docker images.
8. Push both images to ECR.
9. Deploy or update the ECS CloudFormation stack with the pushed image URIs and runtime parameters.
10. Wait for both ECS services to become stable.
11. Print the application URL.

## CloudFormation outputs

The ECR stack outputs:

- `FrontendRepositoryUri`
- `BackendRepositoryUri`

The ECS stack outputs:

- `AlbDnsName`
- `ApplicationUrl`
- `EcsClusterName`
- `FrontendServiceName`
- `BackendServiceName`
- `FrontendTaskDefinitionArn`
- `BackendTaskDefinitionArn`
- `FrontendTargetGroupArn`
- `BackendTargetGroupArn`

## Security notes

- The provided listener is HTTP only because that was explicitly requested. For production internet traffic, add an ACM certificate and HTTPS listener when TLS is required.
- CloudFormation parameters marked `NoEcho` hide values in many CLI and console views, but plaintext environment variables can still be visible to principals with ECS task definition access. For stricter production secret handling, replace sensitive environment variables with ECS secrets sourced from AWS Secrets Manager or SSM Parameter Store.
- The backend service is not directly public. It only accepts traffic from the ALB security group.
- The tasks run in public subnets by default to match the requirement to reuse default public subnets. For hardened production deployments, use private subnets plus NAT or VPC endpoints.

## Troubleshooting

Check stack events:

```bash
aws cloudformation describe-stack-events --stack-name implant-prod-ecs
```

Check ECS services:

```bash
aws ecs describe-services --cluster implant-prod --services implant-prod-frontend implant-prod-backend
```

View logs:

```bash
aws logs tail /ecs/implant/prod/frontend --follow
aws logs tail /ecs/implant/prod/backend --follow
```

Delete the ECS stack:

```bash
aws cloudformation delete-stack --stack-name implant-prod-ecs
```

Delete the ECR stack after deleting images or repositories that still contain images:

```bash
aws cloudformation delete-stack --stack-name implant-prod-ecr
```
