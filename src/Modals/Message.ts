import {Schema,model} from "mongoose";
import { Message } from "../../types";
const MessageSchema = new Schema({
    sender: {
        type: String,
        required: true
    
    },
    content: {
        type: String,
        required: true
    },
    type: {
        type: String,
        required: true
    },
    replyId: {
        type: String,
    },
    deleted: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});



export default model<Message>("Message", MessageSchema);
