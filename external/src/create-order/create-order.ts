import { APIGatewayProxyHandler, APIGatewayProxyResult } from "aws-lambda";

import { HttpRequest } from "@aws-sdk/protocol-http";
import { URL } from "url";
import fetch from "node-fetch";
import { signRequest } from "../helper/request-signer";
import { v4 as uuid } from "uuid";

export const ordersHandler: APIGatewayProxyHandler =
  async (): Promise<APIGatewayProxyResult> => {
    try {
      const correlationId = uuid();
      const method = "create-order.handler";
      const prefix = `${correlationId} - ${method}`;

      console.log(`${prefix} - started`);

      // generate the orderId
      const orderId = uuid();

      console.log(`${prefix} - order id ${orderId}`);

      // note: this would typically come from the body but for demo only its hardcoded apart from the order id
      const order = {
        id: orderId,
        status: "OrderSubmitted",
      };

      console.log(`order: ${JSON.stringify(order)}`);
      console.log(`hitting internal domain api: ${process.env.IAM_API}`);

      const url = new URL(`${process.env.IAM_API}`);

      const request = new HttpRequest({
        hostname: url.host, // https://12345.execute-api.eu-west-1.amazonaws.com/
        method: "POST",
        body: JSON.stringify(order),
        headers: {
          host: url.host,
          "x-consumer-id": "website-bff", // pass through headers for logging of consumers
        },
        path: url.pathname, // prod/orders/
      });

      // sign our request with SigV4 and send
      const signedRequest = await signRequest(request);
      const response = await fetch(url.href, signedRequest);
      const responseJson = await response.json();

      console.log(`response: ${JSON.stringify(responseJson)}`);

      return {
        statusCode: 201,
        body: JSON.stringify(responseJson),
      };
    } catch (error) {
      console.log(error);
      return {
        statusCode: 500,
        body: "An error occurred",
      };
    }
  };
