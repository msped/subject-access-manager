import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import apiClient from "./api/apiClient";

const BACKEND_ACCESS_TOKEN_LIFETIME = 45 * 60;            // 45 minutes
const BACKEND_REFRESH_TOKEN_LIFETIME = 6 * 24 * 60 * 60;  // 6 days

const getCurrentEpochTime = () => {
    return Math.floor(new Date().getTime() / 1000);
};

const SIGN_IN_HANDLERS = {
    "credentials": async (user, account, profile, email, credentials) => {
        return true;
    },
};
const SIGN_IN_PROVIDERS = Object.keys(SIGN_IN_HANDLERS);

export const { handlers, signIn, signOut, auth } = NextAuth({
    session: {
        strategy: "jwt",
        maxAge: BACKEND_REFRESH_TOKEN_LIFETIME,
    },
    providers: [
        Credentials({
            credentials: {
                username: { label: "Username", text: "text" },
                password: { label: "Password", type: "password" },
            },
            async authorize(credentials, req) {
                try {
                    const response = await apiClient.post(
                        '/auth/login',
                        credentials,
                    );
                    const data = response.data;
                    if (data) return data;
                } catch (error) {
                    console.error(error);
                }
                return null;
            },
        }),
    ],
    callbacks: {
        async signIn({user, account, profile, email, credentials}) {
            if (!SIGN_IN_PROVIDERS.includes(account.provider)) return false;
                return SIGN_IN_HANDLERS[account.provider](
                    user, account, profile, email, credentials
            );
        },
        async jwt({user, token, account}) {
            // If `user` and `account` are set that means it is a login event
            if (user && account) {
                let backendResponse = account.provider === "credentials" ? user : account.meta;
                token["user"] = backendResponse.user;
                token["access_token"] = backendResponse.access;
                token["refresh_token"] = backendResponse.refresh;
                token["ref"] = getCurrentEpochTime() + BACKEND_ACCESS_TOKEN_LIFETIME;
                return token;
            }
            // Refresh the backend token if necessary
            if (getCurrentEpochTime() > token["ref"]) {
                const response = await apiClient.post("auth/token/refresh",
                    {
                        refresh: token["refresh_token"],
                    },
                );
                token["access_token"] = response.data.access;
                token["refresh_token"] = response.data.refresh;
                token["ref"] = getCurrentEpochTime() + BACKEND_ACCESS_TOKEN_LIFETIME;
            }
            return token;
        },
        async session({token}) {
            return token;
        },
        async authorized({req, token}) {
            if (token && token.user) {
                return true;
            }
            return false;
        },
    }
})