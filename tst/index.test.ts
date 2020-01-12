import { AlexaSkillStack } from '../lib/index';
import { App } from '@aws-cdk/core';
import { expect as expectCDK, haveResource } from '@aws-cdk/assert';
import { Code } from '@aws-cdk/aws-lambda';

test('has valid config', () => {
    const mockApp = new App();
    const stack = new AlexaSkillStack(mockApp, {
        skillId: 'mock-1234567890',
        skillName: 'test-skill',
        codeAsset: Code.fromAsset(__dirname + '/../lib'),
    });

    expectCDK(stack).to(haveResource("AWS::S3::Bucket"));
    expectCDK(stack).to(haveResource("AWS::Lambda::Function"));

});