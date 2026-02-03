import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import db from "@/lib/db";

const handler = NextAuth({
  session: { strategy: "jwt" },
  pages: {
    signIn: "/", // Redirect to our custom login page if unauthenticated
  },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        // 1. Fetch user from DB
        const user = await db.supervisor.findUnique({
          where: { email: credentials.email }
        });

        if (!user) return null;

        // 2. Verify Password
        const isValid = await bcrypt.compare(credentials.password, user.password);

        if (!isValid) return null;

        // 3. Return user object (NextAuth saves this in the token)
        return { id: user.id, name: user.name, email: user.email };
      }
    })
  ],
  callbacks: {
    // Add User ID to the session object so we can use it in the app
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.sub;
      }
      return session;
    }
  }
});

export { handler as GET, handler as POST };