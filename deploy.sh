#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_NAME="${PROJECT_NAME:-implant}"
ENVIRONMENT_NAME="${ENVIRONMENT_NAME:-prod}"
AWS_REGION="${AWS_REGION:-${AWS_DEFAULT_REGION:-us-east-1}}"
ECR_STACK_NAME="${ECR_STACK_NAME:-${PROJECT_NAME}-${ENVIRONMENT_NAME}-ecr}"
APP_STACK_NAME="${APP_STACK_NAME:-${PROJECT_NAME}-${ENVIRONMENT_NAME}-ecs}"
IMAGE_TAG="${IMAGE_TAG:-$(git -C "${ROOT_DIR}" rev-parse --short HEAD 2>/dev/null || date +%Y%m%d%H%M%S)}"
FRONTEND_REPOSITORY_NAME="${PROJECT_NAME}/frontend"
BACKEND_REPOSITORY_NAME="${PROJECT_NAME}/backend"

require() {
  command -v "$1" >/dev/null 2>&1 || { echo "Missing required command: $1" >&2; exit 1; }
}

require aws
require docker

if [[ -z "${MONGO_URL:-}" || -z "${DB_NAME:-}" || -z "${JWT_SECRET:-}" ]]; then
  echo "MONGO_URL, DB_NAME, and JWT_SECRET environment variables are required." >&2
  exit 1
fi

ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text --region "${AWS_REGION}")"

VPC_ID="${VPC_ID:-$(aws ec2 describe-vpcs \
  --filters Name=isDefault,Values=true \
  --query 'Vpcs[0].VpcId' \
  --output text \
  --region "${AWS_REGION}")}"
VPC_ID="$(echo "${VPC_ID}" | xargs)"

if [[ -z "${SUBNET_IDS:-}" ]]; then
  SUBNET_IDS="$(aws ec2 describe-subnets \
    --filters Name=vpc-id,Values="${VPC_ID}" Name=default-for-az,Values=true \
    --query 'Subnets[].SubnetId' \
    --output text \
    --region "${AWS_REGION}" | tr '\t' ',')"
fi

if [[ -z "${VPC_ID}" || "${VPC_ID}" == "None" || -z "${SUBNET_IDS}" ]]; then
  echo "Could not determine default VPC/subnets. Set VPC_ID and SUBNET_IDS explicitly." >&2
  exit 1
fi

aws cloudformation deploy \
  --stack-name "${ECR_STACK_NAME}" \
  --template-file "${ROOT_DIR}/cloudformation/ecr.yml" \
  --parameter-overrides ProjectName="${PROJECT_NAME}" \
  --capabilities CAPABILITY_NAMED_IAM \
  --region "${AWS_REGION}"

FRONTEND_REPOSITORY_URI="$(aws cloudformation describe-stacks \
  --stack-name "${ECR_STACK_NAME}" \
  --query "Stacks[0].Outputs[?OutputKey=='FrontendRepositoryUri'].OutputValue" \
  --output text \
  --region "${AWS_REGION}")"
BACKEND_REPOSITORY_URI="$(aws cloudformation describe-stacks \
  --stack-name "${ECR_STACK_NAME}" \
  --query "Stacks[0].Outputs[?OutputKey=='BackendRepositoryUri'].OutputValue" \
  --output text \
  --region "${AWS_REGION}")"

aws ecr get-login-password --region "${AWS_REGION}" | docker login --username AWS --password-stdin "${ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"

docker build \
  -t "${FRONTEND_REPOSITORY_NAME}:${IMAGE_TAG}" \
  -t "${FRONTEND_REPOSITORY_URI}:${IMAGE_TAG}" \
  -f "${ROOT_DIR}/frontend/Dockerfile" \
  "${ROOT_DIR}/frontend"

docker build \
  -t "${BACKEND_REPOSITORY_NAME}:${IMAGE_TAG}" \
  -t "${BACKEND_REPOSITORY_URI}:${IMAGE_TAG}" \
  -f "${ROOT_DIR}/backend/Dockerfile" \
  "${ROOT_DIR}"

docker push "${FRONTEND_REPOSITORY_URI}:${IMAGE_TAG}"
docker push "${BACKEND_REPOSITORY_URI}:${IMAGE_TAG}"

PARAMS=(
  ProjectName="${PROJECT_NAME}"
  EnvironmentName="${ENVIRONMENT_NAME}"
  VpcId="${VPC_ID}"
  PublicSubnetIds="${SUBNET_IDS}"
  FrontendImageUri="${FRONTEND_REPOSITORY_URI}:${IMAGE_TAG}"
  BackendImageUri="${BACKEND_REPOSITORY_URI}:${IMAGE_TAG}"
  MongoUrl="${MONGO_URL}"
  DbName="${DB_NAME}"
  JwtSecret="${JWT_SECRET}"
  JwtAlgorithm="${JWT_ALGORITHM:-HS256}"
  JwtExpireDays="${JWT_EXPIRE_DAYS:-7}"
  CorsOrigins="${CORS_ORIGINS:-*}"
  AppEnv="${APP_ENV:-production}"
  WebConcurrency="${WEB_CONCURRENCY:-2}"
  GunicornTimeout="${GUNICORN_TIMEOUT:-120}"
  TwilioAccountSid="${TWILIO_ACCOUNT_SID:-}"
  TwilioAuthToken="${TWILIO_AUTH_TOKEN:-}"
  TwilioWhatsappFrom="${TWILIO_WHATSAPP_FROM:-}"
  TwilioTemplateSid="${TWILIO_TEMPLATE_SID:-}"
  EmergentLlmKey="${EMERGENT_LLM_KEY:-}"
  OpenAiApiKey="${OPENAI_API_KEY:-}"
  SpeechToTextProvider="${SPEECH_TO_TEXT_PROVIDER:-openai_whisper}"
  SpeechToTextModel="${SPEECH_TO_TEXT_MODEL:-whisper-1}"
  SpeechToTextLanguage="${SPEECH_TO_TEXT_LANGUAGE:-}"
  SpeechToTextTimeoutSeconds="${SPEECH_TO_TEXT_TIMEOUT_SECONDS:-30}"
  SpeechToTextMaxBytes="${SPEECH_TO_TEXT_MAX_BYTES:-25000000}"
  IntentEngine="${INTENT_ENGINE:-openai}"
  IntentEngineProvider="${INTENT_ENGINE_PROVIDER:-openai}"
  IntentEngineModel="${INTENT_ENGINE_MODEL:-gpt-5.4}"
  IntentEngineTimeoutSeconds="${INTENT_ENGINE_TIMEOUT_SECONDS:-15}"
  VoiceConfidenceThreshold="${VOICE_CONFIDENCE_THRESHOLD:-}"
  FileStorageDriver="${FILE_STORAGE_DRIVER:-local}"
  LocalUploadsDir="${LOCAL_UPLOADS_DIR:-/app/uploads}"
  ReactAppBackendUrl="${REACT_APP_BACKEND_URL:-}"
  ReactAppPosthogKey="${REACT_APP_POSTHOG_KEY:-}"
  ReactAppPosthogHost="${REACT_APP_POSTHOG_HOST:-https://us.i.posthog.com}"
  ReactAppDemoMode="${REACT_APP_DEMO_MODE:-false}"
)

aws cloudformation deploy \
  --stack-name "${APP_STACK_NAME}" \
  --template-file "${ROOT_DIR}/cloudformation/ecs-fargate.yml" \
  --parameter-overrides "${PARAMS[@]}" \
  --capabilities CAPABILITY_NAMED_IAM \
  --region "${AWS_REGION}"

CLUSTER_NAME="$(aws cloudformation describe-stacks --stack-name "${APP_STACK_NAME}" --query "Stacks[0].Outputs[?OutputKey=='EcsClusterName'].OutputValue" --output text --region "${AWS_REGION}")"
FRONTEND_SERVICE_NAME="$(aws cloudformation describe-stacks --stack-name "${APP_STACK_NAME}" --query "Stacks[0].Outputs[?OutputKey=='FrontendServiceName'].OutputValue" --output text --region "${AWS_REGION}")"
BACKEND_SERVICE_NAME="$(aws cloudformation describe-stacks --stack-name "${APP_STACK_NAME}" --query "Stacks[0].Outputs[?OutputKey=='BackendServiceName'].OutputValue" --output text --region "${AWS_REGION}")"
APPLICATION_URL="$(aws cloudformation describe-stacks --stack-name "${APP_STACK_NAME}" --query "Stacks[0].Outputs[?OutputKey=='ApplicationUrl'].OutputValue" --output text --region "${AWS_REGION}")"

aws ecs wait services-stable \
  --cluster "${CLUSTER_NAME}" \
  --services "${FRONTEND_SERVICE_NAME}" "${BACKEND_SERVICE_NAME}" \
  --region "${AWS_REGION}"

echo "Application URL: ${APPLICATION_URL}"
