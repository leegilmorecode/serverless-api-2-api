import * as apigw from "aws-cdk-lib/aws-apigateway";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as nodeLambda from "aws-cdk-lib/aws-lambda-nodejs";
import * as path from "path";

import { CfnOutput, Stack } from "aws-cdk-lib";

import { Construct } from "constructs";
import { InternalOrdersStackProps } from "../types";

export class InternalStack extends Stack {
  constructor(scope: Construct, id: string, props: InternalOrdersStackProps) {
    super(scope, id, props);

    const { importedExternalOrdersAccountId, importedInternalOrdersAccountId } =
      props;

    // create the vpc with one private subnet in two AZs
    const vpc: ec2.Vpc = new ec2.Vpc(this, "internal-api-vpc", {
      cidr: "10.1.0.0/16",
      natGateways: 0,
      maxAzs: 2,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: "private-subnet-1",
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
        },
      ],
    });

    // create the orders handler
    const ordersHandler: nodeLambda.NodejsFunction =
      new nodeLambda.NodejsFunction(this, "OrdersHandler", {
        functionName: "orders-handler",
        runtime: lambda.Runtime.NODEJS_14_X,
        entry: path.join(__dirname, "/../src/create-order/create-order.ts"),
        memorySize: 1024,
        handler: "ordersHandler",
        bundling: {
          minify: true,
          externalModules: ["aws-sdk"],
        },
        vpc: vpc,
        vpcSubnets: {
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
        },
      });

    // this api policy on the private internal domain api states that only requests from the external account
    // can be made (experience layer bff), and only posts on /orders
    const apiPolicy = new iam.PolicyDocument({
      statements: [
        new iam.PolicyStatement({
          actions: ["execute-api:Invoke"],
          principals: [
            new iam.AccountPrincipal(importedExternalOrdersAccountId), // this is the account which is calling it.
          ],
          resources: [
            // api arn + restapi + stage + method + path (exmaple below is authZ down to the given endpoint and method)
            `arn:aws:execute-api:eu-west-1:${importedInternalOrdersAccountId}:dbu2yjalfg/prod/POST/orders/`,
          ],
        }),
      ],
    });

    // create the api for the private internal orders (domain api)
    const internalOrdersApi: apigw.RestApi = new apigw.RestApi(
      this,
      "InternalOrdersApi",
      {
        description: "internal orders api",
        restApiName: "internal-orders-api",
        deploy: true,
        policy: apiPolicy, // <-- the api resource policy is added here
        defaultMethodOptions: {
          authorizationType: apigw.AuthorizationType.IAM, // IAM-based authorization
        },
        endpointTypes: [apigw.EndpointType.PRIVATE], // this is a private domain layer api i.e. only accessible from this vpc
        // https://docs.aws.amazon.com/apigateway/latest/developerguide/apigateway-private-apis.html
        deployOptions: {
          stageName: "prod",
          dataTraceEnabled: true,
          loggingLevel: apigw.MethodLoggingLevel.INFO,
          tracingEnabled: true,
          metricsEnabled: true,
        },
      }
    );

    // create the orders resource for the internal domain api
    const orders: apigw.Resource = internalOrdersApi.root.addResource("orders");

    // add the endpoint for creating an order (post) on /orders/
    orders.addMethod(
      "POST",
      new apigw.LambdaIntegration(ordersHandler, {
        proxy: true,
        allowTestInvoke: false,
      })
    );

    // output the arn to execute to the file
    new CfnOutput(this, "InternalOrdersApiArnToExecute", {
      value: internalOrdersApi.arnForExecuteApi(),
      description: "The arn to execute for the internal orders api",
      exportName: "internalOrdersApiArnToExecute",
    });

    // output the arn to execute to the file
    new CfnOutput(this, "InternalOrdersApiUrl", {
      value: internalOrdersApi.url,
      description: "The url of the internal orders api",
      exportName: "InternalOrdersApiUrl",
    });

    // output the arn to execute to the file
    new CfnOutput(this, "AccountId", {
      value: this.account,
      description: "The account ID",
      exportName: "AccountId",
    });

    // output the arn to execute to the file
    new CfnOutput(this, "InternalOrdersRestApiId", {
      value: internalOrdersApi.restApiId,
      description: "The rest api Id internal orders api",
      exportName: "InternalOrdersRestApiId",
    });

    new CfnOutput(this, "InternalOrdersAccountId", {
      value: this.account,
      exportName: "InternalOrdersAccountId",
    });
  }
}
