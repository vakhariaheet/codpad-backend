declare global {
    namespace NodeJS {
        interface ProcessEnv { 
            PORT: string;
            JWT_SECRET: string;
            SENDGRID_API_KEY: string;
            MONGO_URI: string;
            AWS_BUCKET: string;
            AWS_REGION: string;
            ADMIN_SECRET: string;
        }
    }
}

export { };