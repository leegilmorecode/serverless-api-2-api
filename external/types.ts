import * as cdk from "aws-cdk-lib";

export interface ExternalOrdersStackProps extends cdk.StackProps {
  importedInternalOrdersApiUrl: string;
  importedInternalOrdersRestApiId: string;
  importedInternalOrdersAccountId: string;
}
