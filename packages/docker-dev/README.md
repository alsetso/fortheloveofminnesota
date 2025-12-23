# Docker Development Setup

This directory contains Docker configurations for local development.

## Stripe CLI Service

The Stripe CLI service forwards webhooks from Stripe to your local API server for testing.

### Setup

1. **Start the Stripe CLI service:**
   ```bash
   cd packages/docker-dev
   docker-compose up -d stripe-cli
   ```

2. **Login to Stripe CLI:**
   ```bash
   docker exec -it minnesota-stripe-cli stripe login
   ```
   This will open a browser for authentication.

3. **Forward webhooks:**
   The service is configured to forward webhooks to `http://host.docker.internal:4000/webhooks/stripe`
   
   Make sure your API server is running on port 4000, or update the `docker-compose.yml` file.

### Usage

Once running, the Stripe CLI will automatically forward webhooks from your Stripe account to your local API server.

To test webhooks locally:
1. Trigger events in your Stripe dashboard (test mode)
2. Or use the Stripe CLI to trigger test events:
   ```bash
   docker exec -it minnesota-stripe-cli stripe trigger checkout.session.completed
   ```

### Environment Variables

Make sure `STRIPE_SECRET_KEY` is set in your `.env.local` file for the Stripe CLI to authenticate.

### Stopping

```bash
docker-compose down
```


