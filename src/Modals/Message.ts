import {Schema,model} from "mongoose";

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

const Message = model("Message", MessageSchema);

export default Message;
