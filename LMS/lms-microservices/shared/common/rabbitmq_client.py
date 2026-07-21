import json
import logging
import os
import pika
from threading import Thread

logger = logging.getLogger(__name__)

class RabbitMQClient:
    """Shared RabbitMQ client for publishing and consuming events"""
    
    def __init__(self):
        self.rabbitmq_url = os.environ.get("RABBITMQ_URL", "amqp://guest:guest@rabbitmq:5672/")
        self.connection = None
        self.channel = None
        self._connect()

    def _connect(self):
        try:
            parameters = pika.URLParameters(self.rabbitmq_url)
            self.connection = pika.BlockingConnection(parameters)
            self.channel = self.connection.channel()
            logger.info("✅ Connected to RabbitMQ")
        except Exception as e:
            logger.error(f"❌ Failed to connect to RabbitMQ: {str(e)}")

    def _ensure_connection(self):
        if not self.connection or self.connection.is_closed:
            self._connect()

    def publish_event(self, exchange: str, routing_key: str, message: dict):
        """Publish an event to an exchange"""
        self._ensure_connection()
        try:
            self.channel.exchange_declare(exchange=exchange, exchange_type='topic', durable=True)
            self.channel.basic_publish(
                exchange=exchange,
                routing_key=routing_key,
                body=json.dumps(message),
                properties=pika.BasicProperties(
                    delivery_mode=2,  # make message persistent
                    content_type='application/json'
                )
            )
            logger.info(f"📤 Published event {routing_key} to {exchange}: {message}")
            return True
        except Exception as e:
            logger.error(f"❌ Failed to publish event: {str(e)}")
            return False

    def consume_events(self, exchange: str, queue_name: str, routing_keys: list, callback):
        """Listen for events on specific routing keys"""
        self._ensure_connection()
        try:
            self.channel.exchange_declare(exchange=exchange, exchange_type='topic', durable=True)
            result = self.channel.queue_declare(queue=queue_name, durable=True)
            
            for routing_key in routing_keys:
                self.channel.queue_bind(
                    exchange=exchange,
                    queue=queue_name,
                    routing_key=routing_key
                )
            
            def on_message(ch, method, properties, body):
                try:
                    message = json.loads(body)
                    logger.info(f"📥 Received event {method.routing_key}: {message}")
                    callback(method.routing_key, message)
                    ch.basic_ack(delivery_tag=method.delivery_tag)
                except Exception as e:
                    logger.error(f"❌ Error processing event: {str(e)}")
                    # Nack and requeue so it can be fixed
                    ch.basic_nack(delivery_tag=method.delivery_tag, requeue=True)
            
            self.channel.basic_consume(
                queue=queue_name,
                on_message_callback=on_message,
                auto_ack=False
            )
            
            logger.info(f"🎧 Started listening to queue '{queue_name}' for keys: {routing_keys}")
            self.channel.start_consuming()
            
        except Exception as e:
            logger.error(f"❌ Failed to setup consumer: {str(e)}")

    def start_consumer_thread(self, exchange: str, queue_name: str, routing_keys: list, callback):
        """Starts the consumer in a background thread so it doesn't block Django"""
        thread = Thread(target=self.consume_events, args=(exchange, queue_name, routing_keys, callback))
        thread.daemon = True
        thread.start()
        return thread
