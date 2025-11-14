import { Message } from "@aws-sdk/client-sqs";

interface SQSMessageData {
  MessageId?: string;
  ReceiptHandle?: string;
  Body?: string;
  Attributes?: Record<string, string>;
}

export class SQSMessageBuilder {
  private data: SQSMessageData = {
    MessageId: "msg-123",
    ReceiptHandle: "handle-123",
    Body: "{}",
  };

  withMessageId(messageId: string): this {
    this.data.MessageId = messageId;
    return this;
  }

  withReceiptHandle(receiptHandle: string): this {
    this.data.ReceiptHandle = receiptHandle;
    return this;
  }

  withBody(body: string | object): this {
    this.data.Body = typeof body === "string" ? body : JSON.stringify(body);
    return this;
  }

  withAttributes(attributes: Record<string, string>): this {
    this.data.Attributes = attributes;
    return this;
  }

  /**
   * Crea un mensaje con el evento directo en el Body
   */
  withEvent(event: object): this {
    this.data.Body = JSON.stringify(event);
    return this;
  }

  /**
   * Crea un mensaje con formato SNS (el evento está en Message)
   */
  withSnsMessage(event: object): this {
    this.data.Body = JSON.stringify({
      Message: JSON.stringify(event),
    });
    return this;
  }

  build(): Message {
    return {
      MessageId: this.data.MessageId,
      ReceiptHandle: this.data.ReceiptHandle,
      Body: this.data.Body,
      Attributes: this.data.Attributes,
    };
  }
}
