#!/usr/bin/env bash
set -euo pipefail
PROJECT_NAME="${PROJECT_NAME:-implant}"
ENVIRONMENT_NAME="${ENVIRONMENT_NAME:-prod}"
AWS_REGION="${AWS_REGION:-${AWS_DEFAULT_REGION:-us-east-1}}"
ECR_STACK_NAME="${ECR_STACK_NAME:-${PROJECT_NAME}-${ENVIRONMENT_NAME}-ecr}"
APP_STACK_NAME="${APP_STACK_NAME:-${PROJECT_NAME}-${ENVIRONMENT_NAME}-ecs}"
NETWORK_STACK_NAME="${NETWORK_STACK_NAME:-${PROJECT_NAME}-${ENVIRONMENT_NAME}-network}"
APP_SECRET_NAME="${APP_SECRET_NAME:-/${PROJECT_NAME}/${ENVIRONMENT_NAME}/app}"
DELETE_ECR="${DELETE_ECR:-false}"
DELETE_LOG_GROUPS="${DELETE_LOG_GROUPS:-false}"
DELETE_SECRET="${DELETE_SECRET:-false}"

read -r -p "Delete ${APP_STACK_NAME} and ${NETWORK_STACK_NAME} in ${AWS_REGION}? Type 'delete' to continue: " CONFIRM
[[ "${CONFIRM}" == "delete" ]] || { echo "Aborted."; exit 1; }

if aws cloudformation describe-stacks --stack-name "${APP_STACK_NAME}" --region "${AWS_REGION}" >/dev/null 2>&1; then
  aws cloudformation delete-stack --stack-name "${APP_STACK_NAME}" --region "${AWS_REGION}"
  aws cloudformation wait stack-delete-complete --stack-name "${APP_STACK_NAME}" --region "${AWS_REGION}"
fi

if [[ "${DELETE_LOG_GROUPS}" == "true" ]]; then
  aws logs delete-log-group --log-group-name "/ecs/${PROJECT_NAME}/${ENVIRONMENT_NAME}/frontend" --region "${AWS_REGION}" 2>/dev/null || true
  aws logs delete-log-group --log-group-name "/ecs/${PROJECT_NAME}/${ENVIRONMENT_NAME}/backend" --region "${AWS_REGION}" 2>/dev/null || true
fi

if aws cloudformation describe-stacks --stack-name "${NETWORK_STACK_NAME}" --region "${AWS_REGION}" >/dev/null 2>&1; then
  aws cloudformation delete-stack --stack-name "${NETWORK_STACK_NAME}" --region "${AWS_REGION}"
  aws cloudformation wait stack-delete-complete --stack-name "${NETWORK_STACK_NAME}" --region "${AWS_REGION}"
fi

if [[ "${DELETE_SECRET}" == "true" ]]; then
  aws secretsmanager delete-secret --secret-id "${APP_SECRET_NAME}" --force-delete-without-recovery --region "${AWS_REGION}" 2>/dev/null || true
fi

if [[ "${DELETE_ECR}" == "true" ]]; then
  aws ecr delete-repository --repository-name "${PROJECT_NAME}/frontend" --force --region "${AWS_REGION}" 2>/dev/null || true
  aws ecr delete-repository --repository-name "${PROJECT_NAME}/backend" --force --region "${AWS_REGION}" 2>/dev/null || true
  if aws cloudformation describe-stacks --stack-name "${ECR_STACK_NAME}" --region "${AWS_REGION}" >/dev/null 2>&1; then
    aws cloudformation delete-stack --stack-name "${ECR_STACK_NAME}" --region "${AWS_REGION}" || true
  fi
fi

echo "Destroy complete."
