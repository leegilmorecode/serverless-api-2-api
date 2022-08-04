#!/usr/bin/env node

import "source-map-support/register";

import * as cdk from "aws-cdk-lib";

import { InternalOrdersStackProps } from "../types";
import { InternalStack } from "../lib/internal-stack";

const props: InternalOrdersStackProps = {
  importedExternalOrdersAccountId: "111111111111", // external account id
  importedInternalOrdersAccountId: "222222222222", // internal account id
};

const app = new cdk.App();
new InternalStack(app, "InternalStack", props);
