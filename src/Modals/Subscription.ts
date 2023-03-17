import { Schema,model } from "mongoose";

const SubscriptionSchema = new Schema({
    endpoint: String,
    expirationTime: String,
    keys: {
        p256dh: String,
        auth: String,
    }

}, { timestamps: true });

export default model("Subscription", SubscriptionSchema);