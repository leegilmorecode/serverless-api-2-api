#!/usr/bin/env node

import "source-map-support/register";

import * as cdk from "aws-cdk-lib";

import { ExternalOrdersStackProps } from "../types";
import { ExternalStack } from "../lib/external-stack";

const props: ExternalOrdersStackProps = {
  importedInternalOrdersApiUrl:
    "https://xxx.execute-api.eu-west-1.amazonaws.com/prod/", // internal domain api url
  importedInternalOrdersRestApiId: "xxx", // internal domain api restApiId
  importedInternalOrdersAccountId: "11111111111", // internal domain account id
};

const app = new cdk.App();
new ExternalStack(app, "ExternalStack", props);
