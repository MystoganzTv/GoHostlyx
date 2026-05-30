import type { NextAuthOptions } from "next-auth";
import { getServerSession } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { getAuthUserByEmail } from "./db";
import { normalizeAuthEmail, verifyPassword } from "./password";

const googleClientId = process.env.GOOGLE_CLIENT_ID ?? "";
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET ?? "";

export const hasGoogleAuthConfig = Boolean(googleClientId && googleClientSecret);
export const hasAuthSecretConfig = Boolean(process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET);

const allowedEmails = (process.env.ADMIN_EMAILS ?? "")
  .split(",")
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);

export function isEmailAllowed(email: string) {
  if (allowedEmails.length === 0) {
    return true;
  }

  return allowedEmails.includes(email.trim().toLowerCase());
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Email",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = normalizeAuthEmail(credentials?.email ?? "");
        const password = String(credentials?.password ?? "");

        if (!email || !password) {
          return null;
        }

        const authUser = await getAuthUserByEmail(email);

        if (!authUser || !verifyPassword(password, authUser.passwordHash) || !authUser.isVerified) {
          return null;
        }

        return {
          id: authUser.ownerEmail,
          email: authUser.ownerEmail,
          name: authUser.fullName,
        };
      },
    }),
    ...(hasGoogleAuthConfig
      ? [
        GoogleProvider({
          clientId: googleClientId,
          clientSecret: googleClientSecret,
        }),
      ]
      : []),
  ],
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async signIn({ user }) {
      const email = user.email?.toLowerCase();

      if (!email) {
        return false;
      }

      return isEmailAllowed(email);
    },
    async jwt({ token, user }) {
      if (user?.email) {
        token.email = user.email;
      }

      if (user?.name) {
        token.name = user.name;
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user && token.email) {
        session.user.email = String(token.email);
      }

      if (session.user && token.name) {
        session.user.name = String(token.name);
      }

      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};

export function getAuthSession() {
  if (!hasAuthSecretConfig) {
    return Promise.resolve(null);
  }

  return getServerSession(authOptions);
}

export async function requireUserEmail() {
  const session = await getAuthSession();
  const email = session?.user?.email?.toLowerCase();

  if (!email) {
    return null;
  }

  return email;
}
