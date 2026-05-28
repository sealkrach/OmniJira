import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import KeycloakProvider from "next-auth/providers/keycloak";
import bcrypt from "bcryptjs";
import { prisma } from "./db";

function decodeJwt(token: string): Record<string, unknown> {
  try {
    return JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString());
  } catch {
    return {};
  }
}

const keycloakEnabled = !!(
  process.env.KEYCLOAK_ISSUER &&
  process.env.KEYCLOAK_CLIENT_ID &&
  process.env.KEYCLOAK_CLIENT_SECRET
);

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });
        if (!user || !user.passwordHash) return null; // SSO-only accounts can't use credentials

        const valid = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!valid) return null;

        return { id: user.id, email: user.email, name: user.name, role: user.role };
      },
    }),
    ...(keycloakEnabled
      ? [
          KeycloakProvider({
            clientId: process.env.KEYCLOAK_CLIENT_ID!,
            clientSecret: process.env.KEYCLOAK_CLIENT_SECRET!,
            issuer: process.env.KEYCLOAK_ISSUER!,
          }),
        ]
      : []),
  ],
  callbacks: {
    async jwt({ token, user, account }) {
      // Credentials sign-in
      if (user && account?.provider === "credentials") {
        token.id = user.id as string;
        token.role = (user as unknown as { role: string }).role;
      }

      // Keycloak sign-in — runs only on first sign-in (account is present)
      if (account?.provider === "keycloak" && account.access_token) {
        const payload = decodeJwt(account.access_token);
        const realmRoles = ((payload.realm_access as { roles?: string[] })?.roles ?? []);
        const isAdmin = realmRoles.some((r) =>
          ["admin", "omnijira_admin"].includes(r.toLowerCase())
        );
        const role = isAdmin ? "ADMIN" : "VIEWER";

        // Upsert user so they exist in our DB with the right role
        const dbUser = await prisma.user.upsert({
          where: { email: token.email! },
          create: {
            email: token.email!,
            name: token.name ?? null,
            passwordHash: null,
            role,
          },
          update: { name: token.name ?? undefined, role },
        });

        token.id = dbUser.id;
        token.role = role;
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
      }
      return session;
    },
  },
};
