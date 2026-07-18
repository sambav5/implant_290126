param(
  [string]$ProjectName = $env:PROJECT_NAME,
  [string]$EnvironmentName = $env:ENVIRONMENT_NAME,
  [string]$AwsRegion = $env:AWS_REGION,
  [string]$ImageTag = $env:IMAGE_TAG,
  [string]$VpcId = $env:VPC_ID,
  [string]$SubnetIds = $env:SUBNET_IDS
)

$ErrorActionPreference = 'Stop'

function Require-Command($Name) {
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "Missing required command: $Name"
  }
}

Require-Command aws
Require-Command docker

if ([string]::IsNullOrWhiteSpace($ProjectName)) { $ProjectName = 'implant' }
if ([string]::IsNullOrWhiteSpace($EnvironmentName)) { $EnvironmentName = 'prod' }
if ([string]::IsNullOrWhiteSpace($AwsRegion)) { $AwsRegion = if ($env:AWS_DEFAULT_REGION) { $env:AWS_DEFAULT_REGION } else { 'us-east-1' } }
if ([string]::IsNullOrWhiteSpace($ImageTag)) {
  try { $ImageTag = (git rev-parse --short HEAD).Trim() } catch { $ImageTag = Get-Date -Format 'yyyyMMddHHmmss' }
}

if ([string]::IsNullOrWhiteSpace($env:MONGO_URL) -or [string]::IsNullOrWhiteSpace($env:DB_NAME) -or [string]::IsNullOrWhiteSpace($env:JWT_SECRET)) {
  throw 'MONGO_URL, DB_NAME, and JWT_SECRET environment variables are required.'
}

$RootDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$EcrStackName = if ($env:ECR_STACK_NAME) { $env:ECR_STACK_NAME } else { "$ProjectName-$EnvironmentName-ecr" }
$AppStackName = if ($env:APP_STACK_NAME) { $env:APP_STACK_NAME } else { "$ProjectName-$EnvironmentName-ecs" }
$FrontendRepositoryName = "$ProjectName/frontend"
$BackendRepositoryName = "$ProjectName/backend"
$AccountId = (aws sts get-caller-identity --query Account --output text --region $AwsRegion).Trim()

if ([string]::IsNullOrWhiteSpace($VpcId)) {
  $VpcId = (aws ec2 describe-vpcs --filters Name=isDefault,Values=true --query 'Vpcs[0].VpcId' --output text --region $AwsRegion).Trim()
}
if ([string]::IsNullOrWhiteSpace($SubnetIds)) {
  $SubnetIds = ((aws ec2 describe-subnets --filters Name=vpc-id,Values=$VpcId Name=default-for-az,Values=true --query 'Subnets[].SubnetId' --output text --region $AwsRegion).Trim() -split '\s+') -join ','
}
if ([string]::IsNullOrWhiteSpace($VpcId) -or $VpcId -eq 'None' -or [string]::IsNullOrWhiteSpace($SubnetIds)) {
  throw 'Could not determine default VPC/subnets. Set VPC_ID and SUBNET_IDS explicitly.'
}

aws cloudformation deploy `
  --stack-name $EcrStackName `
  --template-file (Join-Path $RootDir 'cloudformation/ecr.yml') `
  --parameter-overrides ProjectName=$ProjectName `
  --capabilities CAPABILITY_NAMED_IAM `
  --region $AwsRegion

$FrontendRepositoryUri = (aws cloudformation describe-stacks --stack-name $EcrStackName --query "Stacks[0].Outputs[?OutputKey=='FrontendRepositoryUri'].OutputValue" --output text --region $AwsRegion).Trim()
$BackendRepositoryUri = (aws cloudformation describe-stacks --stack-name $EcrStackName --query "Stacks[0].Outputs[?OutputKey=='BackendRepositoryUri'].OutputValue" --output text --region $AwsRegion).Trim()

aws ecr get-login-password --region $AwsRegion | docker login --username AWS --password-stdin "$AccountId.dkr.ecr.$AwsRegion.amazonaws.com"

docker build -t "$FrontendRepositoryName`:$ImageTag" -t "$FrontendRepositoryUri`:$ImageTag" -f (Join-Path $RootDir 'frontend/Dockerfile') (Join-Path $RootDir 'frontend')
docker build -t "$BackendRepositoryName`:$ImageTag" -t "$BackendRepositoryUri`:$ImageTag" -f (Join-Path $RootDir 'backend/Dockerfile') $RootDir

docker push "$FrontendRepositoryUri`:$ImageTag"
docker push "$BackendRepositoryUri`:$ImageTag"

$params = @(
  "ProjectName=$ProjectName",
  "EnvironmentName=$EnvironmentName",
  "VpcId=$VpcId",
  "PublicSubnetIds=$SubnetIds",
  "FrontendImageUri=$FrontendRepositoryUri`:$ImageTag",
  "BackendImageUri=$BackendRepositoryUri`:$ImageTag",
  "MongoUrl=$($env:MONGO_URL)",
  "DbName=$($env:DB_NAME)",
  "JwtSecret=$($env:JWT_SECRET)",
  "JwtAlgorithm=$(if ($env:JWT_ALGORITHM) { $env:JWT_ALGORITHM } else { 'HS256' })",
  "JwtExpireDays=$(if ($env:JWT_EXPIRE_DAYS) { $env:JWT_EXPIRE_DAYS } else { '7' })",
  "CorsOrigins=$(if ($env:CORS_ORIGINS) { $env:CORS_ORIGINS } else { '*' })",
  "AppEnv=$(if ($env:APP_ENV) { $env:APP_ENV } else { 'production' })",
  "WebConcurrency=$(if ($env:WEB_CONCURRENCY) { $env:WEB_CONCURRENCY } else { '2' })",
  "GunicornTimeout=$(if ($env:GUNICORN_TIMEOUT) { $env:GUNICORN_TIMEOUT } else { '120' })",
  "TwilioAccountSid=$($env:TWILIO_ACCOUNT_SID)",
  "TwilioAuthToken=$($env:TWILIO_AUTH_TOKEN)",
  "TwilioWhatsappFrom=$($env:TWILIO_WHATSAPP_FROM)",
  "TwilioTemplateSid=$($env:TWILIO_TEMPLATE_SID)",
  "EmergentLlmKey=$($env:EMERGENT_LLM_KEY)",
  "OpenAiApiKey=$($env:OPENAI_API_KEY)",
  "SpeechToTextProvider=$(if ($env:SPEECH_TO_TEXT_PROVIDER) { $env:SPEECH_TO_TEXT_PROVIDER } else { 'openai_whisper' })",
  "SpeechToTextModel=$(if ($env:SPEECH_TO_TEXT_MODEL) { $env:SPEECH_TO_TEXT_MODEL } else { 'whisper-1' })",
  "SpeechToTextLanguage=$($env:SPEECH_TO_TEXT_LANGUAGE)",
  "SpeechToTextTimeoutSeconds=$(if ($env:SPEECH_TO_TEXT_TIMEOUT_SECONDS) { $env:SPEECH_TO_TEXT_TIMEOUT_SECONDS } else { '30' })",
  "SpeechToTextMaxBytes=$(if ($env:SPEECH_TO_TEXT_MAX_BYTES) { $env:SPEECH_TO_TEXT_MAX_BYTES } else { '25000000' })",
  "IntentEngine=$(if ($env:INTENT_ENGINE) { $env:INTENT_ENGINE } else { 'openai' })",
  "IntentEngineProvider=$(if ($env:INTENT_ENGINE_PROVIDER) { $env:INTENT_ENGINE_PROVIDER } else { 'openai' })",
  "IntentEngineModel=$(if ($env:INTENT_ENGINE_MODEL) { $env:INTENT_ENGINE_MODEL } else { 'gpt-5.4' })",
  "IntentEngineTimeoutSeconds=$(if ($env:INTENT_ENGINE_TIMEOUT_SECONDS) { $env:INTENT_ENGINE_TIMEOUT_SECONDS } else { '15' })",
  "VoiceConfidenceThreshold=$($env:VOICE_CONFIDENCE_THRESHOLD)",
  "FileStorageDriver=$(if ($env:FILE_STORAGE_DRIVER) { $env:FILE_STORAGE_DRIVER } else { 'local' })",
  "LocalUploadsDir=$(if ($env:LOCAL_UPLOADS_DIR) { $env:LOCAL_UPLOADS_DIR } else { '/app/uploads' })",
  "ReactAppBackendUrl=$($env:REACT_APP_BACKEND_URL)",
  "ReactAppPosthogKey=$($env:REACT_APP_POSTHOG_KEY)",
  "ReactAppPosthogHost=$(if ($env:REACT_APP_POSTHOG_HOST) { $env:REACT_APP_POSTHOG_HOST } else { 'https://us.i.posthog.com' })",
  "ReactAppDemoMode=$(if ($env:REACT_APP_DEMO_MODE) { $env:REACT_APP_DEMO_MODE } else { 'false' })"
)

aws cloudformation deploy `
  --stack-name $AppStackName `
  --template-file (Join-Path $RootDir 'cloudformation/ecs-fargate.yml') `
  --parameter-overrides $params `
  --capabilities CAPABILITY_NAMED_IAM `
  --region $AwsRegion

$ClusterName = (aws cloudformation describe-stacks --stack-name $AppStackName --query "Stacks[0].Outputs[?OutputKey=='EcsClusterName'].OutputValue" --output text --region $AwsRegion).Trim()
$FrontendServiceName = (aws cloudformation describe-stacks --stack-name $AppStackName --query "Stacks[0].Outputs[?OutputKey=='FrontendServiceName'].OutputValue" --output text --region $AwsRegion).Trim()
$BackendServiceName = (aws cloudformation describe-stacks --stack-name $AppStackName --query "Stacks[0].Outputs[?OutputKey=='BackendServiceName'].OutputValue" --output text --region $AwsRegion).Trim()
$ApplicationUrl = (aws cloudformation describe-stacks --stack-name $AppStackName --query "Stacks[0].Outputs[?OutputKey=='ApplicationUrl'].OutputValue" --output text --region $AwsRegion).Trim()

aws ecs wait services-stable --cluster $ClusterName --services $FrontendServiceName $BackendServiceName --region $AwsRegion
Write-Host "Application URL: $ApplicationUrl"
