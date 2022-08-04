import * as apigw from "aws-cdk-lib/aws-apigateway";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as nodeLambda from "aws-cdk-lib/aws-lambda-nodejs";
import * as path from "path";

import { CfnOutput, Stack } from "aws-cdk-lib";

import { Construct } from "constructs";
import { ExternalOrdersStackProps } from "../types";

export class ExternalStack extends Stack {
  private vpcEndpoint: ec2.InterfaceVpcEndpoint;

  constructor(scope: Construct, id: string, props: ExternalOrdersStackProps) {
    super(scope, id, props);

    const {
      importedInternalOrdersApiUrl,
      importedInternalOrdersRestApiId,
      importedInternalOrdersAccountId,
    } = props;

    // create the vpc with one private subnets in two AZs
    const vpc: ec2.Vpc = new ec2.Vpc(this, "ExternalApiVpc", {
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

    // add a security group for the vpc endpoint for all ssh traffic
    const sg: ec2.SecurityGroup = new ec2.SecurityGroup(this, "ExternalVpcSg", {
      vpc,
      allowAllOutbound: true,
      securityGroupName: "external-vpc-sg",
    });

    sg.addIngressRule(ec2.Peer.ipv4("10.1.0.0/16"), ec2.Port.tcp(443));

    // create the vpc endpoint to allow us to talk cross account to the private internal api
    // without the need for a nat gateway etc. this is powered by privatelink
    this.vpcEndpoint = new ec2.InterfaceVpcEndpoint(
      this,
      "ExternalApiVpcEndpoint",
      {
        vpc,
        service: {
          name: `com.amazonaws.eu-west-1.execute-api`,
          port: 443,
        },
        subnets: vpc.selectSubnets({
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
        }),
        privateDnsEnabled: true,
        securityGroups: [sg],
      }
    );

    // create the orders handler for the external stack within our vpc
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

    // create the api for the external orders (experience layer)
    const externalOrdersApi: apigw.RestApi = new apigw.RestApi(
      this,
      "ExternalOrdersApi",
      {
        description: "external orders api",
        restApiName: "extenal-orders-api",
        deploy: true,
        endpointTypes: [apigw.EndpointType.REGIONAL], // this is regional and publically accessible on layer 7
        deployOptions: {
          stageName: "prod",
          dataTraceEnabled: true,
          loggingLevel: apigw.MethodLoggingLevel.INFO,
          tracingEnabled: true,
          metricsEnabled: true,
        },
      }
    );

    // this is the internal orders api passed through in env vars to the lambda
    ordersHandler.addEnvironment(
      "IAM_API",
      `${importedInternalOrdersApiUrl}orders/`
    );

    // add a policy to the lambda role to allow it to call the execute api arn of the internal api
    ordersHandler.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ["execute-api:Invoke"],
        resources: [
          // api arn + restapi + stage + method + path
          `arn:aws:execute-api:eu-west-1:${importedInternalOrdersAccountId}:${importedInternalOrdersRestApiId}/prod/POST/orders/`,
        ],
      })
    );

    // add the orders resource
    const orders: apigw.Resource = externalOrdersApi.root.addResource("orders");

    // add the endpoint for creating an order (post) on /orders/ resource
    orders.addMethod(
      "POST",
      new apigw.LambdaIntegration(ordersHandler, {
        proxy: true,
        allowTestInvoke: false,
      })
    );

    // output the arn to execute to the file
    new CfnOutput(this, "AccountId", {
      value: this.account,
      description: "The account ID",
      exportName: "AccountId",
    });

    // output the arn to execute to the file
    new CfnOutput(this, "VpcEndpointId", {
      value: this.vpcEndpoint.vpcEndpointId,
      description: "The VPC endpoint ID in the external stack",
      exportName: "VpcEndpointId",
    });
  }
}
