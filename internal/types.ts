import * as cdk from "aws-cdk-lib";

export interface InternalOrdersStackProps extends cdk.StackProps {
  importedExternalOrdersAccountId: string;
  importedInternalOrdersAccountId: string;
}
