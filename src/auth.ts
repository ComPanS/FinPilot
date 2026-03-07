import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { CredentialsSignin } from "next-auth";
import { fetchYandexProfile } from "@/lib/yandex-oauth";

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        yandex_access_token: { label: "Yandex Token", type: "text" },
      },
      async authorize(credentials) {
        const yandexToken = credentials?.yandex_access_token as string | undefined;
        if (yandexToken) {
          const profile = await fetchYandexProfile(yandexToken);
          const existingAccount = await prisma.account.findFirst({
            where: {
              provider: "yandex",
              providerAccountId: profile.id,
            },
            include: { user: true },
          });
          if (existingAccount) {
            const user = await prisma.user.update({
              where: { id: existingAccount.userId },
              data: {
                name: profile.displayName ?? existingAccount.user.name,
                image: profile.avatarUrl ?? existingAccount.user.image,
                emailVerified: new Date(),
              },
            });
            return { id: user.id, email: user.email, name: user.name, image: user.image };
          }
          const existingUser = await prisma.user.findUnique({
            where: { email: profile.email },
          });
          if (existingUser) {
            await prisma.account.upsert({
              where: {
                provider_providerAccountId: {
                  provider: "yandex",
                  providerAccountId: profile.id,
                },
              },
              create: {
                userId: existingUser.id,
                type: "oauth",
                provider: "yandex",
                providerAccountId: profile.id,
                access_token: yandexToken,
              },
              update: { access_token: yandexToken },
            });
            const user = await prisma.user.update({
              where: { id: existingUser.id },
              data: {
                name: profile.displayName ?? existingUser.name,
                image: profile.avatarUrl ?? existingUser.image,
                emailVerified: new Date(),
              },
            });
            return { id: user.id, email: user.email, name: user.name, image: user.image };
          }
          const newUser = await prisma.user.create({
            data: {
              email: profile.email,
              name: profile.displayName,
              image: profile.avatarUrl,
              emailVerified: new Date(),
            },
          });
          await prisma.account.create({
            data: {
              userId: newUser.id,
              type: "oauth",
              provider: "yandex",
              providerAccountId: profile.id,
              access_token: yandexToken,
            },
          });
          return { id: newUser.id, email: newUser.email, name: newUser.name, image: newUser.image };
        }
        if (!credentials?.email || !credentials?.password) return null;
        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
        });
        if (!user?.password) return null;
        if (!user.emailVerified) {
          throw new CredentialsSignin("Подтвердите email. Проверьте почту.");
        }
        const valid = await bcrypt.compare(
          credentials.password as string,
          user.password
        );
        if (!valid) return null;
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
        };
      },
    }),
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
      allowDangerousEmailAccountLinking: false,
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (
        account?.provider === "google" &&
        user?.email
      ) {
        await prisma.user.updateMany({
          where: { email: user.email },
          data: { emailVerified: new Date() },
        });
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { id?: string }).id = token.id as string;
      }
      return session;
    },
  },
});
