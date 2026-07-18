#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_NAME="${PROJECT_NAME:-implant}"
ENVIRONMENT_NAME="${ENVIRONMENT_NAME:-prod}"
AWS_REGION="${AWS_REGION:-${AWS_DEFAULT_REGION:-us-east-1}}"
ECR_STACK_NAME="${ECR_STACK_NAME:-${PROJECT_NAME}-${ENVIRONMENT_NAME}-ecr}"
APP_STACK_NAME="${APP_STACK_NAME:-${PROJECT_NAME}-${ENVIRONMENT_NAME}-ecs}"
NETWORK_STACK_NAME="${NETWORK_STACK_NAME:-${PROJECT_NAME}-${ENVIRONMENT_NAME}-network}"
APP_SECRET_NAME="${APP_SECRET_NAME:-/${PROJECT_NAME}/${ENVIRONMENT_NAME}/app}"
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

aws cloudformation deploy   --stack-name "${NETWORK_STACK_NAME}"   --template-file "${ROOT_DIR}/cloudformation/network.yml"   --parameter-overrides     ProjectName="${PROJECT_NAME}"     EnvironmentName="${ENVIRONMENT_NAME}"     VpcCidr="${VPC_CIDR:-10.100.0.0/16}"     PublicSubnet1Cidr="${PUBLIC_SUBNET_1_CIDR:-10.100.0.0/24}"     PublicSubnet2Cidr="${PUBLIC_SUBNET_2_CIDR:-10.100.1.0/24}"   --region "${AWS_REGION}"

VPC_ID="$(aws cloudformation describe-stacks --stack-name "${NETWORK_STACK_NAME}" --query "Stacks[0].Outputs[?OutputKey=='VpcId'].OutputValue" --output text --region "${AWS_REGION}")"
SUBNET_IDS="$(aws cloudformation describe-stacks --stack-name "${NETWORK_STACK_NAME}" --query "Stacks[0].Outputs[?OutputKey=='PublicSubnetIds'].OutputValue" --output text --region "${AWS_REGION}")"

SECRET_JSON="$(python3 - <<'PYSECRET'
import json, os
keys = {
    'MONGO_URL': os.environ.get('MONGO_URL', ''),
    'JWT_SECRET': os.environ.get('JWT_SECRET', ''),
    'TWILIO_ACCOUNT_SID': os.environ.get('TWILIO_ACCOUNT_SID', ''),
    'TWILIO_AUTH_TOKEN': os.environ.get('TWILIO_AUTH_TOKEN', ''),
    'REACT_APP_POSTHOG_KEY': os.environ.get('REACT_APP_POSTHOG_KEY') or os.environ.get('POSTHOG_API_KEY', ''),
    'EMERGENT_LLM_KEY': os.environ.get('EMERGENT_LLM_KEY', ''),
    'OPENAI_API_KEY': os.environ.get('OPENAI_API_KEY', ''),
}
print(json.dumps(keys, separators=(',', ':')))
PYSECRET
)"

if aws secretsmanager describe-secret --secret-id "${APP_SECRET_NAME}" --region "${AWS_REGION}" >/dev/null 2>&1; then
  aws secretsmanager put-secret-value --secret-id "${APP_SECRET_NAME}" --secret-string "${SECRET_JSON}" --region "${AWS_REGION}" >/dev/null
else
  aws secretsmanager create-secret --name "${APP_SECRET_NAME}" --secret-string "${SECRET_JSON}" --region "${AWS_REGION}" >/dev/null
fi
APP_SECRET_ARN="$(aws secretsmanager describe-secret --secret-id "${APP_SECRET_NAME}" --query ARN --output text --region "${AWS_REGION}")"

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
  AppSecretArn="${APP_SECRET_ARN}"
  DbName="${DB_NAME}"
  JwtAlgorithm="${JWT_ALGORITHM:-HS256}"
  JwtExpireDays="${JWT_EXPIRE_DAYS:-7}"
  CorsOrigins="${CORS_ORIGINS:-*}"
  AppEnv="${APP_ENV:-production}"
  WebConcurrency="${WEB_CONCURRENCY:-2}"
  GunicornTimeout="${GUNICORN_TIMEOUT:-120}"
  TwilioWhatsappFrom="${TWILIO_WHATSAPP_FROM:-}"
  TwilioTemplateSid="${TWILIO_TEMPLATE_SID:-}"
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
