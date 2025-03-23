import crypto from 'crypto';
import { ActivateLicenseParams, BillingPortalSession, CancelSubscriptionParams, CheckoutSession, CreateBillingPortalSessionParams, CreateCheckoutSessionParams, CreateDiscountParams, CreateProductParams, Customer, DeactivateLicenseParams, DiscountCode, GetCustomerParams, GetSubscriptionParams, LicenseActivation, LicenseDeactivation, LicenseValidation, Product, ProductListResponse, ProductSearchParams, RedirectParams, Subscription, TransactionListResponse, TransactionSearchParams, ValidateLicenseParams } from './types';


export class CreemSDK {
    private apiKey: string;
    private baseUrl: string;

    constructor({ apiKey }: { apiKey: string }) {
        if (!apiKey.startsWith('creem_')) {
            throw new Error('Invalid API key format. API key must start with "creem_"');
        }

        this.apiKey = apiKey;
        const mode = apiKey.startsWith('creem_test_') ? 'test' : 'live';
        this.baseUrl = mode === 'test'
            ? 'https://test-api.creem.io'
            : 'https://api.creem.io';
    }

    private async request<T, P = Record<string, unknown>>(
        endpoint: string,
        method: 'GET' | 'POST' = 'GET',
        data?: P
    ): Promise<T> {
        const response = await fetch(`${this.baseUrl}${endpoint}`, {
            method,
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': this.apiKey,
            },
            ...(data && { body: JSON.stringify(data) }),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Request failed');
        }

        return response.json();
    }

    /**
     * Creates a new checkout session for a product
     * @param {CreateCheckoutSessionParams} params - The parameters for creating a checkout session
     * @param {string} params.product_id - (Required) The ID of the product associated with the checkout session
     * @param {string} [params.request_id] - (Optional) Identify and track each checkout for your backend
     * @param {string} [params.discount_code] - (Optional) Prefill the checkout session with a discount code
     * @param {Object} [params.customer] - (Optional) Customer data to prefill the checkout session
     * @param {CustomField[]} [params.custom_field] - (Optional) Collect additional information from customer (up to 3 fields)
     * @param {string} [params.success_url] - (Optional) URL to redirect after successful checkout
     * @param {Record<string, any>[]} [params.metadata] - (Optional) Additional metadata to attach to the checkout
     * @returns {Promise<CheckoutSession>} A promise that resolves to the created checkout session
     * @throws {Error} If the request fails or if required parameters are missing
     * @example
     * const session = await creemSDK.createCheckoutSession({
     *   product_id: 'prod_123', // Required
     *   request_id: 'user_id', 
     *   customer: {
     *     id: 'cust_123',
     *     email: 'user@example.com'
     *   },
     *   success_url: 'https://example.com/success'
     * });
     */
    async createCheckoutSession(params: CreateCheckoutSessionParams): Promise<CheckoutSession> {
        return this.request<CheckoutSession, CreateCheckoutSessionParams>('/v1/checkouts', 'POST', params);
    }

    /**
     * Retrieves a customer by their ID or email address
     * @param {Object} params - The parameters for getting a customer
     * @param {string} [params.customer_id] - The unique identifier of the customer
     * @param {string} [params.email] - The unique email of the customer
     * @returns {Promise<Customer>} A promise that resolves to a Customer object
     * @throws {Error} If the request fails
     * @example
     * // Get customer by ID
     * const customer = await creemSDK.getCustomer({ customer_id: 'cust_123' });
     * 
     * // Get customer by email
     * const customer = await creemSDK.getCustomer({ email: 'user@example.com' });
     */
    async getCustomer(params: GetCustomerParams): Promise<Customer> {
        const queryParams = new URLSearchParams();
        if (params.customer_id) {
            queryParams.append('customer_id', params.customer_id);
        }
        if (params.email) {
            queryParams.append('email', params.email);
        }
        return this.request<Customer>(`/v1/customers?${queryParams.toString()}`);
    }

    /**
     * Retrieves a subscription by its ID
     * @param {GetSubscriptionParams} params - The parameters for getting a subscription
     * @param {string} params.subscription_id - (Required) The unique identifier of the subscription
     * @returns {Promise<Subscription>} A promise that resolves to a Subscription object
     * @throws {Error} If the request fails or if required parameters are missing
     * @see https://docs.creem.io/api-reference/endpoint/get-subscription
     * @example
     * const subscription = await creemSDK.getSubscription({
     *   subscription_id: 'sub_123'
     * });
     */
    async getSubscription(params: GetSubscriptionParams): Promise<Subscription> {
        const queryParams = new URLSearchParams({ subscription_id: params.subscription_id });
        return this.request<Subscription>(`/v1/subscriptions?${queryParams.toString()}`);
    }

    /**
     * Cancels a subscription
     * @param {CancelSubscriptionParams} params - The parameters for canceling a subscription
     * @param {string} params.id - (Required) The subscription ID to cancel
     * @returns {Promise<Subscription>} A promise that resolves to the updated Subscription object
     * @throws {Error} If the request fails or if required parameters are missing
     * @see https://docs.creem.io/api-reference/endpoint/cancel-subscription
     * @example
     * const subscription = await creemSDK.cancelSubscription({
     *   id: 'sub_123'
     * });
     */
    async cancelSubscription(params: CancelSubscriptionParams): Promise<Subscription> {
        return this.request<Subscription>(
            `/v1/subscriptions/${params.id}/cancel`,
            'POST'
        );
    }

    /**
     * Verifies the signature of a webhook request
     * @param {string} payload - The raw request body as a string
     * @param {string} signature - The signature from the 'creem-signature' header
     * @param {string} webhookSecret - Your webhook secret from the Creem dashboard
     * @returns {boolean} True if the signature is valid, false otherwise
     * @throws {Error} If any required parameters are missing
     * @see https://docs.creem.io/learn/webhooks/verify-webhook-requests
     * @example
     * const isValid = creemSDK.verifyWebhookSignature(
     *   JSON.stringify(req.body),
     *   req.headers['creem-signature'],
     *   'your_webhook_secret'
     * );
     */
    verifyWebhookSignature(
        payload: string,
        signature: string,
        webhookSecret: string
    ): boolean {
        const computedSignature = crypto
            .createHmac('sha256', webhookSecret)
            .update(payload)
            .digest('hex');

        return computedSignature === signature;
    }

    /**
     * Verifies the signature of redirect URL parameters
     * @param {RedirectParams} params - The parameters from the redirect URL
     * @param {string} signature - The signature from the redirect URL
     * @returns {boolean} True if the signature is valid, false otherwise
     * @see https://docs.creem.io/learn/checkout-session/return-url#how-to-verify-creem-signature
     * @example
     * const isValid = creemSDK.verifyRedirectSignature(
     *   {
     *     checkout_id: 'ch_1QyIQDw9cbFWdA1ry5Qc6I',
     *     order_id: 'ord_4ucZ7Ts3r7EhSrl5yQE4G6',
     *     customer_id: 'cust_2KaCAtu6l3tpjIr8Nr9XOp',
     *     subscription_id: 'sub_ILWMTY6uBim4EB0uxK6WE',
     *     product_id: 'prod_6tW66i0oZM7w1qXReHJrwg'
     *   },
     *   '044bd1691d254c4ad4b31b7f246330adf09a9f07781cd639979a288623f4394c'
     * );
     */
    verifyRedirectSignature(params: RedirectParams, signature: string): boolean {
        const data = Object.entries(params)
            .filter(([, value]) => value !== null && value !== undefined)
            .map(([key, value]) => `${key}=${value}`)
            .concat(`salt=${this.apiKey}`)
            .join('|');

        const computedSignature = crypto
            .createHash('sha256')
            .update(data)
            .digest('hex');

        return computedSignature === signature;
    }

    // License Key Management
    /**
     * Validates a license key and its instance
     * @param {ValidateLicenseParams} params - The parameters for validating a license
     * @param {string} params.key - (Required) The license key to validate
     * @param {string} params.instance_id - (Required) Id of the instance to validate
     * @returns {Promise<LicenseValidation>} A promise that resolves to the license validation result
     * @throws {Error} If the request fails or if required parameters are missing
     * @see https://docs.creem.io/api-reference/endpoint/validate-license
     * @example
     * const validation = await creemSDK.validateLicense({
     *   key: 'license_key_123',
     *   instance_id: 'instance_123'
     * });
     */
    async validateLicense(params: ValidateLicenseParams): Promise<LicenseValidation> {
        return this.request<LicenseValidation, ValidateLicenseParams>('/v1/licenses/validate', 'POST', params);
    }

    /**
     * Activates a license key for a new instance
     * @param {ActivateLicenseParams} params - The parameters for activating a license
     * @param {string} params.key - (Required) The license key to activate
     * @param {string} params.instance_name - (Required) A label for the new instance to identify it in Creem
     * @returns {Promise<LicenseActivation>} A promise that resolves to the license activation result
     * @throws {Error} If the request fails or if required parameters are missing
     * @example
     * const activation = await creemSDK.activateLicense({
     *   key: 'license_key_123',
     *   instance_name: 'My Device'
     * });
     */
    async activateLicense(params: ActivateLicenseParams): Promise<LicenseActivation> {
        return this.request<LicenseActivation, ActivateLicenseParams>(
            '/v1/licenses/activate',
            'POST',
            params
        );
    }

    /**
     * Deactivates a license key instance
     * @param {DeactivateLicenseParams} params - The parameters for deactivating a license
     * @param {string} params.key - (Required) The license key to deactivate
     * @param {string} params.instance_id - (Required) Id of the instance to deactivate
     * @returns {Promise<LicenseDeactivation>} A promise that resolves to the license deactivation result
     * @throws {Error} If the request fails or if required parameters are missing
     * @example
     * const deactivation = await creemSDK.deactivateLicense({
     *   key: 'license_key_123',
     *   instance_id: 'instance_123'
     * });
     */
    async deactivateLicense(params: DeactivateLicenseParams): Promise<LicenseDeactivation> {
        return this.request<LicenseDeactivation, DeactivateLicenseParams>('/v1/licenses/deactivate', 'POST', params);
    }

    // Products
    /**
     * Retrieves a product by its ID
     * @param {string} productId - The unique identifier of the product
     * @returns {Promise<Product>} A promise that resolves to a Product object
     * @throws {Error} If the request fails
     * @example
     * const product = await creemSDK.getProduct('prod_123');
     */
    async getProduct(productId: string): Promise<Product> {
        return this.request<Product>(`/v1/products?product_id=${encodeURIComponent(productId)}`);
    }

    /**
     * Creates a new product
     * @param {CreateProductParams} params - The parameters for creating a product
     * @returns {Promise<Product>} A promise that resolves to the created Product object
     * @throws {Error} If the request fails
     * @example
     * const product = await creemSDK.createProduct({
     *   name: 'My Product',
     *   price: 1000, // $10.00
     *   currency: 'USD',
     *   billing_type: 'one-time',
     *   description: 'Product description'
     * });
     */
    async createProduct(params: CreateProductParams): Promise<Product> {
        return this.request<Product, CreateProductParams>('/v1/products', 'POST', params);
    }

    /**
     * Lists all products with optional search parameters
     * @param {ProductSearchParams} [params] - Optional search parameters
     * @param {number} [params.page_number] - Page number for pagination
     * @param {number} [params.page_size] - Number of items per page
     * @returns {Promise<ProductListResponse>} A promise that resolves to a paginated list of products
     * @throws {Error} If the request fails
     * @example
     * const products = await creemSDK.listProducts({
     *   page_number: 1,
     *   page_size: 10
     * });
     */
    async listProducts(params?: ProductSearchParams): Promise<ProductListResponse> {
        const queryParams = new URLSearchParams();
        if (params) {
            Object.entries(params).forEach(([key, value]) => {
                if (value !== undefined) {
                    queryParams.append(key, value.toString());
                }
            });
        }
        return this.request<ProductListResponse>(
            `/v1/products/search?${queryParams.toString()}`
        );
    }

    // Discount Codes
    /**
     * Creates a new discount code
     * @param {CreateDiscountParams} params - The parameters for creating a discount code
     * @param {string} params.name - (Required) The name of the discount
     * @param {('percentage'|'fixed')} params.type - (Required) The type of discount
     * @param {number} params.amount - (Required) The fixed value for the discount (if type is "fixed")
     * @param {('forever'|'once'|'repeating')} params.duration - (Required) The duration type for the discount
     * @param {string} [params.code] - (Optional) Custom discount code. If left empty, a code will be generated
     * @param {string} [params.currency] - (Required if type is "fixed") The currency of the discount
     * @param {number} [params.percentage] - (Required if type is "percentage") The percentage value
     * @param {string} [params.expiry_date] - (Optional) The expiry date of the discount
     * @param {number} [params.max_redemptions] - (Optional) Maximum number of redemptions
     * @param {number} [params.duration_in_months] - (Optional) Required if duration is "repeating"
     * @param {string[]} [params.applies_to_products] - (Optional) Product IDs this applies to
     * @returns {Promise<DiscountCode>} A promise that resolves to the created discount code
     * @throws {Error} If the request fails or if required parameters are missing
     * @example
     * const discount = await creemSDK.createDiscountCode({
     *   name: 'Summer Sale',
     *   type: 'percentage',
     *   amount: 20,
     *   duration: 'once',
     *   percentage: 20,
     *   expiry_date: '2024-12-31',
     *   applies_to_products: ['prod_123']
     * });
     */
    async createDiscountCode(params: CreateDiscountParams): Promise<DiscountCode> {
        return this.request<DiscountCode, CreateDiscountParams>('/v1/discounts', 'POST', params);
    }

    // Transactions
    /**
     * Lists all transactions with optional search parameters
     * @param {TransactionSearchParams} [params] - Optional search parameters
     * @param {string} [params.customer_id] - Filter transactions by customer ID
     * @param {number} [params.page_number] - Page number for pagination
     * @param {number} [params.page_size] - Number of items per page
     * @returns {Promise<TransactionListResponse>} A promise that resolves to a paginated list of transactions
     * @throws {Error} If the request fails
     * @example
     * const transactions = await creemSDK.listTransactions({
     *   customer_id: 'cust_123',
     *   page_number: 1,
     *   page_size: 10
     * });
     */
    async listTransactions(params?: TransactionSearchParams): Promise<TransactionListResponse> {
        const queryParams = new URLSearchParams();
        if (params) {
            Object.entries(params).forEach(([key, value]) => {
                if (value !== undefined) {
                    queryParams.append(key, value.toString());
                }
            });
        }
        return this.request<TransactionListResponse>(
            `/v1/transactions/search?${queryParams.toString()}`
        );
    }

    /**
     * Creates a customer portal session for managing subscriptions
     * @param {CreateBillingPortalSessionParams} params - The parameters for creating a billing portal session
     * @param {string} params.customer_id - (Required) The ID of the customer to create a portal session for
     * @returns {Promise<BillingPortalSession>} A promise that resolves to the billing portal session with login URL
     * @throws {Error} If the request fails or if required parameters are missing
     * @see https://docs.creem.io/learn/customers/customer-portal
     * @example
     * const session = await creemSDK.createBillingPortalSession({
     *   customer_id: 'cust_123'
     * });
     * // Redirect customer to session.customer_portal_link
     */
    async createBillingPortalSession(
        params: CreateBillingPortalSessionParams
    ): Promise<BillingPortalSession> {
        return this.request<BillingPortalSession, CreateBillingPortalSessionParams>(
            '/v1/customers/billing',
            'POST',
            params
        );
    }
}

export * from './types';
