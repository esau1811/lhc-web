import DiscordProvider from 'next-auth/providers/discord';

export const authOptions = {
  providers: [
    DiscordProvider({
      clientId: process.env.DISCORD_CLIENT_ID ?? '',
      clientSecret: process.env.DISCORD_CLIENT_SECRET ?? '',
      authorization: {
        params: {
          scope: 'identify email guilds',
        },
      },
    }),
  ],
  callbacks: {
    async signIn({ account, user }) {
      // Always allow sign in — guild check is done in jwt callback
      // Returning a URL string from signIn breaks the OAuth flow
      return true;
    },
    async jwt({ token, account, profile }) {
      if (account) {
        token.discordId = profile?.id;
        token.accessToken = account.access_token;

        // Check guild membership and store in token
        const targetGuildId = process.env.DISCORD_GUILD_ID || '1231649939223707748';
        try {
          const res = await fetch('https://discord.com/api/users/@me/guilds', {
            headers: {
              Authorization: `Bearer ${account.access_token}`,
            },
          });
          if (res.ok) {
            const guilds = await res.json();
            token.isInGuild = guilds.some((guild) => guild.id === targetGuildId);
          } else {
            token.isInGuild = false;
          }
        } catch (e) {
          console.error('Discord Guild Check Error:', e);
          token.isInGuild = false;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.sub;
        session.user.discordId = token.discordId;
        session.user.isInGuild = token.isInGuild ?? false;
      }
      return session;
    },
  },
  pages: {
    signIn: '/',
  },
  secret: process.env.NEXTAUTH_SECRET,
};
