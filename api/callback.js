const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto-js'); // For signature verification

// Initialize Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const payload = req.body;

        console.log("Mayar Webhook Received:", JSON.stringify(payload, null, 2));

        // 1. Signature Verification (Optional but Recommended)
        // If MAYAR_WEBHOOK_SECRET is set in .env, verify the signature
        /* 
        const signature = req.headers['x-mayar-signature'];
        if (process.env.MAYAR_WEBHOOK_SECRET && signature) {
            // Implement HMAC-SHA256 verification here if Mayar provides docs for it
        }
        */

        // 2. Extract Data
        // Mayar webhook structure varies, but generally looks for 'status' and 'metadata'
        const status = payload.status; // e.g., 'paid', 'expired', 'failed'
        const metadata = payload.metadata || {};
        const merchantRef = metadata.merchantRef;
        const accountId = metadata.account_id;

        if (!merchantRef) {
            return res.status(400).json({ error: 'No Merchant Ref found in metadata' });
        }

        // 3. Handle 'PAID' or 'CAPTURED' Status
        if (status === 'paid' || status === 'captured' || status === 'settled') {
            console.log(`Order ${merchantRef} is PAID. Delivering product...`);

            // A. Update Order Status
            const { error: orderError } = await supabase
                .from('orders')
                .update({
                    status: 'paid',
                    updated_at: new Date()
                })
                .eq('id', merchantRef);

            if (orderError) throw orderError;

            // B. Mark Account as Sold
            if (accountId) {
                const { error: accountError } = await supabase
                    .from('accounts')
                    .update({ is_sold: true })
                    .eq('id', accountId);

                if (accountError) console.error("Failed to mark account as sold:", accountError);
            }

            // TODO: Implement Email Delivery (Send credentials to buyer_email)

        } else if (status === 'expired' || status === 'failed') {
            console.log(`Order ${merchantRef} is ${status}.`);
            await supabase
                .from('orders')
                .update({ status: status, updated_at: new Date() })
                .eq('id', merchantRef);
        }

        res.status(200).json({ success: true });

    } catch (error) {
        console.error('Webhook Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};
