# AWS ECS Fargate Deployment

## Architecture

```text
Internet
  |
  v
Application Load Balancer (HTTP :80)
  |-- /api/*, /uploads/* --> Backend target group --> FastAPI ECS Fargate service (:8001)
  `-- /*                  --> Frontend target group --> React/nginx ECS Fargate service (:80)

Dedicated VPC 10.100.0.0/16
  |-- Public subnet A 10.100.0.0/24
  `-- Public subnet B 10.100.1.0/24

ECR stores images. CloudWatch Logs stores container logs. Secrets Manager stores sensitive runtime values consumed by ECS task secrets.
```

## CloudFormation stacks

- `cloudformation/network.yml` creates the dedicated VPC, two public subnets across two AZs, internet gateway, public route table, default route, and subnet route table associations.
- `cloudformation/ecr.yml` creates frontend/backend ECR repositories and lifecycle policies retaining only the latest 5 images.
- `cloudformation/ecs-fargate.yml` creates the ECS cluster, ALB, listener, target groups, listener rules, ECS services, task definitions, IAM roles, security groups, and CloudWatch log groups.

## Deployment flow

1. Deploy/update the network stack.
2. Create/update a Secrets Manager JSON secret from local environment variables.
3. Deploy/update ECR repositories.
4. Build frontend and backend Docker images.
5. Push images to ECR.
6. Deploy/update the ECS Fargate stack.
7. Wait for both ECS services to become stable.
8. Print the ALB application URL.

## Required local environment variables

```bash
export MONGO_URL='mongodb+srv://user:password@example.mongodb.net/?retryWrites=true&w=majority'
export DB_NAME='dental_app'
export JWT_SECRET='replace-with-a-strong-production-secret'
```

Sensitive values are written to AWS Secrets Manager by the deployment scripts and are not passed to CloudFormation as plaintext parameters.

## Secrets Manager setup

The deploy scripts create or update this secret by default:

```text
/implant/prod/app
```

Override it with `APP_SECRET_NAME`. The secret contains JSON keys consumed through ECS Secrets integration:

- `MONGO_URL`
- `JWT_SECRET`
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `REACT_APP_POSTHOG_KEY` sourced from `REACT_APP_POSTHOG_KEY` or `POSTHOG_API_KEY`
- `EMERGENT_LLM_KEY`
- `OPENAI_API_KEY`

For production hardening, rotate these secrets and restrict read access to the ECS task execution role.

## Optional environment variables

| Variable | Default | Description |
| --- | --- | --- |
| `AWS_REGION` | `us-east-1` | AWS region for stacks, ECR, ECS, and Secrets Manager. |
| `PROJECT_NAME` | `implant` | Resource name prefix. |
| `ENVIRONMENT_NAME` | `prod` | Environment name. |
| `IMAGE_TAG` | Current Git SHA | Docker image tag. |
| `NETWORK_STACK_NAME` | `${PROJECT_NAME}-${ENVIRONMENT_NAME}-network` | Network stack name. |
| `ECR_STACK_NAME` | `${PROJECT_NAME}-${ENVIRONMENT_NAME}-ecr` | ECR stack name. |
| `APP_STACK_NAME` | `${PROJECT_NAME}-${ENVIRONMENT_NAME}-ecs` | ECS stack name. |
| `VPC_CIDR` | `10.100.0.0/16` | Dedicated VPC CIDR. |
| `PUBLIC_SUBNET_1_CIDR` | `10.100.0.0/24` | First public subnet CIDR. |
| `PUBLIC_SUBNET_2_CIDR` | `10.100.1.0/24` | Second public subnet CIDR. |
| `CORS_ORIGINS` | `*` | Backend CORS origins. |
| `REACT_APP_POSTHOG_HOST` | `https://us.i.posthog.com` | PostHog host. |
| `REACT_APP_DEMO_MODE` | `false` | Demo mode toggle. |

## Deploy locally

Bash:

```bash
chmod +x deploy.sh
./deploy.sh
```

PowerShell:

```powershell
./deploy.ps1
```

Both scripts are idempotent and can be run repeatedly.

## GitHub Actions setup

The workflow `.github/workflows/deploy.yml` deploys on pushes to `main` and can also be run manually.

Configure GitHub Secrets:

- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_REGION`
- `MONGO_URL`
- `JWT_SECRET`
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `POSTHOG_API_KEY`
- `EMERGENT_LLM_KEY` or `OPENAI_API_KEY` as required

Configure GitHub Variables as needed:

- `PROJECT_NAME`
- `ENVIRONMENT_NAME`
- `DB_NAME`
- `CORS_ORIGINS`
- `REACT_APP_POSTHOG_HOST`
- Twilio non-secret sender/template values

## ECS Exec usage

ECS Execute Command is enabled on the cluster and both services. After deployment, run:

```bash
aws ecs execute-command \
  --cluster implant-prod \
  --task <task-arn> \
  --container backend \
  --interactive \
  --command "/bin/sh"
```

To find a task ARN:

```bash
aws ecs list-tasks --cluster implant-prod --service-name implant-prod-backend
```

Your IAM principal must have `ecs:ExecuteCommand` permissions. The Session Manager plugin must be installed locally.

## Health checks and rolling deployments

Target groups use explicit `/health` checks with healthy threshold 2, unhealthy threshold 2, interval 30 seconds, and timeout 5 seconds. ECS services use a 60 second grace period and rolling deployment settings of `MinimumHealthyPercent=100` and `MaximumPercent=200` for zero-downtime replacements.

## Rollback procedure

1. Identify the prior image tag in ECR.
2. Re-run `deploy.sh` or `deploy.ps1` with `IMAGE_TAG=<prior-tag>` after retagging locally if needed.
3. Alternatively update the ECS stack parameters `FrontendImageUri` and `BackendImageUri` to the prior ECR image URIs.
4. Wait for services to stabilize and verify `/health` plus application flows.

## Destroy procedure

Bash:

```bash
./destroy.sh
```

PowerShell:

```powershell
./destroy.ps1
```

Optional destructive flags:

```bash
DELETE_ECR=true DELETE_LOG_GROUPS=true DELETE_SECRET=true ./destroy.sh
```

PowerShell equivalents:

```powershell
./destroy.ps1 -DeleteEcr -DeleteLogGroups -DeleteSecret
```

The destroy scripts prompt for confirmation before deleting stacks.

## Troubleshooting

Stack events:

```bash
aws cloudformation describe-stack-events --stack-name implant-prod-ecs
```

Service status:

```bash
aws ecs describe-services --cluster implant-prod --services implant-prod-frontend implant-prod-backend
```

Logs:

```bash
aws logs tail /ecs/implant/prod/frontend --follow
aws logs tail /ecs/implant/prod/backend --follow
```

## MVP cost estimate

Approximate monthly cost in `us-east-1` for a small always-on MVP:

- ALB: about $18-25/month plus LCU usage.
- Frontend Fargate 0.25 vCPU / 0.5 GB: about $9-12/month.
- Backend Fargate 0.5 vCPU / 1 GB: about $18-25/month.
- CloudWatch logs: usually under $5/month at low volume.
- Secrets Manager: about $0.40/month per secret plus API calls.
- ECR storage: usually under $1/month for a few images.

Estimated baseline: roughly $50-70/month before database costs, data transfer, NAT gateways, or high traffic. A managed MongoDB/DocumentDB deployment is additional.

## Future production hardening

- Add HTTPS with ACM and redirect HTTP to HTTPS.
- Move ECS tasks to private subnets and add VPC endpoints or NAT as appropriate.
- Replace plaintext non-secret environment variables with SSM parameters where useful.
- Add autoscaling policies for frontend and backend services.
- Add WAF, access logs, alarms, dashboards, and synthetic canaries.
- Use OIDC federation for GitHub Actions instead of long-lived AWS access keys.
