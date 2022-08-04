import {
  APIGatewayProxyEvent,
  APIGatewayProxyHandler,
  APIGatewayProxyResult,
} from "aws-lambda";

import { v4 as uuid } from "uuid";

export const ordersHandler: APIGatewayProxyHandler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const correlationId = uuid();
    const method = "create-order.handler";
    const prefix = `${correlationId} - ${method}`;

    console.log(`${prefix} - started`);
    console.log(`${prefix} - event: ${JSON.stringify(event)}`); // for the demo only to see the headers coming through

    const orderId = uuid();

    console.log(`${prefix} - order id ${orderId}`);

    // note: this would typically come from the event but for demo only its hardcoded apart from the order id
    const order = {
      id: orderId,
      status: "OrderSubmitted Internal",
    };

    console.log(`response: ${JSON.stringify(order)}`);

    return {
      statusCode: 201,
      body: JSON.stringify(order),
    };
  } catch (error) {
    console.log(error);
    return {
      statusCode: 500,
      body: "An error occurred",
    };
  }
};
