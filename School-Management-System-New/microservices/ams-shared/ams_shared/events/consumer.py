import json
import os
import logging
import time
import pika

logger = logging.getLogger(__name__)

RABBITMQ_URL = os.getenv("RABBITMQ_URL", "amqp://guest:guest@rabbitmq:5672/")
EXCHANGE = "ams.events"


def start_consumer(routing_keys: list, handler, queue_name: str):
    """
    Connect to RabbitMQ and consume events matching routing_keys.
    Reconnects automatically on failure.

    handler(routing_key, payload) is called for each message.
    """
    while True:
        try:
            params = pika.URLParameters(RABBITMQ_URL)
            params.heartbeat = 60
            connection = pika.BlockingConnection(params)
            channel = connection.channel()

            channel.exchange_declare(exchange=EXCHANGE, exchange_type="topic", durable=True)
            channel.queue_declare(queue=queue_name, durable=True)

            for key in routing_keys:
                channel.queue_bind(exchange=EXCHANGE, queue=queue_name, routing_key=key)

            def _callback(ch, method, properties, body):
                try:
                    payload = json.loads(body)
                    handler(method.routing_key, payload)
                    ch.basic_ack(delivery_tag=method.delivery_tag)
                except Exception as exc:
                    logger.error("Event handler error [%s]: %s", method.routing_key, exc)
                    ch.basic_nack(delivery_tag=method.delivery_tag, requeue=False)

            channel.basic_qos(prefetch_count=1)
            channel.basic_consume(queue=queue_name, on_message_callback=_callback)
            logger.info("Consumer started — queue=%s keys=%s", queue_name, routing_keys)
            channel.start_consuming()

        except pika.exceptions.AMQPConnectionError:
            logger.warning("RabbitMQ not available, retrying in 5s...")
            time.sleep(5)
        except Exception as exc:
            logger.error("Consumer crashed: %s — restarting in 5s", exc)
            time.sleep(5)
