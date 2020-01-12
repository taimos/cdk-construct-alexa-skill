import { CfnPermission, Function, Code, Runtime, CfnVersion } from '@aws-cdk/aws-lambda';
import { Bucket } from '@aws-cdk/aws-s3';
import { Table, BillingMode, AttributeType } from '@aws-cdk/aws-dynamodb';
import { App, CfnDeletionPolicy, CfnOutput, Stack, Duration } from '@aws-cdk/core';
import { env } from 'process';

export interface AlexaSkillConfig {
  /** The Alexa Skill id */
  readonly skillId: string;

  /** The Alexa Skill name */
  readonly skillName: string;

  /** The code to use for the backend lambda */
  readonly codeAsset: Code;

  /** Environement variables for the Lambda function */
  readonly environment?: { [key: string]: string };
  
  /** 
   * The handler for the lambda function 
   * @default dist/index.handler
   */
  readonly codeHandler?: string;

  /**
   * name of the user attribute for DynamoDB
   * @default id
   */
  readonly userAttribute?: string;
}

export class AlexaSkillStack extends Stack {
  constructor(parent: App, config: AlexaSkillConfig) {
    super(parent, config.skillName, { env: { account: env.CDK_DEFAULT_ACCOUNT, region: env.CDK_DEFAULT_REGION } });
    this.templateOptions.description = `The Alexa Skill ${config.skillName}`;

    const assetBucket = new Bucket(this, 'AssetBucket', {
      bucketName: `${this.account}-${config.skillName}-${this.region}-assets`,
    });
    assetBucket.grantPublicAccess();

    const userTable = new Table(this, 'AttributesTable', {
      billingMode: BillingMode.PAY_PER_REQUEST,
      partitionKey: {
        type: AttributeType.STRING,
        name: config.userAttribute || 'id',
      },
    });

    const versionName = `${new Date().getTime()}`;

    const skillFunction = new Function(this, 'SkillFunction', {
      code: config.codeAsset,
      description: `Skill Function for ${config.skillName} - updated ${versionName}`,
      timeout: Duration.seconds(10),
      runtime: Runtime.NODEJS_12_X,
      handler: config.codeHandler ?? 'dist/index.handler',
      memorySize: 128,
      environment: {
        ...config.environment,
        TABLE_NAME: userTable.tableName,
        ASSET_BUCKET: assetBucket.bucketName,
        ASSET_BUCKET_URL: assetBucket.bucketRegionalDomainName,
        SKILL_ID: config.skillId,
      }
    });
    userTable.grantReadWriteData(skillFunction);

    const version = skillFunction.addVersion(versionName);
    (version.node.tryFindChild('Resource') as CfnVersion).cfnOptions.deletionPolicy = CfnDeletionPolicy.RETAIN;
    (version.node.tryFindChild('Resource') as CfnVersion).cfnOptions.updateReplacePolicy = CfnDeletionPolicy.RETAIN;

    const skillFunctionPermission = new CfnPermission(this, 'SkillFunctionPermission', {
      action: 'lambda:invokeFunction',
      functionName: version.functionName,
      principal: 'alexa-appkit.amazon.com',
    });
    skillFunctionPermission.cfnOptions.deletionPolicy = CfnDeletionPolicy.RETAIN;
    skillFunctionPermission.cfnOptions.updateReplacePolicy = CfnDeletionPolicy.RETAIN;

    new CfnOutput(this, 'SkillId', { value: config.skillId });
    new CfnOutput(this, 'EndpointArn', { value: version.functionArn });
    new CfnOutput(this, 'TableName', { value: userTable.tableName });
    new CfnOutput(this, 'AssetBucketName', { value: assetBucket.bucketName });
  }
}
