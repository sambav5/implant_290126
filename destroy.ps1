param(
  [string]$ProjectName = $(if ($env:PROJECT_NAME) { $env:PROJECT_NAME } else { 'implant' }),
  [string]$EnvironmentName = $(if ($env:ENVIRONMENT_NAME) { $env:ENVIRONMENT_NAME } else { 'prod' }),
  [string]$AwsRegion = $(if ($env:AWS_REGION) { $env:AWS_REGION } elseif ($env:AWS_DEFAULT_REGION) { $env:AWS_DEFAULT_REGION } else { 'us-east-1' }),
  [switch]$DeleteEcr,
  [switch]$DeleteLogGroups,
  [switch]$DeleteSecret
)
$ErrorActionPreference = 'Stop'
$EcrStackName = if ($env:ECR_STACK_NAME) { $env:ECR_STACK_NAME } else { "$ProjectName-$EnvironmentName-ecr" }
$AppStackName = if ($env:APP_STACK_NAME) { $env:APP_STACK_NAME } else { "$ProjectName-$EnvironmentName-ecs" }
$NetworkStackName = if ($env:NETWORK_STACK_NAME) { $env:NETWORK_STACK_NAME } else { "$ProjectName-$EnvironmentName-network" }
$AppSecretName = if ($env:APP_SECRET_NAME) { $env:APP_SECRET_NAME } else { "/$ProjectName/$EnvironmentName/app" }
$confirm = Read-Host "Delete $AppStackName and $NetworkStackName in $AwsRegion? Type 'delete' to continue"
if ($confirm -ne 'delete') { throw 'Aborted.' }

try {
  aws cloudformation describe-stacks --stack-name $AppStackName --region $AwsRegion | Out-Null
  aws cloudformation delete-stack --stack-name $AppStackName --region $AwsRegion
  aws cloudformation wait stack-delete-complete --stack-name $AppStackName --region $AwsRegion
} catch { }

if ($DeleteLogGroups) {
  aws logs delete-log-group --log-group-name "/ecs/$ProjectName/$EnvironmentName/frontend" --region $AwsRegion 2>$null
  aws logs delete-log-group --log-group-name "/ecs/$ProjectName/$EnvironmentName/backend" --region $AwsRegion 2>$null
}

try {
  aws cloudformation describe-stacks --stack-name $NetworkStackName --region $AwsRegion | Out-Null
  aws cloudformation delete-stack --stack-name $NetworkStackName --region $AwsRegion
  aws cloudformation wait stack-delete-complete --stack-name $NetworkStackName --region $AwsRegion
} catch { }

if ($DeleteSecret) {
  aws secretsmanager delete-secret --secret-id $AppSecretName --force-delete-without-recovery --region $AwsRegion 2>$null
}

if ($DeleteEcr) {
  aws ecr delete-repository --repository-name "$ProjectName/frontend" --force --region $AwsRegion 2>$null
  aws ecr delete-repository --repository-name "$ProjectName/backend" --force --region $AwsRegion 2>$null
  try { aws cloudformation delete-stack --stack-name $EcrStackName --region $AwsRegion } catch { }
}
Write-Host 'Destroy complete.'
