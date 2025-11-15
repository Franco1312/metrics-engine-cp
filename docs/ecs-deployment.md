# Guía de Despliegue a ECS

Esta guía explica cómo configurar y desplegar el Metrics Engine Control Plane en Amazon ECS usando Fargate.

## 📋 Prerequisitos

1. **Cuenta de AWS** con permisos para:
   - ECS (Elastic Container Service)
   - ECR (Elastic Container Registry)
   - Secrets Manager
   - CloudWatch Logs
   - IAM (para crear roles)

2. **Recursos AWS necesarios**:
   - Cluster de ECS
   - Repositorio en ECR
   - VPC con subnets privadas y públicas
   - Security Groups configurados
   - Secrets en AWS Secrets Manager
   - CloudWatch Log Group

3. **GitHub Secrets configurados**:
   - `AWS_ACCESS_KEY_ID`
   - `AWS_SECRET_ACCESS_KEY`

## 🏗️ Configuración Inicial

### 1. Crear Repositorio ECR

```bash
aws ecr create-repository \
  --repository-name metrics-engine-cp \
  --region us-east-1
```

### 2. Crear Cluster ECS

```bash
aws ecs create-cluster \
  --cluster-name YOUR_CLUSTER_NAME \
  --region us-east-1
```

### 3. Crear CloudWatch Log Group

```bash
aws logs create-log-group \
  --log-group-name /ecs/metrics-engine-cp \
  --region us-east-1
```

### 4. Crear IAM Roles

#### Execution Role (para ECS ejecutar tareas)

Crea un rol con la política `AmazonECSTaskExecutionRolePolicy` y permisos adicionales para:
- Leer secretos de Secrets Manager
- Escribir logs en CloudWatch

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Resource": "*"
    }
  ]
}
```

#### Task Role (para la aplicación)

Crea un rol con permisos para:
- SQS (recibir mensajes, eliminar mensajes)
- SNS (publicar mensajes)
- S3 (leer/escribir objetos)

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "sqs:ReceiveMessage",
        "sqs:DeleteMessage",
        "sqs:GetQueueAttributes",
        "sns:Publish",
        "s3:GetObject",
        "s3:PutObject"
      ],
      "Resource": "*"
    }
  ]
}
```

### 5. Configurar Secrets en Secrets Manager

Crea los siguientes secretos en AWS Secrets Manager:

```bash
# Base de datos
aws secretsmanager create-secret \
  --name metrics-engine/db-host \
  --secret-string "your-db-host"

aws secretsmanager create-secret \
  --name metrics-engine/db-port \
  --secret-string "5432"

aws secretsmanager create-secret \
  --name metrics-engine/db-name \
  --secret-string "metrics_engine"

aws secretsmanager create-secret \
  --name metrics-engine/db-user \
  --secret-string "your-db-user"

aws secretsmanager create-secret \
  --name metrics-engine/db-password \
  --secret-string "your-db-password"

# AWS
aws secretsmanager create-secret \
  --name metrics-engine/aws-region \
  --secret-string "us-east-1"

# SNS
aws secretsmanager create-secret \
  --name metrics-engine/sns-topic-arn \
  --secret-string "arn:aws:sns:us-east-1:ACCOUNT_ID:metric-run-requests"

aws secretsmanager create-secret \
  --name metrics-engine/sns-topic-is-fifo \
  --secret-string "false"

# SQS - Projection Update
aws secretsmanager create-secret \
  --name metrics-engine/sqs-projection-update-queue-url \
  --secret-string "https://sqs.us-east-1.amazonaws.com/ACCOUNT_ID/projection-update"

aws secretsmanager create-secret \
  --name metrics-engine/sqs-projection-update-enabled \
  --secret-string "true"

# SQS - Metric Run Started
aws secretsmanager create-secret \
  --name metrics-engine/sqs-metric-run-started-queue-url \
  --secret-string "https://sqs.us-east-1.amazonaws.com/ACCOUNT_ID/metric-run-started"

aws secretsmanager create-secret \
  --name metrics-engine/sqs-metric-run-started-enabled \
  --secret-string "true"

# SQS - Metric Run Heartbeat
aws secretsmanager create-secret \
  --name metrics-engine/sqs-metric-run-heartbeat-queue-url \
  --secret-string "https://sqs.us-east-1.amazonaws.com/ACCOUNT_ID/metric-run-heartbeat"

aws secretsmanager create-secret \
  --name metrics-engine/sqs-metric-run-heartbeat-enabled \
  --secret-string "true"

# SQS - Metric Run Completed
aws secretsmanager create-secret \
  --name metrics-engine/sqs-metric-run-completed-queue-url \
  --secret-string "https://sqs.us-east-1.amazonaws.com/ACCOUNT_ID/metric-run-completed"

aws secretsmanager create-secret \
  --name metrics-engine/sqs-metric-run-completed-enabled \
  --secret-string "true"

# S3
aws secretsmanager create-secret \
  --name metrics-engine/s3-bucket \
  --secret-string "your-metrics-bucket"
```

**Nota**: Reemplaza `ACCOUNT_ID` con tu Account ID de AWS y ajusta los valores según tu configuración.

### 6. Configurar GitHub Secrets

En tu repositorio de GitHub, ve a **Settings > Secrets and variables > Actions** y agrega:

- `AWS_ACCESS_KEY_ID`: Tu Access Key ID de AWS
- `AWS_SECRET_ACCESS_KEY`: Tu Secret Access Key de AWS

## 📝 Configurar Archivos de ECS

### 1. Actualizar `ecs/task-definition.json`

Edita el archivo `ecs/task-definition.json` y reemplaza:

- `YOUR_ACCOUNT_ID`: Tu Account ID de AWS
- `REGION`: Tu región de AWS (ej: `us-east-1`)
- `ecsTaskExecutionRole`: ARN del rol de ejecución creado
- `ecsTaskRole`: ARN del rol de tarea creado
- Los ARNs de los secretos con los valores correctos

### 2. Actualizar `ecs/service-definition.json`

Edita el archivo `ecs/service-definition.json` y reemplaza:

- `YOUR_CLUSTER_NAME`: Nombre de tu cluster ECS
- `subnet-xxxxxxxxx`, `subnet-yyyyyyyyy`: IDs de tus subnets privadas
- `sg-xxxxxxxxx`: ID de tu security group

### 3. Actualizar `.github/workflows/deploy-ecs.yml`

Edita el workflow y actualiza las variables de entorno:

```yaml
env:
  AWS_REGION: us-east-1  # Tu región
  ECR_REPOSITORY: metrics-engine-cp  # Nombre de tu repositorio ECR
  ECS_CLUSTER: YOUR_CLUSTER_NAME  # Nombre de tu cluster
  ECS_SERVICE: metrics-engine-cp-service  # Nombre de tu servicio
```

## 🚀 Despliegue

### Despliegue Automático

El despliegue se ejecuta automáticamente cuando:

1. Se hace push a la rama `main` o `master`
2. Se ejecuta manualmente desde GitHub Actions (workflow_dispatch)

El workflow:
1. Ejecuta los tests
2. Construye la imagen Docker
3. Sube la imagen a ECR
4. Actualiza la task definition con la nueva imagen
5. Despliega el servicio en ECS

### Despliegue Manual (Primera Vez)

Antes del primer despliegue automático, necesitas crear el servicio en ECS:

```bash
aws ecs create-service \
  --cluster YOUR_CLUSTER_NAME \
  --service-name metrics-engine-cp-service \
  --task-definition metrics-engine-cp \
  --desired-count 2 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[subnet-xxx,subnet-yyy],securityGroups=[sg-xxx],assignPublicIp=DISABLED}" \
  --deployment-configuration "maximumPercent=200,minimumHealthyPercent=100" \
  --region us-east-1
```

O usa el archivo `ecs/service-definition.json`:

```bash
aws ecs create-service \
  --cli-input-json file://ecs/service-definition.json \
  --region us-east-1
```

## 🔍 Verificación

### Verificar el Servicio

```bash
# Ver estado del servicio
aws ecs describe-services \
  --cluster YOUR_CLUSTER_NAME \
  --services metrics-engine-cp-service \
  --region us-east-1

# Ver logs
aws logs tail /ecs/metrics-engine-cp --follow --region us-east-1
```

### Verificar Tareas Ejecutándose

```bash
aws ecs list-tasks \
  --cluster YOUR_CLUSTER_NAME \
  --service-name metrics-engine-cp-service \
  --region us-east-1
```

## 🔧 Troubleshooting

### La tarea no inicia

1. Verifica los logs de CloudWatch
2. Verifica que los secretos existan y sean accesibles
3. Verifica que los roles IAM tengan los permisos correctos
4. Verifica la conectividad de red (subnets, security groups)

### Errores de conexión a la base de datos

1. Verifica que la base de datos esté accesible desde las subnets del servicio
2. Verifica que el security group permita conexiones en el puerto de PostgreSQL
3. Verifica que los secretos de la base de datos sean correctos

### Errores de permisos AWS

1. Verifica que el Task Role tenga permisos para SQS, SNS y S3
2. Verifica que el Execution Role pueda leer los secretos

## 📊 Monitoreo

### CloudWatch Metrics

El servicio expone métricas automáticamente en CloudWatch:
- CPU y memoria utilizada
- Número de tareas ejecutándose
- Estado del servicio

### Logs

Los logs de la aplicación están disponibles en:
- CloudWatch Log Group: `/ecs/metrics-engine-cp`

### Health Checks

El servicio incluye un health check que verifica que la aplicación responda en el puerto 3000.

## 🔄 Actualización del Servicio

Para actualizar el servicio manualmente:

```bash
aws ecs update-service \
  --cluster YOUR_CLUSTER_NAME \
  --service metrics-engine-cp-service \
  --force-new-deployment \
  --region us-east-1
```

## 📚 Referencias

- [Documentación de ECS](https://docs.aws.amazon.com/ecs/)
- [Documentación de Fargate](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/AWS_Fargate.html)
- [GitHub Actions para AWS](https://github.com/aws-actions)

